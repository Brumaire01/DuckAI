import { Hono } from 'hono'
import apiRoutes, { getLoginUser, type Env } from './routes'
import { loginTemplate, consoleTemplate, faviconSvg } from './templates'
import gateway from './gateway'

const app = new Hono<Env>()

// ======== Favicon ========
app.get('/favicon.svg', () =>
  new Response(faviconSvg, { headers: { 'Content-Type': 'image/svg+xml' } })
)

// ======== 忽略 Chrome DevTools 自动探测（非本站所需，仅消除 404 日志） ========
app.get('/.well-known/appspecific/com.chrome.devtools.json', (c) => c.body(null, 204))

// ======== 页面路由 ========
app.get('/', async (c) => {
  const user = await getLoginUser(c)
  if (user) return c.redirect('/console')
  return c.html(loginTemplate)
})

app.get('/console', async (c) => {
  const user = await getLoginUser(c)
  if (!user) return c.redirect('/')
  return c.html(consoleTemplate)
})

// ======== 后台管理 API ========
app.route('/api', apiRoutes)

// ======== Duck.ai 中转网关（/health、/v1/*） ========
app.route('/', gateway)

export default {
  fetch: (req: Request, env: Env['Bindings'], ctx: ExecutionContext) => app.fetch(req, env, ctx),
}
