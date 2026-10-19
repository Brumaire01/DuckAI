/**
 * 网关运行时配置。
 *
 * 全部字段都有安全默认值：即使 wrangler.jsonc 里一个变量都不配，网关也能直接跑。
 * 需要覆盖时在 wrangler.jsonc 的 `vars` 里加同名环境变量即可（见文件末尾的映射表）。
 */

/** 线上实测被接受的 Chrome 桌面 UA（同时决定 VQD 里 SHA256(UA) 的取值）。 */
export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

/** sec-ch-ua 需要与 UA 的主版本号保持一致。 */
export const SEC_CH_UA = '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"'

/** 挑战 meta.stack 默认值：指向真实 entry bundle 的调用栈形态。 */
export const DEFAULT_STACK =
  'Error\nat l (https://duck.ai/dist/duckai-dist/entry.duckai.87327f5a205aed4d67bc.js:2:2099529)\nat async https://duck.ai/dist/duckai-dist/entry.duckai.87327f5a205aed4d67bc.js:2:1838701'

/** 2026-10 线上抓包中的固定同意/续传/工具审批头。 */
export const CONSENT_PURPOSES = 'user-location,image-generation,web-search'
export const CONTINUATION = 'resubmit-context'
export const TOOL_APPROVAL = 'web-search'

/** 网关配置。 */
export interface GatewayConfig {
  /** 上游根地址。 */
  baseUrl: string
  /** 未指定模型时的回落模型。 */
  defaultModel: string
  userAgent: string
  /** 默认推理强度（请求里带了 reasoning_effort 时以请求为准）。 */
  reasoningEffort: string
  /** 是否向上游声明可用工具。 */
  canUseTools: boolean
  /** VQD 令牌缓存秒数。 */
  vqdCacheSecs: number
  /** 模型目录缓存秒数。 */
  modelsCacheSecs: number
  /** 固定 x-fe-version（留空则每次从首页抓）。 */
  feVersion: string
  /** 固定 VQD 令牌（调试用，留空则正常求解）。 */
  vqdOverride: string
  /** 挑战 meta.stack 覆盖值。 */
  vqdStack: string
  /** true 时每次请求都用新的 conversationId。 */
  newChat: boolean
  /** 模型别名表。 */
  modelAliases: Record<string, string>
  /** 单请求上游超时（毫秒）。 */
  requestTimeoutMs: number
  /** 同一 isolate 内的并发上限。 */
  maxConcurrency: number
}

/** 模型别名默认表：把常见 OpenAI/Anthropic 模型名映射到上游真实可用模型。 */
const DEFAULT_ALIASES: Record<string, string> = {
  'gpt-4o': 'gpt-5.6-luna',
  'gpt-4o-mini': 'gpt-5.4-mini',
  'gpt-4-turbo': 'gpt-5.6-luna',
  // claude-sonnet-4-6 / claude-opus-4-8 在上游是 ERR_MODEL_RESTRICTED，
  // 只有 haiku 实测可用，所以旧版 claude 名称统一映射到它。
  // 注意：不把上游真实 ID 本身写进别名表，否则用户点名 sonnet 会被静默降级成 haiku。
  'claude-3-5-sonnet': 'claude-haiku-4-5',
  'claude-sonnet-4-5': 'claude-haiku-4-5',
  'claude-3-opus': 'claude-haiku-4-5',
}

/** 从环境变量读取布尔值。 */
function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase())
}

/** 从环境变量读取整数。 */
function envInt(v: string | undefined, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 载入配置：环境变量优先，其次内置默认值。
 *
 * 支持的变量：
 *   DUCK_BASE_URL / DUCK_DEFAULT_MODEL / DUCK_USER_AGENT / DUCK_REASONING_EFFORT
 *   DUCK_CAN_USE_TOOLS / DUCK_VQD_CACHE_SECS / DUCK_MODELS_CACHE_SECS
 *   DUCK_FE_VERSION / DUCK_VQD_OVERRIDE / DUCK_VQD_STACK / DUCK_NEW_CHAT
 *   DUCK_MAX_CONCURRENCY / DUCK_REQUEST_TIMEOUT_MS
 */
export function loadConfig(env: Record<string, unknown> = {}): GatewayConfig {
  const str = (k: string) => {
    const v = env[k]
    return typeof v === 'string' ? v.trim() : ''
  }
  return {
    baseUrl: (str('DUCK_BASE_URL') || 'https://duck.ai').replace(/\/+$/, ''),
    defaultModel: str('DUCK_DEFAULT_MODEL') || 'gpt-6-luna',
    userAgent: str('DUCK_USER_AGENT') || DEFAULT_UA,
    reasoningEffort: str('DUCK_REASONING_EFFORT') || 'low',
    canUseTools: envBool(str('DUCK_CAN_USE_TOOLS'), false),
    vqdCacheSecs: envInt(str('DUCK_VQD_CACHE_SECS'), 300),
    modelsCacheSecs: envInt(str('DUCK_MODELS_CACHE_SECS'), 1800),
    feVersion: str('DUCK_FE_VERSION'),
    vqdOverride: str('DUCK_VQD_OVERRIDE'),
    vqdStack: str('DUCK_VQD_STACK'),
    newChat: envBool(str('DUCK_NEW_CHAT'), true),
    modelAliases: { ...DEFAULT_ALIASES },
    requestTimeoutMs: envInt(str('DUCK_REQUEST_TIMEOUT_MS'), 300_000),
    maxConcurrency: envInt(str('DUCK_MAX_CONCURRENCY'), 8),
  }
}
