/**
 * 上游 /duckchat/v1/chat 的 SSE 增量流解析。
 *
 * 上游帧语义（线上实测）：
 *   data: {"action":"success","message":"..."}   正文增量
 *   data: {"reasoning":"..."}                    推理增量
 *   data: {"action":"error","type":"ERR_*"}      流内错误（HTTP 仍是 200）
 *   data: [DONE] / [PING] / [CHAT_TITLE:...]     结束 / 心跳 / 会话标题
 *   data: {"role":"tool-invocation"|"source"}    工具调用与引用来源（本网关忽略）
 */
import {
  BannedError,
  ChallengeError,
  RateLimitError,
  UpstreamError,
  type DuckEvent,
} from './types'

/** 上游一帧 JSON 的宽松映射。 */
interface Wire {
  action?: string
  status?: number
  type?: string
  overrideCode?: string
  role?: string
  state?: string
  message?: string
  reasoning?: string
}

/** 把流内错误帧映射为具体错误类型。 */
function classifyInline(status: number | undefined, kind: string): Error {
  const k = (kind || '').toUpperCase()
  if (k.includes('CHALLENGE') || k.includes('VQD')) return new ChallengeError(kind)
  if (k.includes('BN_LIMIT') || k.includes('BANNED')) return new BannedError(kind)
  if (k.includes('RATE') || k.includes('429')) return new RateLimitError(3)
  return new UpstreamError(status && status > 0 ? status : 502, kind)
}

/** 把一条 data 载荷翻译成事件；返回 null 表示该帧可忽略。 */
function decodePayload(raw: string): DuckEvent | null {
  const payload = raw.trim()
  if (!payload) return null
  if (payload === '[DONE]') return { kind: 'done' }
  if (payload === '[PING]') return null
  if (payload.startsWith('[')) return null // [CHAT_TITLE:...] / [NOTE:...] 等旁路标签

  let w: Wire
  try {
    w = JSON.parse(payload) as Wire
  } catch {
    return null
  }

  // 错误帧：action=error 或 type 以 ERR_ 开头
  if (w.action === 'error' || (w.type || '').toUpperCase().startsWith('ERR_')) {
    return { kind: 'error', error: classifyInline(w.status, w.type || '') }
  }

  // 工具调用 / 引用来源：本网关不透传工具协议，直接忽略
  if (w.role === 'tool-invocation' || w.role === 'source') return null

  if (w.reasoning && !w.message) return { kind: 'reasoning', text: w.reasoning }
  if (w.message) return { kind: 'text', text: w.message }
  return null
}

/**
 * 把上游响应体解析成事件流。
 *
 * 用 TextDecoder 的流式模式解码，保证多字节字符跨 chunk 时不会被切坏。
 */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<DuckEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const ev = decodePayload(line.slice(5))
        if (ev) yield ev
      }
    }
    // 收尾：把最后一行没有换行符的残帧也处理掉
    const tail = (buffer + decoder.decode()).trim()
    if (tail.startsWith('data:')) {
      const ev = decodePayload(tail.slice(5))
      if (ev) yield ev
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* 客户端已断开时忽略 */
    }
  }
}

/** 把事件流读成完整文本（非流式路径）。 */
export async function collectStream(gen: AsyncGenerator<DuckEvent>): Promise<string> {
  let out = ''
  for await (const ev of gen) {
    if (ev.kind === 'text') out += ev.text ?? ''
    else if (ev.kind === 'error') throw ev.error ?? new UpstreamError(502, 'upstream stream error')
    else if (ev.kind === 'done') break
  }
  return out
}
