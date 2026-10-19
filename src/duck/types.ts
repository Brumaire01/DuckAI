/**
 * Duck.ai 上游接入层的协议中立类型。
 *
 * 三协议（OpenAI Chat Completions / Anthropic Messages / Responses）在接入层
 * 先被扁平化成这里的 Message，再由 client 转成上游 wire 形状。
 */

/** 会话角色：system/tool 在接入层已折叠为 user 文本，因此只剩两态。 */
export const ROLE_USER = 'user'
export const ROLE_ASSISTANT = 'assistant'

/** 一条已扁平化为纯文本的上游消息。 */
export interface Message {
  role: typeof ROLE_USER | typeof ROLE_ASSISTANT
  text: string
}

/** 一次上游发问的协议中立描述。 */
export interface ChatRequest {
  model: string
  messages: Message[]
  /** 会话粘性指纹（相同指纹复用同一个 conversationId）。 */
  sessionHint?: string
  /** 推理强度：none / low / medium / high。 */
  reasoningEffort?: string
  canUseTools?: boolean
}

/** 模型目录的一条记录。 */
export interface ModelInfo {
  id: string
  ownedBy: string
}

/** 上游流事件类型。 */
export type EventKind = 'text' | 'reasoning' | 'done' | 'error'

/** 一条上游流事件。 */
export interface DuckEvent {
  kind: EventKind
  text?: string
  error?: Error
}

// ==================== 错误类型 ====================

/** 上游返回了非 2xx 的确定性错误。 */
export class UpstreamError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`upstream status ${status}: ${body}`)
    this.name = 'UpstreamError'
    this.status = status
    this.body = body
  }
}

/** 上游 429：带建议重试秒数。 */
export class RateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter = 3) {
    super(`upstream rate limited, retry after ${retryAfter}s`)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 上游 418：出口 IP 被临时封禁。 */
export class BannedError extends Error {
  reason: string
  constructor(reason = '') {
    super(reason ? `upstream banned this egress: ${reason}` : 'upstream banned this egress (418)')
    this.name = 'BannedError'
    this.reason = reason
  }
}

/** VQD 挑战求解或校验失败。 */
export class ChallengeError extends Error {
  detail: string
  constructor(detail = '') {
    super(detail ? `vqd challenge failed: ${detail}` : 'vqd challenge failed')
    this.name = 'ChallengeError'
    this.detail = detail
  }
}

/** 从响应头解析 Retry-After（只支持秒数形式），默认 3 秒。 */
export function retryAfter(headers: Headers): number {
  const v = headers.get('retry-after')
  if (!v) return 3
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : 3
}

/** 按字符（而非字节）截断，避免切坏多字节字符。 */
export function truncate(s: string, n: number): string {
  const chars = Array.from(s)
  return chars.length <= n ? s : chars.slice(0, n).join('') + '…'
}
