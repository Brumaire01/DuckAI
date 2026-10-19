import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { getClient } from './duck/client'
import { annotateModels } from './duck/models'
import { invalidateKeyCache } from './gateway/auth'

/** 应用环境类型：KV 绑定 + 上下文变量（登录用户名） */
export type Env = {
  Bindings: { KV: KVNamespace }
  Variables: { loginUser: string }
}

// ==================== 工具函数 ====================

const genId = () => crypto.randomUUID().replace(/-/g, '')
const SESSION_TTL = 60 * 60 * 24 * 7

async function ensureDefaultAdmin(kv: KVNamespace) {
  const key = 'admin:admin'
  if (!(await kv.get(key))) {
    await kv.put(key, JSON.stringify({ username: 'admin', password: 'admin123' }))
  }
}

async function findAccount(kv: KVNamespace, username: string) {
  const aRaw = await kv.get('admin:' + username)
  if (aRaw) return { source: 'admin' as const, key: 'admin:' + username, data: JSON.parse(aRaw) as any }
  const { keys } = await kv.list({ prefix: 'user:' })
  for (const k of keys) {
    const raw = await kv.get(k.name)
    if (!raw) continue
    const u = JSON.parse(raw)
    if (u.username === username) return { source: 'user' as const, key: k.name, data: u }
  }
  return null
}

async function getLoginUser(c: any): Promise<string | null> {
  const token = getCookie(c, 'session')
  return token ? ((await c.env.KV.get('session:' + token)) ?? null) : null
}

async function authGuard(c: any, next: any) {
  const user = await getLoginUser(c)
  if (!user) return c.json({ ok: false, msg: '未登录或登录已过期' }, 401)
  c.set('loginUser', user)
  await next()
}

/** 列出某前缀下的 KV 记录，支持关键字模糊搜索，按创建时间倒序（并行读取提升效率） */
async function listByPrefix(kv: KVNamespace, prefix: string, keyword = '') {
  const { keys } = await kv.list({ prefix })
  const items = (await Promise.all(keys.map((k) => kv.get(k.name))))
    .filter((raw): raw is string => !!raw)
    .map((raw) => JSON.parse(raw))
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  if (!keyword) return items
  const kw = keyword.toLowerCase()
  return items.filter((it) => JSON.stringify(it).toLowerCase().includes(kw))
}

// ==================== API 路由 ====================

const router = new Hono<Env>()

// ---- 公开接口（无需登录） ----

router.post('/login', async (c) => {
  await ensureDefaultAdmin(c.env.KV)
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  const account = await findAccount(c.env.KV, username)
  if (!account) return c.json({ ok: false, msg: '账号或密码错误' }, 400)
  if (account.source === 'user' && account.data.status === '禁用')
    return c.json({ ok: false, msg: '该账号已被禁用' }, 400)
  if (account.data.password !== password)
    return c.json({ ok: false, msg: '账号或密码错误' }, 400)

  const token = genId()
  await c.env.KV.put('session:' + token, username, { expirationTtl: SESSION_TTL })
  const isHttps = new URL(c.req.url).protocol === 'https:'
  setCookie(c, 'session', token, {
    httpOnly: true, secure: isHttps, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL,
  })
  return c.json({ ok: true, msg: '登录成功' })
})

router.post('/logout', async (c) => {
  const token = getCookie(c, 'session')
  if (token) await c.env.KV.delete('session:' + token)
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})

// ---- 以下接口均需登录鉴权 ----
router.use('*', authGuard)

router.post('/change-password', async (c) => {
  const username = c.get('loginUser')
  const { oldPassword, newPassword } = await c.req.json<{ oldPassword: string; newPassword: string }>()
  if (!newPassword || newPassword.length < 6) return c.json({ ok: false, msg: '新密码至少 6 位' }, 400)
  const account = await findAccount(c.env.KV, username)
  if (!account) return c.json({ ok: false, msg: '账号不存在' }, 400)
  if (account.data.password !== oldPassword) return c.json({ ok: false, msg: '原密码错误' }, 400)
  account.data.password = newPassword
  await c.env.KV.put(account.key, JSON.stringify(account.data))
  return c.json({ ok: true, msg: '密码修改成功' })
})

// ---- 仪表看板 ----
router.get('/dashboard', async (c) => {
  const [users, keys, admins] = await Promise.all([
    c.env.KV.list({ prefix: 'user:' }),
    c.env.KV.list({ prefix: 'key:' }),
    c.env.KV.list({ prefix: 'admin:' }),
  ])
  return c.json({
    ok: true,
    data: {
      userCount: users.keys.length, keyCount: keys.keys.length, adminCount: admins.keys.length,
      loginUser: c.get('loginUser'), serverTime: new Date().toISOString(),
    },
  })
})

// ---- 列表 / 创建 通用工厂（用户、密钥共用） ----
const listHandler = (prefix: string, transform?: (item: any) => any) => async (c: any) => {
  const kw = c.req.query('kw') || ''
  let list = await listByPrefix(c.env.KV, prefix, kw)
  if (transform) list = list.map(transform)
  return c.json({ ok: true, data: list })
}

const createHandler = (prefix: string, build: (body: any, id: string, prev?: any) => any) => async (c: any) => {
  const body: any = await c.req.json()
  const id = body.id || genId()
  let prev: any | undefined
  if (body.id) {
    const old = await c.env.KV.get(prefix + id)
    if (old) prev = JSON.parse(old)
  }
  const record = build(body, id, prev)
  await c.env.KV.put(prefix + id, JSON.stringify(record))
  return c.json({ ok: true, data: record })
}

const deleteHandler = (prefix: string) => async (c: any) => {
  await c.env.KV.delete(prefix + c.req.param('id'))
  return c.json({ ok: true })
}

// ---- 用户管理 ----
router.get('/users', listHandler('user:', ({ password, ...rest }: any) => ({ ...rest, hasPassword: !!password })))

router.post('/users', createHandler('user:', (b, id, prev) => ({
  id, username: b.username || '',
  password: b.password || prev?.password || '',
  email: b.email || '', role: b.role || '普通用户',
  status: b.status || '启用', createdAt: b.createdAt || Date.now(),
})))

router.delete('/users/:id', deleteHandler('user:'))

// ---- 密钥管理 ----
router.get('/keys', listHandler('key:'))

// 密钥是网关的鉴权来源，增删后必须立刻让网关侧的反查缓存失效，
// 否则刚生成的密钥要等缓存过期才能用。
// 注意：编辑（带 id）时必须沿用旧 value，否则改个名字就会把密钥换掉，
// 已接入的调用方会全部 401。
const createKey = createHandler('key:', (b, id, prev) => ({
  id, name: b.name || prev?.name || '',
  value: b.value || prev?.value || 'sk-' + genId(),
  description: b.description ?? prev?.description ?? '',
  status: b.status || prev?.status || '有效',
  createdAt: prev?.createdAt || b.createdAt || Date.now(),
}))

const deleteKey = deleteHandler('key:')

router.post('/keys', async (c) => {
  const res = await createKey(c)
  invalidateKeyCache()
  return res
})

router.delete('/keys/:id', async (c) => {
  const res = await deleteKey(c)
  invalidateKeyCache()
  return res
})

// ---- 中转网关（控制台「网关」页用） ----
router.get('/gateway/status', async (c) => {
  const client = getClient(c.env as unknown as Record<string, unknown>)
  const { info, error } = await client.health()
  const models = await client.listModels()
  return c.json({
    ok: true,
    data: {
      baseUrl: new URL(c.req.url).origin,
      healthy: !error,
      error: error?.message ?? null,
      upstream: info,
      defaultModel: client.cfg.defaultModel,
      // 控制台要展示模型 ID 本身，所以这里给完整对象（id + ownedBy + 实测可用性），
      // 不再只回 id 字符串。
      models: annotateModels(models),
    },
  })
})

export { getLoginUser }
export default router
