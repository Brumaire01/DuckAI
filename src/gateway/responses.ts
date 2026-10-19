/**
 * OpenAI Responses 协议（/v1/responses）。
 */
import type { Context } from 'hono'
import { getClient } from '../duck/client'
import { collectStream } from '../duck/sse'
import { ROLE_ASSISTANT, ROLE_USER, type DuckEvent, type Message } from '../duck/types'
import {
  errorResponse,
  estimateTokens,
  eventFrame,
  failResponse,
  jsonString,
  mapError,
  messagesTokens,
  newID,
  nowUnix,
  readJSON,
  sseResponse,
} from './common'
import { sessionHint } from './openai'

// ==================== 请求形状 ====================

interface ContentPart {
  type?: string
  text?: string
}

interface ResponsesItem {
  type?: string
  role?: string
  content?: unknown
  call_id?: string
  name?: string
  arguments?: string
  output?: unknown
}

interface ResponsesRequest {
  model?: string
  input?: unknown
  instructions?: string
  stream?: boolean
  max_output_tokens?: number
  reasoning?: { effort?: string }
  user?: string
  tools?: unknown
}

/** 解析 content（字符串或内容块数组）。 */
function parseContent(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    let out = ''
    for (const p of raw as ContentPart[]) {
      switch (p?.type) {
        case 'input_text':
        case 'output_text':
        case 'text':
          out += p.text ?? ''
          break
        case 'input_image':
        case 'image':
          out += '[image]'
          break
      }
    }
    return out
  }
  return ''
}

/** 把 Responses 的 input（字符串或 item 数组）折叠成上游消息。 */
function toMessages(instructions: string | undefined, input: unknown): Message[] {
  const out: Message[] = []

  const ins = (instructions ?? '').trim()
  if (ins) out.push({ role: ROLE_USER, text: '[System]: ' + ins })
  if (input == null) return out

  if (typeof input === 'string') {
    if (input) out.push({ role: ROLE_USER, text: input })
    return out
  }
  if (!Array.isArray(input)) return out

  for (const item of input as ResponsesItem[]) {
    switch (item?.type) {
      case 'function_call_output': {
        const label = item.call_id ? `[tool_result ${item.call_id}]` : '[tool_result]'
        out.push({ role: ROLE_USER, text: label + ': ' + parseContent(item.output) })
        continue
      }
      case 'function_call':
        out.push({ role: ROLE_ASSISTANT, text: `[tool_use ${item.name}] ${item.arguments ?? ''}` })
        continue
      default:
        break
    }

    const body = parseContent(item?.content)
    if (!body) continue
    if (item.role === 'assistant') out.push({ role: ROLE_ASSISTANT, text: body })
    else if (item.role === 'system' || item.role === 'developer') out.push({ role: ROLE_USER, text: '[System]: ' + body })
    else out.push({ role: ROLE_USER, text: body })
  }
  return out
}

// ==================== 处理 ====================

export async function handleResponses(c: Context<any>): Promise<Response> {
  const req = await readJSON<ResponsesRequest>(c.req.raw)
  if (!req) return errorResponse('responses', 400, 'invalid_request_error', '请求体不是合法 JSON')

  const msgs = toMessages(req.instructions, req.input)
  if (!msgs.length) return errorResponse('responses', 400, 'invalid_request_error', 'input 不能为空')

  const client = getClient(c.env)
  const model = client.resolveModel(req.model)
  const promptTokens = messagesTokens(msgs)

  let stream: AsyncGenerator<DuckEvent>
  try {
    stream = await client.chat({
      model,
      messages: msgs,
      sessionHint: await sessionHint(req.user, msgs),
      reasoningEffort: req.reasoning?.effort ?? '',
    })
  } catch (e) {
    return failResponse('responses', e)
  }

  if (req.stream) return sseResponse(streamResponses(model, stream, promptTokens))

  let text: string
  try {
    text = await collectStream(stream)
  } catch (e) {
    return failResponse('responses', e)
  }

  const completionTokens = estimateTokens(text)
  return new Response(
    JSON.stringify({
      id: newID('resp_'),
      object: 'response',
      created_at: nowUnix(),
      status: 'completed',
      model,
      output: [
        {
          type: 'message',
          id: newID('msg_'),
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text, annotations: [] }],
        },
      ],
      usage: {
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

/** Responses API 的事件序列。 */
async function* streamResponses(
  model: string,
  st: AsyncGenerator<DuckEvent>,
  promptTokens: number,
): AsyncGenerator<string> {
  const respID = newID('resp_')
  const itemID = newID('msg_')
  const createdAt = nowUnix()

  const base = (status: string) => ({
    id: respID,
    object: 'response',
    created_at: createdAt,
    status,
    model,
    output: [] as unknown[],
    usage: null as unknown,
  })

  yield eventFrame('response.created', jsonString({ type: 'response.created', response: base('in_progress') }))
  yield eventFrame(
    'response.in_progress',
    jsonString({ type: 'response.in_progress', response: base('in_progress') }),
  )
  yield eventFrame(
    'response.output_item.added',
    jsonString({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: itemID, status: 'in_progress', role: 'assistant', content: [] },
    }),
  )
  yield eventFrame(
    'response.content_part.added',
    jsonString({
      type: 'response.content_part.added',
      item_id: itemID,
      output_index: 0,
      content_index: 0,
      part: { type: 'output_text', text: '', annotations: [] },
    }),
  )

  let text = ''
  for await (const ev of st) {
    if (ev.kind === 'text') {
      text += ev.text ?? ''
      yield eventFrame(
        'response.output_text.delta',
        jsonString({
          type: 'response.output_text.delta',
          item_id: itemID,
          output_index: 0,
          content_index: 0,
          delta: ev.text,
        }),
      )
    } else if (ev.kind === 'error') {
      const m = mapError(ev.error)
      const failed = { ...base('failed'), error: { code: m.code, message: m.message, status: m.status } }
      yield eventFrame('response.failed', jsonString({ type: 'response.failed', response: failed }))
      return
    } else if (ev.kind === 'done') {
      break
    }
  }

  yield eventFrame(
    'response.output_text.done',
    jsonString({
      type: 'response.output_text.done',
      item_id: itemID,
      output_index: 0,
      content_index: 0,
      text,
    }),
  )
  yield eventFrame(
    'response.content_part.done',
    jsonString({
      type: 'response.content_part.done',
      item_id: itemID,
      output_index: 0,
      content_index: 0,
      part: { type: 'output_text', text, annotations: [] },
    }),
  )
  yield eventFrame(
    'response.output_item.done',
    jsonString({
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'message',
        id: itemID,
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    }),
  )

  const completionTokens = estimateTokens(text)
  const completed = {
    ...base('completed'),
    output: [
      {
        type: 'message',
        id: itemID,
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
    usage: {
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  }
  yield eventFrame('response.completed', jsonString({ type: 'response.completed', response: completed }))
}
