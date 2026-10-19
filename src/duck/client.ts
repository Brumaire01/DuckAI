/**
 * Duck.ai 上游接入层（Workers 版）。
 *
 * 与 Go 版一一对应：VQD 挑战维护 + 请求头组装 + SSE 流 + 重试策略。
 * 所有缓存都放在 isolate 内存里（Workers 没有跨请求的进程级缓存，
 * 同一 isolate 复用模块作用域变量即可，冷启动后重新取一次成本可接受）。
 */
import {
  CONSENT_PURPOSES,
  CONTINUATION,
  DEFAULT_STACK,
  SEC_CH_UA,
  TOOL_APPROVAL,
  loadConfig,
  type GatewayConfig,
} from './config'
import { solveVQD } from './quickjs'
import { parseSSE } from './sse'
import {
  BannedError,
  ChallengeError,
  RateLimitError,
  ROLE_ASSISTANT,
  ROLE_USER,
  UpstreamError,
  retryAfter,
  truncate,
  type ChatRequest,
  type DuckEvent,
  type Message,
  type ModelInfo,
} from './types'

/** 上游模型目录不可达时的兜底快照（2026-10 线上）。 */
const SNAPSHOT_MODELS: ModelInfo[] = [
  { id: 'gpt-6-luna', ownedBy: 'duck.ai' },
  { id: 'gpt-5.6-luna', ownedBy: 'duck.ai' },
  { id: 'gpt-5.6-terra', ownedBy: 'duck.ai' },
  { id: 'gpt-5.4-mini', ownedBy: 'duck.ai' },
  { id: 'gpt-5.6-sol', ownedBy: 'duck.ai' },
  { id: 'claude-sonnet-4-6', ownedBy: 'anthropic' },
  { id: 'claude-haiku-4-5', ownedBy: 'anthropic' },
  { id: 'claude-opus-4-8', ownedBy: 'anthropic' },
  { id: 'mistral-small-2603', ownedBy: 'mistral' },
  { id: 'tinfoil/gpt-oss-120b', ownedBy: 'tinfoil' },
  { id: 'tinfoil/gemma4-31b', ownedBy: 'tinfoil' },
]

/** 上游一帧请求体的消息形状。 */
interface DuckPart {
  type: 'text'
  text: string
}
interface DuckMessage {
  role: string
  content: string | DuckPart[]
  parts?: DuckPart[]
}
interface DuckBody {
  model: string
  messages: DuckMessage[]
  canUseTools: boolean
  reasoningEffort: string
  canUseApproxLocation: null
  canDelegateImageGeneration: null
  canShowGreeting: boolean
  durableStream: {
    messageId: string
    conversationId: string
    publicKey: Record<string, unknown>
  }
}

/** 把协议中立的扁平消息转成上游 wire 形状。 */
function toDuckMessages(msgs: Message[]): DuckMessage[] {
  const out: DuckMessage[] = []
  for (const m of msgs) {
    const text = m.text ?? ''
    if (!text.trim() && m.role !== ROLE_ASSISTANT) continue
    if (m.role === ROLE_ASSISTANT) {
      out.push({ role: 'assistant', content: '', parts: [{ type: 'text', text }] })
      continue
    }
    out.push({ role: 'user', content: [{ type: 'text', text }] })
  }
  return out
}

/** 生成 x-fe-signals：base64(JSON) 的前端遥测事件表。 */
function feSignals(startMS: number): string {
  const rand = (n: number) => Math.floor(Math.random() * n)
  const impression = 80 + rand(180)
  const action = impression + 5000 + rand(25000)
  const sw1 = action + 20 + rand(180)
  const sw2 = sw1 + 100 + rand(3000)
  const imp2 = sw2 + 50000 + rand(60000)
  const finish = imp2 + 2000 + rand(4000)
  const startChat = finish + 20 + rand(60)
  const end = startChat + 1 + rand(5)

  const payload = {
    start: startMS - end,
    events: [
      { name: 'onboarding_impression', delta: impression },
      { name: 'action', delta: action, trusted: true },
      { name: 'initSwitchModel', delta: sw1 },
      { name: 'initSwitchModel', delta: sw2 },
      { name: 'onboarding_impression', delta: imp2 },
      { name: 'onboarding_finish', delta: finish },
      { name: 'startNewChat_free', delta: startChat },
    ],
    end,
  }
  return btoa(JSON.stringify(payload))
}

/** 随机 hex 串（x-ddg-journey-id 用）。 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 从上游错误体里抽出可读信息（detail/type），避免把整段 JSON 抛给客户端。 */
function cleanUpstreamBody(body: string): string {
  try {
    const payload = JSON.parse(body) as { detail?: string; type?: string }
    if (payload.detail) return payload.detail
    if (payload.type) return payload.type
  } catch {
    /* 非 JSON，原样截断 */
  }
  return truncate(body, 300)
}

/**
 * durableStream 用的 RSA-OAEP-256 公钥（JWK）。
 *
 * 生成一次就够：同一 isolate 内所有请求复用同一把公钥，上游只用它加密
 * 流式回包的 durable 段落，不参与身份校验。
 */
let jwkPromise: Promise<Record<string, unknown>> | undefined
function publicJwk(): Promise<Record<string, unknown>> {
  if (!jwkPromise) {
    jwkPromise = (async () => {
      const pair = (await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt'],
      )) as CryptoKeyPair
      const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
      // 键序对齐线上 wire：alg,e,ext,key_ops,kty,n,use
      return { alg: 'RSA-OAEP-256', e: jwk.e, ext: true, key_ops: ['encrypt'], kty: 'RSA', n: jwk.n, use: 'enc' }
    })()
    // 失败后允许下次重试，避免一次偶发错误把整个 isolate 钉死
    jwkPromise.catch(() => {
      jwkPromise = undefined
    })
  }
  return jwkPromise
}

/** Duck.ai 上游客户端。 */
export class DuckClient {
  readonly cfg: GatewayConfig
  private vqd = ''
  private vqdExp = 0
  private solving?: Promise<string>
  private fe = ''
  private feExp = 0
  private models: ModelInfo[] = []
  private modelsExp = 0
  private sticky = new Map<string, string>()

  constructor(cfg: GatewayConfig) {
    this.cfg = cfg
  }

  get baseUrl(): string {
    return this.cfg.baseUrl
  }

  /** 应用模型别名并把空模型名回落到默认模型。 */
  resolveModel(name?: string): string {
    const n = (name ?? '').trim()
    if (!n) return this.cfg.defaultModel
    const alias = this.cfg.modelAliases[n]
    return alias && alias !== '' ? alias : n
  }

  // ==================== 请求头 ====================

  private baseHeaders(): Record<string, string> {
    return {
      'accept-language': 'en-US,en;q=0.9',
      origin: this.cfg.baseUrl,
      referer: this.cfg.baseUrl + '/',
      'sec-ch-ua': SEC_CH_UA,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': this.cfg.userAgent,
    }
  }

  private stack(): string {
    return this.cfg.vqdStack || DEFAULT_STACK
  }

  // ==================== 挑战（VQD） ====================

  /** 取回一次挑战（响应头 x-vqd-hash-1）。 */
  private async status(): Promise<string> {
    const res = await fetch(this.cfg.baseUrl + '/duckchat/v1/status', {
      headers: { ...this.baseHeaders(), accept: '*/*', 'x-vqd-accept': '1' },
      signal: AbortSignal.timeout(15_000),
    })
    // 主动丢弃响应体，避免连接被挂住
    try {
      await res.body?.cancel()
    } catch {
      /* ignore */
    }

    if (res.status === 418) throw new BannedError('418 ERR_BN_LIMIT (status)')
    if (res.status === 429) throw new RateLimitError(retryAfter(res.headers))
    if (res.status !== 200) throw new UpstreamError(res.status, 'status probe failed')

    const challenge = res.headers.get('x-vqd-hash-1')
    if (!challenge) throw new ChallengeError('response has no x-vqd-hash-1 header')
    return challenge
  }

  private cachedVQD(): string {
    return this.vqd && Date.now() < this.vqdExp ? this.vqd : ''
  }

  private storeVQD(token: string, ttlMs: number): void {
    this.vqd = token
    this.vqdExp = Date.now() + ttlMs
  }

  /** 丢弃缓存令牌（418/429/挑战失败后调用）。 */
  invalidateVQD(): void {
    this.vqd = ''
    this.vqdExp = 0
  }

  /**
   * 返回可用的 x-vqd-hash-1：缓存 → override → 取挑战并本地求解。
   *
   * 同一 isolate 内并发请求共用一次求解（single-flight），避免同时起多个
   * QuickJS 实例把 CPU 打满。
   */
  async ensureVQD(): Promise<string> {
    const cached = this.cachedVQD()
    if (cached) return cached
    if (this.solving) return this.solving

    const task = (async () => {
      const again = this.cachedVQD()
      if (again) return again

      if (this.cfg.vqdOverride) {
        this.storeVQD(this.cfg.vqdOverride, 10 * 60_000)
        return this.cfg.vqdOverride
      }

      const challenge = await this.status()
      const token = await solveVQD(challenge, {
        userAgent: this.cfg.userAgent,
        origin: this.cfg.baseUrl,
        stack: this.stack(),
      })
      this.storeVQD(token, this.cfg.vqdCacheSecs * 1000)
      return token
    })()

    this.solving = task
    try {
      return await task
    } finally {
      if (this.solving === task) this.solving = undefined
    }
  }

  // ==================== 前端版本号 ====================

  /** x-fe-version（首页 data-version-tag + data-version-sha），缓存 30 分钟。 */
  private async feVersion(): Promise<string> {
    if (this.cfg.feVersion) return this.cfg.feVersion
    if (this.fe && Date.now() < this.feExp) return this.fe

    // 首页抓取失败不阻塞发问：省略该头，上游多数情况下仍接受。
    try {
      const res = await fetch(this.cfg.baseUrl + '/', {
        headers: {
          ...this.baseHeaders(),
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
        },
        signal: AbortSignal.timeout(8_000),
      })
      if (res.status !== 200) return ''
      const html = await res.text()
      const tag = /data-version-tag="([^"]+)"/.exec(html)
      const sha = /data-version-sha="([^"]+)"/.exec(html)
      if (!tag || !sha) return ''
      const version = `${tag[1]}-${sha[1]}`
      this.fe = version
      this.feExp = Date.now() + 30 * 60_000
      return version
    } catch {
      return ''
    }
  }

  // ==================== 发问 ====================

  /**
   * 发起一次上游对话，返回事件流。
   *
   * 重试策略（对齐 Go 版）：418 换令牌重试一次、429 尊重 Retry-After（短等待就地重试）、
   * 400 + CHALLENGE 失效重取；最多 3 轮。
   */
  async chat(req: ChatRequest): Promise<AsyncGenerator<DuckEvent>> {
    let lastErr: Error | undefined

    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await this.ensureVQD()
      const res = await this.postChat(req, token)
      const status = res.status

      if (status === 200) {
        if (!res.body) throw new UpstreamError(502, 'upstream returned empty body')
        return parseSSE(res.body)
      }

      if (status === 418) {
        try {
          await res.body?.cancel()
        } catch {
          /* ignore */
        }
        this.invalidateVQD()
        lastErr = new BannedError('418 ERR_BN_LIMIT')
        // 418 是出口级封禁，换令牌通常无效：只再试一次就上报，避免白烧请求。
        if (attempt >= 1) throw lastErr
        await sleep(400)
        continue
      }

      if (status === 429) {
        const ra = retryAfter(res.headers)
        try {
          await res.body?.cancel()
        } catch {
          /* ignore */
        }
        this.invalidateVQD()
        lastErr = new RateLimitError(ra)
        if (ra > 5) throw lastErr
        // 上游是滑动窗口限流，固定等 ra 秒往往还在窗口内：按轮次递增等待。
        await sleep(Math.min(ra * (attempt + 1), 15) * 1000)
        continue
      }

      const text = truncate(await res.text().catch(() => ''), 8 * 1024)
      if (status === 400 && text.toUpperCase().includes('CHALLENGE')) {
        this.invalidateVQD()
        lastErr = new ChallengeError(truncate(text, 300))
        continue
      }
      throw new UpstreamError(status, cleanUpstreamBody(text))
    }

    throw lastErr ?? new ChallengeError('retry budget exhausted')
  }

  private async postChat(req: ChatRequest, token: string): Promise<Response> {
    const model = this.resolveModel(req.model)
    const effort = req.reasoningEffort || this.cfg.reasoningEffort || 'none'
    const canUseTools = req.canUseTools ?? this.cfg.canUseTools

    // 2026-10 线上 wire 形状：没有 metadata 段，canShowGreeting 恒 false。
    const body: DuckBody = {
      model,
      messages: toDuckMessages(req.messages),
      canUseTools,
      reasoningEffort: effort,
      canUseApproxLocation: null,
      canDelegateImageGeneration: null,
      canShowGreeting: false,
      durableStream: {
        messageId: crypto.randomUUID(),
        conversationId: this.conversationID(req.sessionHint),
        publicKey: await publicJwk(),
      },
    }

    const headers: Record<string, string> = {
      ...this.baseHeaders(),
      'content-type': 'application/json',
      accept: 'text/event-stream,application/json',
      priority: 'u=1, i',
      'x-vqd-hash-1': token,
      'x-ddg-journey-id': randomHex(16),
      'x-fe-signals': feSignals(Date.now()),
      'x-duckai-consent-purposes': CONSENT_PURPOSES,
      'x-duckai-continuation': CONTINUATION,
      'x-duckai-response-id': crypto.randomUUID(),
    }
    if (canUseTools) headers['x-duckai-tool-approval'] = TOOL_APPROVAL

    const fe = await this.feVersion()
    if (fe) headers['x-fe-version'] = fe

    return fetch(this.cfg.baseUrl + '/duckchat/v1/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
    })
  }

  /** 会话粘性：相同 hint 复用同一个 conversationId（newChat 时每次新建）。 */
  private conversationID(hint?: string): string {
    if (this.cfg.newChat || !hint) return crypto.randomUUID()
    const hit = this.sticky.get(hint)
    if (hit) return hit
    if (this.sticky.size > 4096) this.sticky.clear()
    const id = crypto.randomUUID()
    this.sticky.set(hint, id)
    return id
  }

  // ==================== 模型目录 ====================

  /** 模型目录；上游不可达时用本地快照兜底。 */
  async listModels(): Promise<ModelInfo[]> {
    if (this.models.length && Date.now() < this.modelsExp) return [...this.models]

    const fetched = await this.fetchModels()
    if (fetched.length) {
      this.models = fetched
      this.modelsExp = Date.now() + this.cfg.modelsCacheSecs * 1000
      return [...fetched]
    }
    return [...SNAPSHOT_MODELS]
  }

  private async fetchModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(this.cfg.baseUrl + '/duckchat/v1/models', {
        headers: { ...this.baseHeaders(), accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status !== 200) return []
      const payload = (await res.json()) as { models?: { id?: string; provider?: string }[] }
      const seen = new Set<string>()
      const out: ModelInfo[] = []
      for (const m of payload.models ?? []) {
        if (!m.id || seen.has(m.id)) continue
        seen.add(m.id)
        out.push({ id: m.id, ownedBy: m.provider || 'duck.ai' })
      }
      if (!out.length) return []
      // 上游没返回的快照模型继续兜底，保证客户端配置的模型名不会凭空消失
      for (const m of SNAPSHOT_MODELS) if (!seen.has(m.id)) out.push(m)
      return out
    } catch {
      return []
    }
  }

  // ==================== 健康检查 ====================

  /** 上游可用性快照；VQD 无缓存时做一次轻量探测。 */
  async health(): Promise<{ info: Record<string, unknown>; error?: Error }> {
    const vqdCached = Boolean(this.cachedVQD())
    const info: Record<string, unknown> = {
      upstream: this.cfg.baseUrl,
      vqd_cached: vqdCached,
      fe_version: this.fe || null,
      default_model: this.cfg.defaultModel,
    }
    if (vqdCached) return { info }
    try {
      await this.status()
      return { info }
    } catch (e) {
      return { info, error: e as Error }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ==================== 单例 ====================

let client: DuckClient | undefined
let clientKey = ''

/** 取上游客户端单例（同一 isolate 内复用 VQD / 模型目录缓存）。 */
export function getClient(env: Record<string, unknown> = {}): DuckClient {
  const cfg = loadConfig(env)
  const key = cfg.baseUrl + '|' + cfg.defaultModel + '|' + cfg.userAgent
  if (!client || clientKey !== key) {
    client = new DuckClient(cfg)
    clientKey = key
  }
  return client
}

export { SNAPSHOT_MODELS }
