/**
 * 网关鉴权：直接复用后台「密钥管理」里生成的密钥（KV 前缀 `key:`）。
 *
 * KV 里没有「按值反查」的能力，所以这里把整个 key: 前缀读进内存做反查表，
 * 并缓存 60 秒（新增/删除密钥后最多 1 分钟生效，避免每个请求都全表扫一遍）。
 */
import type { Context } from 'hono'

/** 后台密钥管理页写入的 KV 记录形状。 */
export interface KeyRecord {
  id: string
  name: string
  value: string
  description?: string
  status?: string
  createdAt?: number
}

/** 鉴权结果。 */
export type AuthResult =
  | { ok: true; key: KeyRecord }
  | { ok: false; reason: 'missing' | 'invalid' | 'disabled' }

const CACHE_TTL_MS = 30_000

let cache: { at: number; map: Map<string, KeyRecord> } | undefined

/** 清空密钥缓存（后台增删密钥后可主动调用）。 */
export function invalidateKeyCache(): void {
  cache = undefined
}

/** 读出 key: 前缀下的全部记录并建立 value → record 反查表。 */
async function keyMap(kv: KVNamespace): Promise<Map<string, KeyRecord>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map

  const map = new Map<string, KeyRecord>()
  const { keys } = await kv.list({ prefix: 'key:' })
  const raws = await Promise.all(keys.map((k) => kv.get(k.name)))
  for (const raw of raws) {
    if (!raw) continue
    try {
      const rec = JSON.parse(raw) as KeyRecord
      const value = (rec?.value ?? '').trim()
      if (value) map.set(value, rec)
    } catch {
      /* 单条脏数据不影响整体 */
    }
  }
  cache = { at: Date.now(), map }
  return map
}

/** 从请求里取出候选密钥：Authorization: Bearer / x-api-key / ?api_key=。 */
export function extractToken(c: Context<any>): string {
  const auth = (c.req.header('authorization') ?? '').trim()
  if (auth) {
    const m = /^bearer\s+(.+)$/i.exec(auth)
    return (m ? m[1] : auth).trim()
  }
  const xApiKey = (c.req.header('x-api-key') ?? '').trim()
  if (xApiKey) return xApiKey
  return (c.req.query('api_key') ?? '').trim()
}

/** 校验请求携带的密钥是否在后台密钥表中且状态有效。 */
export async function authenticate(c: Context<any>): Promise<AuthResult> {
  const token = extractToken(c)
  if (!token) return { ok: false, reason: 'missing' }

  const map = await keyMap(c.env.KV as KVNamespace)
  const record = map.get(token)
  if (!record) return { ok: false, reason: 'invalid' }
  if ((record.status ?? '有效') === '禁用') return { ok: false, reason: 'disabled' }
  return { ok: true, key: record }
}
