/**
 * OpenAI Chat Completions 协议（/v1/chat/completions）。
 */
import type { Context } from 'hono'
import { getClient } from '../duck/client'
import { collectStream } from '../duck/sse'
import {
  ROLE_ASSISTANT,
  ROLE_USER,
  type DuckEvent,
  type Message,
} from '../duck/types'
import {
  dataFrame,
  errorResponse,
  estimateTokens,
  failResponse,
  jsonString,
  messagesTokens,
  newID,
  nowUnix,
  readJSON,
  sseResponse,
} from './common'

// ==================== 请求形状 ====================

interface ContentPart {
  type?: string
  text?: string
  image_url?: { url?: string }
}

interface OAIMessage {
  role?: string
  content?: unknown
  name?: string
  tool_call_id?: string
}

interface OAIRequest {
  model?: string
  messages?: OAIMessage[]
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  max_tokens?: number
  max_completion_tokens?: number
  reasoning_effort?: string
  user?: string
  tools?: unknown
  tool_choice?: unknown
}

/** content 兼容字符串与内容块数组两种写法。 */
function parseContent(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    let out = ''
    for (const p of raw as ContentPart[]) {
      switch (p?.type) {
        case 'text':
        case 'input_text':
        case 'output_text':
          out += p.text ?? ''
          break
        case 'image_url':
        case 'input_image':
          out += '[image]'
          break
      }
    }
    return out
  }
  return ''
}

/** 把 OpenAI 消息数组扁平化成上游可接受的两态消息。 */
function toMessages(inbox: OAIMessage[]): Message[] {
  const out: Message[] = []
  for (const m of inbox) {
    const text = parseContent(m?.content)
    switch (m?.role) {
      case 'system':
      case 'developer':
        if (!text) continue
        out.push({ role: ROLE_USER, text: '[System]: ' + text })
        break
      case 'assistant':
        if (!text) continue
        out.push({ role: ROLE_ASSISTANT, text })
        break
      case 'tool':
      case 'function': {
        const label = m.tool_call_id ? `[tool_result ${m.tool_call_id}]` : '[tool_result]'
        out.push({ role: ROLE_USER, text: label + ': ' + text })
        break
      }
      default:
        if (!text) continue
        out.push({ role: ROLE_USER, text })
    }
  }
  return out
}

/** 会话粘性指纹（new_chat=true 时上游不会用到）。 */
export async function sessionHint(user: string | undefined, msgs: Message[]): Promise<string> {
  if (user) return 'user:' + user
  for (const m of msgs) {
    if (m.role === ROLE_USER) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m.text))
      const hex = Array.from(new Uint8Array(digest).subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
      return 'first:' + hex
    }
  }
  return ''
}

// ==================== 处理 ====================

export async function handleChatCompletions(c: Context<any>): Promise<Response> {
  const req = await readJSON<OAIRequest>(c.req.raw)
  if (!req) return errorResponse('openai', 400, 'invalid_request_error', '请求体不是合法 JSON')

  const msgs = toMessages(req.messages ?? [])
  if (!msgs.length) return errorResponse('openai', 400, 'invalid_request_error', 'messages 不能为空')

  const client = getClient(c.env)
  const model = client.resolveModel(req.model)
  const promptTokens = messagesTokens(msgs)

  let stream: AsyncGenerator<DuckEvent>
  try {
    stream = await client.chat({
      model,
      messages: msgs,
      sessionHint: await sessionHint(req.user, msgs),
      reasoningEffort: req.reasoning_effort ?? '',
    })
  } catch (e) {
    return failResponse('openai', e)
  }

  if (req.stream) {
    return sseResponse(streamOpenAI(model, stream, Boolean(req.stream_options?.include_usage), promptTokens))
  }

  let text: string
  try {
    text = await collectStream(stream)
  } catch (e) {
    return failResponse('openai', e)
  }

  const completionTokens = estimateTokens(text)
  return new Response(
    JSON.stringify({
      id: newID('chatcmpl-'),
      object: 'chat.completion',
      created: nowUnix(),
      model,
      choices: [
        { index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop', logprobs: null },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

/** OpenAI Chat Completions 的 SSE 帧序列。 */
async function* streamOpenAI(
  model: string,
  st: AsyncGenerator<DuckEvent>,
  includeUsage: boolean,
  promptTokens: number,
): AsyncGenerator<string> {
  const id = newID('chatcmpl-')
  const created = nowUnix()
  const chunk = (delta: Record<string, unknown>, finish: string | null) => ({
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  })

  // 首帧只带 role，符合 OpenAI 客户端预期
  yield dataFrame(jsonString(chunk({ role: 'assistant', content: '' }, null)))

  let text = ''
  for await (const ev of st) {
    if (ev.kind === 'text') {
      text += ev.text ?? ''
      yield dataFrame(jsonString(chunk({ content: ev.text }, null)))
    } else if (ev.kind === 'reasoning') {
      yield dataFrame(jsonString(chunk({ reasoning_content: ev.text }, null)))
    } else if (ev.kind === 'error') {
      yield dataFrame(
        jsonString({
          error: {
            message: ev.error?.message ?? 'upstream error',
            type: 'upstream_error',
            code: 'upstream_error',
          },
        }),
      )
      yield dataFrame('[DONE]')
      return
    } else if (ev.kind === 'done') {
      break
    }
  }

  yield dataFrame(jsonString(chunk({}, 'stop')))

  if (includeUsage) {
    const completionTokens = estimateTokens(text)
    yield dataFrame(
      jsonString({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      }),
    )
  }

  yield dataFrame('[DONE]')
}
