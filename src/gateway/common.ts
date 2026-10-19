/**
 * 三协议共用的小工具：id 生成、token 估算、错误映射、SSE 输出。
 */
import {
  BannedError,
  ChallengeError,
  RateLimitError,
  UpstreamError,
  type Message,
} from '../duck/types'

/** 客户端使用的协议族，仅影响错误体与事件名。 */
export type Proto = 'openai' | 'anthropic' | 'responses'

/** 生成 "<prefix><24位hex>" 形态的 id（chatcmpl- / msg_ / resp_ 家族）。 */
export function newID(prefix: string): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  return prefix + Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * 启发式 token 估算：ASCII 约 4 字符 1 token，非 ASCII 按 1 字符 1 token。
 * 上游不返回 usage，这里只保证客户端看到的数字量级合理且非零。
 */
export function estimateTokens(s: string): number {
  if (!s) return 0
  let latin = 0
  let wide = 0
  for (const ch of s) {
    if (ch.codePointAt(0)! < 128) latin++
    else wide++
  }
  const n = Math.floor(latin / 4) + wide
  return n < 1 ? 1 : n
}

/** 估算一组消息的 prompt tokens。 */
export function messagesTokens(msgs: Message[]): number {
  let total = 0
  for (const m of msgs) total += estimateTokens(m.text) + 4
  return total < 1 ? 1 : total
}

/** 上游错误 → 对外 HTTP 语义。 */
export interface MappedError {
  status: number
  code: string
  message: string
  retryAfter: number
}

export function mapError(err: unknown): MappedError {
  if (err instanceof BannedError) {
    return {
      status: 429,
      code: 'upstream_banned',
      message: 'duck.ai 拒绝了当前出口（418），请稍后重试或更换出口 IP',
      retryAfter: 30,
    }
  }
  if (err instanceof RateLimitError) {
    const ra = err.retryAfter > 0 ? err.retryAfter : 3
    return { status: 429, code: 'rate_limit_exceeded', message: 'duck.ai 限流（429），请稍后重试', retryAfter: ra }
  }
  if (err instanceof ChallengeError) {
    return {
      status: 503,
      code: 'upstream_challenge_failed',
      message: 'VQD 挑战求解失败：' + err.detail,
      retryAfter: 0,
    }
  }
  if (err instanceof UpstreamError) {
    let msg = err.body
    if (msg.includes('ERR_MODEL_RESTRICTED')) {
      msg = '该模型当前不可用（受限或需要登录），可改用 gpt-6-luna / gpt-5.6-luna / gpt-5.4-mini'
    }
    if (err.status === 429) return { status: 429, code: 'rate_limit_exceeded', message: msg, retryAfter: 3 }
    if (err.status >= 400 && err.status < 500) {
      return { status: 400, code: 'invalid_request_error', message: msg, retryAfter: 0 }
    }
    return { status: 502, code: 'upstream_error', message: msg, retryAfter: 0 }
  }
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return { status: 504, code: 'upstream_timeout', message: '上游响应超时', retryAfter: 0 }
  }
  return {
    status: 502,
    code: 'upstream_error',
    message: err instanceof Error ? err.message : String(err),
    retryAfter: 0,
  }
}

/** OpenAI 错误 type。 */
function openAIErrorType(status: number): string {
  if (status === 400 || status === 422) return 'invalid_request_error'
  if (status === 401) return 'authentication_error'
  if (status === 404) return 'not_found_error'
  if (status === 429) return 'rate_limit_error'
  return 'api_error'
}

/** Anthropic 错误 type。 */
export function anthropicErrorType(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return 'invalid_request_error'
    case 401:
      return 'authentication_error'
    case 403:
      return 'permission_error'
    case 404:
      return 'not_found_error'
    case 413:
      return 'request_too_large'
    case 429:
      return 'rate_limit_error'
    case 503:
      return 'overloaded_error'
    default:
      return 'api_error'
  }
}

/** 按协议族输出标准错误体。 */
export function errorResponse(
  proto: Proto,
  status: number,
  code: string,
  message: string,
  retryAfter = 0,
): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' }
  if (retryAfter > 0) headers['retry-after'] = String(retryAfter)

  const body =
    proto === 'anthropic'
      ? { type: 'error', error: { type: anthropicErrorType(status), message } }
      : { error: { message, type: openAIErrorType(status), param: null, code } }

  return new Response(JSON.stringify(body), { status, headers })
}

/** 把异常按协议族输出。 */
export function failResponse(proto: Proto, err: unknown): Response {
  const m = mapError(err)
  return errorResponse(proto, m.status, m.code, m.message, m.retryAfter)
}

/** SSE 必需响应头。 */
export const SSE_HEADERS: Record<string, string> = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
}

/**
 * 把一个「SSE 帧字符串」的异步生成器包装成流式 Response。
 *
 * 用 pull 模式按需拉取，天然带背压；客户端断开时 cancel 会把上游连接一起关掉。
 */
export function sseResponse(frames: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await frames.next()
        if (next.done) {
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(next.value))
      } catch (e) {
        controller.error(e)
      }
    },
    async cancel() {
      // 客户端断开：让生成器走 finally，关掉上游 reader
      try {
        await frames.return(undefined as never)
      } catch {
        /* ignore */
      }
    },
  })
  return new Response(stream, { status: 200, headers: SSE_HEADERS })
}

/** 一条 data 帧。 */
export function dataFrame(payload: string): string {
  return `data: ${payload}\n\n`
}

/** 一条带 event 名的帧（Anthropic / Responses 风格）。 */
export function eventFrame(event: string, payload: string): string {
  return `event: ${event}\ndata: ${payload}\n\n`
}

/** 把对象序列化成紧凑 JSON。 */
export function jsonString(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return '{}'
  }
}

/** 读取请求体 JSON（解析失败返回 null）。 */
export async function readJSON<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
