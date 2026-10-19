/**
 * Anthropic Messages 协议（/v1/messages、/v1/messages/count_tokens）。
 */
import type { Context } from 'hono'
import { getClient } from '../duck/client'
import { collectStream } from '../duck/sse'
import { ROLE_ASSISTANT, ROLE_USER, type DuckEvent, type Message } from '../duck/types'
import {
  anthropicErrorType,
  errorResponse,
  estimateTokens,
  eventFrame,
  failResponse,
  jsonString,
  mapError,
  messagesTokens,
  newID,
  readJSON,
  sseResponse,
} from './common'
import { sessionHint } from './openai'

// ==================== 请求形状 ====================

interface Block {
  type?: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
}

interface AnthropicMessage {
  role?: string
  content?: unknown
}

interface AnthropicRequest {
  model?: string
  max_tokens?: number
  system?: unknown
  messages?: AnthropicMessage[]
  stream?: boolean
  temperature?: number
  metadata?: { user_id?: string }
  tools?: unknown
}

/** 解析 string 或 content block 数组形式的文本内容。 */
function parseText(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    let out = ''
    for (const blk of raw as Block[]) {
      switch (blk?.type) {
        case 'text':
          out += blk.text ?? ''
          break
        case 'image':
          out += '[image]'
          break
        case 'document':
          out += '[document]'
          break
        case 'tool_result':
          out += parseText(blk.content)
          break
      }
    }
    return out
  }
  return ''
}

/** 把 Anthropic 消息折叠成上游两态消息。 */
function toMessages(system: unknown, inbox: AnthropicMessage[]): Message[] {
  const out: Message[] = []

  const sys = parseText(system).trim()
  if (sys) out.push({ role: ROLE_USER, text: '[System]: ' + sys })

  for (const m of inbox) {
    let text = ''
    if (Array.isArray(m?.content)) {
      const parts: string[] = []
      for (const blk of m.content as Block[]) {
        switch (blk?.type) {
          case 'text':
            parts.push(blk.text ?? '')
            break
          case 'image':
            parts.push('[image]')
            break
          case 'tool_use':
            parts.push(`[tool_use ${blk.name}] ${blk.input ? JSON.stringify(blk.input) : '{}'}`)
            break
          case 'tool_result': {
            const label = blk.tool_use_id ? `[tool_result ${blk.tool_use_id}]` : '[tool_result]'
            parts.push(label + ': ' + parseText(blk.content))
            break
          }
        }
      }
      text = parts.join('\n')
    } else {
      text = parseText(m?.content)
    }

    if (!text) continue
    out.push({ role: m?.role === 'assistant' ? ROLE_ASSISTANT : ROLE_USER, text })
  }
  return out
}

// ==================== 处理 ====================

export async function handleMessages(c: Context<any>): Promise<Response> {
  const req = await readJSON<AnthropicRequest>(c.req.raw)
  if (!req) return errorResponse('anthropic', 400, 'invalid_request_error', '请求体不是合法 JSON')

  const msgs = toMessages(req.system, req.messages ?? [])
  if (!msgs.length) return errorResponse('anthropic', 400, 'invalid_request_error', 'messages 不能为空')

  const client = getClient(c.env)
  const model = client.resolveModel(req.model)
  const promptTokens = messagesTokens(msgs)

  let stream: AsyncGenerator<DuckEvent>
  try {
    stream = await client.chat({
      model,
      messages: msgs,
      sessionHint: await sessionHint(req.metadata?.user_id, msgs),
    })
  } catch (e) {
    return failResponse('anthropic', e)
  }

  if (req.stream) return sseResponse(streamAnthropic(model, stream, promptTokens))

  let text: string
  try {
    text = await collectStream(stream)
  } catch (e) {
    return failResponse('anthropic', e)
  }

  return new Response(
    JSON.stringify({
      id: newID('msg_'),
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: promptTokens, output_tokens: estimateTokens(text) },
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

/** Anthropic Messages 的事件序列。 */
async function* streamAnthropic(
  model: string,
  st: AsyncGenerator<DuckEvent>,
  promptTokens: number,
): AsyncGenerator<string> {
  const id = newID('msg_')

  yield eventFrame(
    'message_start',
    jsonString({
      type: 'message_start',
      message: {
        id,
        type: 'message',
        role: 'assistant',
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: promptTokens, output_tokens: 0 },
      },
    }),
  )
  yield eventFrame(
    'content_block_start',
    jsonString({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
  )
  yield eventFrame('ping', '{"type":"ping"}')

  let text = ''
  for await (const ev of st) {
    if (ev.kind === 'text') {
      text += ev.text ?? ''
      yield eventFrame(
        'content_block_delta',
        jsonString({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: ev.text },
        }),
      )
    } else if (ev.kind === 'error') {
      const m = mapError(ev.error)
      yield eventFrame(
        'error',
        jsonString({
          type: 'error',
          error: { type: anthropicErrorType(m.status), message: `${m.message} (${m.code})` },
        }),
      )
      return
    } else if (ev.kind === 'done') {
      break
    }
  }

  yield eventFrame('content_block_stop', jsonString({ type: 'content_block_stop', index: 0 }))
  yield eventFrame(
    'message_delta',
    jsonString({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: estimateTokens(text) },
    }),
  )
  yield eventFrame('message_stop', '{"type":"message_stop"}')
}

/** Anthropic 客户端的 token 估算（不计费、不请求上游）。 */
export async function handleCountTokens(c: Context<any>): Promise<Response> {
  const req = await readJSON<AnthropicRequest>(c.req.raw)
  if (!req) return errorResponse('anthropic', 400, 'invalid_request_error', '请求体不是合法 JSON')
  const msgs = toMessages(req.system, req.messages ?? [])
  return new Response(JSON.stringify({ input_tokens: messagesTokens(msgs) }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
