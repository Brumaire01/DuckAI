/**
 * 模型可用性标注。
 *
 * 上游 `/duckchat/v1/models` 返回的目录里，并不是每个模型都能真正调用：
 * 一部分受账号/区域策略限制（`ERR_MODEL_RESTRICTED`），一部分被上游风控
 * （`upstream_banned`）。这里维护一份**实测结论**，只用于后台展示与推荐，
 * 不影响 `/v1/models` 的标准返回结构。
 *
 * 实测时间：2026-10-19（gpt-6-luna 账号，逐模型单发一次 chat 请求）。
 * 上游策略会变，改动后重跑 `node test/model-probe.mjs` 再更新本表。
 */
import type { ModelInfo } from './types'

export type ModelState = 'ok' | 'restricted' | 'banned' | 'unknown'

export interface ModelAvailability {
  state: ModelState
  /** 展示用说明（限制原因 / 实测表现）。 */
  note: string
}

/** 实测结论表。未收录的模型按 `unknown` 处理。 */
const AVAILABILITY: Record<string, ModelAvailability> = {
  'gpt-6-luna': { state: 'ok', note: '默认模型，实测最快最稳' },
  'gpt-5.6-luna': { state: 'ok', note: '实测可用' },
  'gpt-5.4-mini': { state: 'ok', note: '轻量快，实测可用' },
  'claude-haiku-4-5': { state: 'ok', note: '实测可用（响应略慢）' },
  'mistral-small-2603': { state: 'ok', note: '实测可用' },
  'gpt-5.6-terra': { state: 'restricted', note: 'ERR_MODEL_RESTRICTED，需登录或受区域限制' },
  'gpt-5.6-sol': { state: 'restricted', note: 'ERR_MODEL_RESTRICTED，需登录或受区域限制' },
  'claude-sonnet-4-6': { state: 'restricted', note: 'ERR_MODEL_RESTRICTED，需登录或受区域限制' },
  'claude-opus-4-8': { state: 'restricted', note: 'ERR_MODEL_RESTRICTED，需登录或受区域限制' },
  'tinfoil/gpt-oss-120b': { state: 'banned', note: '上游风控拦截（429 upstream_banned）' },
  'tinfoil/gemma4-31b': { state: 'banned', note: '上游风控拦截（429 upstream_banned）' },
}

/** 排序权重：可用的排前面，避免用户先点到不可用的模型。 */
const ORDER: Record<ModelState, number> = { ok: 0, unknown: 1, restricted: 2, banned: 3 }

/** 给模型目录补上可用性字段并按可用性排序。 */
export function annotateModels(models: ModelInfo[]): (ModelInfo & ModelAvailability)[] {
  return models
    .map((m) => ({ ...m, ...(AVAILABILITY[m.id] ?? { state: 'unknown' as ModelState, note: '未实测' }) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.id.localeCompare(b.id))
}

/** 当前实测可用的模型 id（供后台提示、别名映射参考）。 */
export function usableModelIds(): string[] {
  return Object.keys(AVAILABILITY).filter((id) => AVAILABILITY[id].state === 'ok')
}
