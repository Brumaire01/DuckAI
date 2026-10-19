/**
 * 网关路由装配。
 *
 * 挂载在 cf-admin 同一个 Worker 上：
 *   GET  /health                       健康检查（无需密钥）
 *   GET  /v1/models                    模型目录
 *   GET  /v1/models/:id                单个模型
 *   POST /v1/chat/completions          OpenAI Chat Completions
 *   POST /v1/messages                  Anthropic Messages
 *   POST /v1/messages/count_tokens     Anthropic token 估算
 *   POST /v1/responses                 OpenAI Responses
 *
 * 鉴权复用后台「密钥管理」生成的密钥（KV 前缀 key:），同时支持
 * `Authorization: Bearer <key>` 与 `x-api-key: <key>` 两种写法。
 */
import { Hono } from 'hono'
import { getClient } from '../duck/client'
import { authenticate } from './auth'
import { errorResponse, type Proto } from './common'
import { handleChatCompletions } from './openai'
import { handleCountTokens, handleMessages } from './anthropic'
import { handleResponses } from './responses'
import { warmupSolver } from '../duck/quickjs'

/** 网关绑定（与后台共用同一个 KV）。 */
export type GatewayEnv = {
  Bindings: { KV: KVNamespace }
  Variables: { apiKey: unknown }
}

const gateway = new Hono<GatewayEnv>()

// ==================== 并发闸门 ====================

/** 同一 isolate 内的在途请求数（Workers 没有跨实例共享，够用）。 */
let inflight = 0

function acquire(max: number): boolean {
  if (inflight >= max) return false
  inflight++
  return true
}

function release(): void {
  if (inflight > 0) inflight--
}

/** 包一层并发限制。 */
function gated(proto: Proto, handler: (c: any) => Promise<Response>) {
  return async (c: any) => {
    const max = getClient(c.env).cfg.maxConcurrency
    if (!acquire(max)) {
      return errorResponse(proto, 429, 'rate_limit_exceeded', '网关并发已满，请稍后重试', 1)
    }
    try {
      return await handler(c)
    } finally {
      release()
    }
  }
}

// ==================== 中间件 ====================

/** 从路径判断客户端协议族（只影响错误体形状）。 */
function detectProto(path: string): Proto {
  if (path.startsWith('/v1/messages')) return 'anthropic'
  if (path.startsWith('/v1/responses')) return 'responses'
  return 'openai'
}

// CORS：允许浏览器直连（SDK 走服务端时用不到，但本地调试很方便）
gateway.use('*', async (c, next) => {
  const headers: Record<string, string> = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers':
      'Authorization, Content-Type, x-api-key, anthropic-version, anthropic-beta, OpenAI-Beta',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
  }
  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  await next()
  for (const [k, v] of Object.entries(headers)) c.res.headers.set(k, v)
})

// 密钥校验：所有 /v1 端点都要求后台签发的有效密钥
gateway.use('/v1/*', async (c, next) => {
  const proto = detectProto(c.req.path)
  const result = await authenticate(c)
  if (!result.ok) {
    const message =
      result.reason === 'missing'
        ? '缺少 API 密钥：请使用 Authorization: Bearer <密钥> 或 x-api-key: <密钥>（密钥在后台「密钥管理」中生成）'
        : result.reason === 'disabled'
          ? '该 API 密钥已被禁用'
          : '无效的 API 密钥：请确认该密钥由后台「密钥管理」生成且未被删除'
    return errorResponse(proto, 401, 'invalid_api_key', message)
  }
  c.set('apiKey', result.key)
  await next()
})

// ==================== 基础端点 ====================

gateway.get('/health', async (c) => {
  const client = getClient(c.env)
  // 顺手把 QuickJS 引擎预热掉，让首个真实请求少等一次冷启动
  c.executionCtx?.waitUntil?.(warmupSolver())
  const { info, error } = await client.health()
  const payload = { status: error ? 'degraded' : 'ok', upstream: info, error: error?.message }
  return new Response(JSON.stringify(payload), {
    status: error ? 503 : 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
})

gateway.get('/v1/models', async (c) => {
  const client = getClient(c.env)
  const models = await client.listModels()
  const data = models.map((m) => ({ id: m.id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: m.ownedBy }))
  return new Response(JSON.stringify({ object: 'list', data }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
})

gateway.get('/v1/models/:id', async (c) => {
  const client = getClient(c.env)
  const id = c.req.param('id')
  const models = await client.listModels()
  const hit = models.find((m) => m.id === id)
  if (!hit) return errorResponse('openai', 404, 'model_not_found', '模型不存在：' + id)
  return new Response(
    JSON.stringify({ id: hit.id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: hit.ownedBy }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
})

// ==================== 三协议端点 ====================

gateway.post('/v1/chat/completions', gated('openai', handleChatCompletions))
gateway.post('/v1/messages', gated('anthropic', handleMessages))
gateway.post('/v1/messages/count_tokens', handleCountTokens)
gateway.post('/v1/responses', gated('responses', handleResponses))

export default gateway
