/**
 * VQD 挑战求解器（Workers 版）。
 *
 * Cloudflare Workers 运行时禁止 eval / new Function（实测抛
 * `EvalError: Code generation from strings disallowed for this context`），
 * 而 duck.ai 的 `x-vqd-hash-1` 挑战本身就是一段 base64 编码的 JS，
 * 必须真正执行才能算出 client_hashes。因此这里用 quickjs-emscripten（WASM）
 * 起一个隔离的 QuickJS 运行时来跑挑战脚本。
 *
 * 求解四步链与 Go 版完全一致：
 *   base64 解码挑战 → 在 JS 运行时执行 → client_hashes 逐个 SHA-256→base64 →
 *   补 meta(origin/stack/duration) 后 JSON.stringify → base64。
 */
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten'
import { QuickJSFFI } from '@jitl/quickjs-wasmfile-release-sync/ffi'
import wasmModule from './quickjs.wasm'
import { PRELUDE_JS } from './prelude'
import { ChallengeError } from './types'

/**
 * 自定义 variant：Workers 里 emscripten 默认的 wasm 加载路径（fs / fetch）不可用，
 * 必须由我们把已经编译好的 WebAssembly.Module 直接喂给 instantiateWasm。
 */
const variant = {
  type: 'sync',
  importFFI: async () => QuickJSFFI,
  importModuleLoader: async () => {
    const { default: factory } = await import('@jitl/quickjs-wasmfile-release-sync/emscripten-module')
    return (opts: any = {}) =>
      factory({
        ...opts,
        instantiateWasm(imports: WebAssembly.Imports, cb: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
          const instance = new WebAssembly.Instance(wasmModule as unknown as WebAssembly.Module, imports)
          cb(instance, wasmModule as unknown as WebAssembly.Module)
          return instance.exports
        },
      })
  },
} as any

/** WASM 模块较重，同一 isolate 内只初始化一次（冷启动约 100~150ms）。 */
let enginePromise: Promise<any> | undefined
function engine(): Promise<any> {
  if (!enginePromise) enginePromise = newQuickJSWASMModuleFromVariant(variant) as any
  return enginePromise as Promise<any>
}

/** 预热：可在 health 检查里调用，把冷启动成本提前摊掉。 */
export async function warmupSolver(): Promise<void> {
  await engine()
}

// ==================== 编码工具 ====================

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function utf8ToBase64(s: string): string {
  return bytesToBase64(new TextEncoder().encode(s))
}

/** 等价于浏览器 crypto.subtle.digest('SHA-256') → base64。 */
async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

/**
 * 纯 JS 版 btoa/atob，定义在 QuickJS 内部。
 *
 * 注意：不能把宿主函数通过 setProp 注入给 prelude 使用 —— prelude 里会重新
 * 定义/覆盖全局 btoa，跨边界调用容易拿到被替换后的引用，实测会出错。
 */
const BOOTSTRAP_HELPERS = `
function __goBtoa(s){var b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",o="",i=0;s=String(s);
for(;i<s.length;i+=3){var c1=s.charCodeAt(i),c2=s.charCodeAt(i+1),c3=s.charCodeAt(i+2);
var e1=c1>>2,e2=((c1&3)<<4)|(isNaN(c2)?0:c2>>4),e3=((c2&15)<<2)|(isNaN(c3)?0:c3>>6),e4=c3&63;
o+=b.charAt(e1)+b.charAt(e2)+(isNaN(c2)?"=":b.charAt(e3))+(isNaN(c3)?"=":b.charAt(e4));}return o}
function __goAtob(s){var b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",o="",i=0;
s=String(s).replace(/=+$/,"");for(;i<s.length;){var e1=b.indexOf(s.charAt(i++)),e2=b.indexOf(s.charAt(i++)),e3=b.indexOf(s.charAt(i++)),e4=b.indexOf(s.charAt(i++));
o+=String.fromCharCode((e1<<2)|(e2>>4));if(e3>0&&e3!==64)o+=String.fromCharCode(((e2&15)<<4)|(e3>>2));if(e4>0&&e4!==64)o+=String.fromCharCode(((e3&3)<<6)|e4);}return o}
`

/** 挑战求解所需的环境输入。 */
export interface SolveEnv {
  userAgent: string
  origin: string
  stack: string
}

/** 挑战脚本返回的原始结构（字段随上游版本变化，这里只强类型化用到的部分）。 */
interface RawChallengeResult {
  client_hashes: unknown[]
  server_hashes?: unknown[]
  signals?: Record<string, unknown>
  meta?: Record<string, unknown>
  [k: string]: unknown
}

/**
 * 在 QuickJS 里执行挑战脚本，取回它返回的对象。
 *
 * 挑战脚本返回 Promise（内部有 await crypto.subtle 之类），所以要先跑微任务队列
 * 直到 __done 被置位；executePendingJobs() 返回 0 说明队列已空且 Promise 仍未结算，
 * 直接判失败，避免死等。
 */
async function runChallenge(jsCode: string, env: SolveEnv): Promise<RawChallengeResult> {
  const QuickJS = await engine()
  const vm = QuickJS.newContext()
  try {
    const boot =
      `var __goUserAgent=${JSON.stringify(env.userAgent)};` +
      `var __goOrigin=${JSON.stringify(env.origin)};` +
      `var __goStack=${JSON.stringify(env.stack)};`
    let r = vm.evalCode(boot + BOOTSTRAP_HELPERS)
    if (r.error) throw new ChallengeError('bootstrap: ' + String(vm.dump(r.error)))
    r.value.dispose()

    r = vm.evalCode(PRELUDE_JS)
    if (r.error) throw new ChallengeError('browser prelude: ' + String(vm.dump(r.error)))
    r.value.dispose()

    // 挑战是不可信输入：用中断处理器兜住死循环。
    const deadline = Date.now() + SOLVE_TIMEOUT_MS
    try {
      vm.runtime.setInterruptHandler(() => Date.now() > deadline)
    } catch {
      /* 旧版本没有该 API 时忽略 */
    }

    const wrapped =
      `globalThis.__done=false;globalThis.__result=null;globalThis.__error=null;` +
      `(async function(){try{globalThis.__result=await (${jsCode})}` +
      `catch(e){globalThis.__error=String((e&&e.stack)||e)}finally{globalThis.__done=true}})();`
    r = vm.evalCode(wrapped)
    if (r.error) throw new ChallengeError('eval challenge: ' + String(vm.dump(r.error)))
    r.value.dispose()

    for (let i = 0; i < 512; i++) {
      const done = vm.evalCode('globalThis.__done')
      const isDone = Boolean(vm.dump(done.value))
      done.value.dispose()
      if (isDone) break
      if (Date.now() > deadline) throw new ChallengeError('solve timeout')
      const pending = vm.runtime.executePendingJobs()
      if (pending <= 0) break
    }

    const doneCheck = vm.evalCode('globalThis.__done')
    const settled = Boolean(vm.dump(doneCheck.value))
    doneCheck.value.dispose()

    const errHandle = vm.evalCode('globalThis.__error')
    const errRaw = vm.dump(errHandle.value)
    errHandle.value.dispose()
    // 注意：JS 的 null 经 dump 后是 JS null，String(null) 会得到 "null" 这个真值字符串，
    // 必须按原始值判断，否则每次求解都会被误判成失败。
    if (errRaw !== null && errRaw !== undefined && String(errRaw) !== '') {
      throw new ChallengeError('challenge rejected: ' + String(errRaw))
    }
    if (!settled) throw new ChallengeError('challenge promise did not settle')

    const res = vm.evalCode('JSON.stringify(globalThis.__result)')
    if (res.error) throw new ChallengeError('stringify result: ' + String(vm.dump(res.error)))
    const json = String(vm.dump(res.value))
    res.value.dispose()
    if (!json || json === 'null' || json === 'undefined') {
      throw new ChallengeError('challenge returned empty result')
    }
    return JSON.parse(json) as RawChallengeResult
  } finally {
    vm.dispose()
  }
}

/** 求解超时上限（毫秒）。 */
const SOLVE_TIMEOUT_MS = 15_000

/**
 * 把上游下发的 `x-vqd-hash-1` 挑战（base64 的 JS 表达式）求解成可回传的令牌。
 *
 * @param challengeB64 上游 status 响应头里的原始值
 * @returns 可直接放进请求头 `x-vqd-hash-1` 的 base64 令牌
 */
export async function solveVQD(challengeB64: string, env: SolveEnv): Promise<string> {
  const challenge = (challengeB64 || '').trim()
  if (!challenge) throw new ChallengeError('empty vqd challenge')

  let jsCode: string
  try {
    jsCode = new TextDecoder().decode(base64ToBytes(challenge))
  } catch (e) {
    throw new ChallengeError('decode challenge: ' + String(e))
  }

  const result = await runChallenge(jsCode, env)
  if (!result || typeof result !== 'object') throw new ChallengeError('result is not an object')
  if (!Array.isArray(result.client_hashes)) throw new ChallengeError('result has no client_hashes')

  // client_hashes 逐个 SHA-256→base64（挑战返回什么值就 hash 什么值，不做替换）。
  const hashed: string[] = []
  for (const h of result.client_hashes) hashed.push(await sha256Base64(String(h)))

  // meta 保留挑战返回的字段，覆盖 origin / stack / duration。
  const meta: Record<string, unknown> = {}
  if (result.meta && typeof result.meta === 'object') {
    for (const k of Object.keys(result.meta)) meta[k] = result.meta[k]
  }
  meta.origin = env.origin
  meta.stack = env.stack
  meta.duration = String(8 + Math.floor(Math.random() * 13))

  // 键序对齐线上 wire：挑战返回的其余字段在前，client_hashes / meta 收尾。
  const payload: Record<string, unknown> = {}
  for (const k of Object.keys(result)) {
    if (k !== 'client_hashes' && k !== 'meta') payload[k] = result[k]
  }
  payload.client_hashes = hashed
  payload.meta = meta

  return utf8ToBase64(JSON.stringify(payload))
}
