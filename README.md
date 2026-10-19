# cf-admin · Cloudflare Workers 后台 + Duck.ai 三协议中转网关

一个跑在 **Cloudflare Workers** 上的后台管理系统（Hono + KV），同时内置以 **Duck.ai** 为上游的
**OpenAI / Anthropic / Responses 三协议中转网关**。后台与网关共用一个 Worker、一个 KV，
网关鉴权直接用后台「密钥管理」里生成的 `sk-...` 密钥——**不用另外维护一套 key**。

> 一句话：部署一次，你就同时得到一个可视化管理后台，和一个能用 Claude Code / OpenAI SDK /
> Anthropic SDK 直接接入的 LLM 接口。

## 特性

- **三协议兼容**：OpenAI Chat Completions、Anthropic Messages、OpenAI Responses，均支持流式与非流式
- **后台可视化**：仪表看板、用户管理、密钥管理、中转网关（含模型目录 + 在线调试）
- **密钥即鉴权**：`Authorization: Bearer` 与 `x-api-key` 双支持；禁用/删除即时失效
- **无状态多轮**：按 OpenAI 惯例每轮带全量历史，网关负责折叠成上游格式，实测 6 轮连续对话不丢上下文
- **零配置可跑**：所有参数有安全默认值，需要覆盖时用环境变量
- **模型可用性标注**：11 个上游模型里哪些真能用、哪些被限流，后台直接标出来

## 目录结构

```
cf-admin/
├─ src/
│  ├─ index.ts            # Worker 入口：页面路由 + 后台 API + 网关
│  ├─ routes.ts           # 后台管理 API（登录 / 用户 / 密钥 / 网关状态）
│  ├─ templates.ts        # 登录页 + 控制台单页（含「中转网关」页）
│  ├─ duck/               # 上游接入层
│  │  ├─ client.ts        # 请求头组装、VQD 维护、重试、模型目录、健康检查
│  │  ├─ quickjs.ts       # QuickJS(WASM) 里执行 VQD 挑战并求解
│  │  ├─ prelude.ts       # 浏览器环境模拟（自动生成，勿手改）
│  │  ├─ quickjs.wasm     # quickjs-emscripten 的 wasm 模块（约 490KB）
│  │  ├─ sse.ts           # 上游 SSE 解析
│  │  ├─ config.ts        # 配置与默认值（含模型别名表）
│  │  ├─ models.ts        # 模型可用性标注（实测结论表）
│  │  └─ types.ts         # 协议中立类型与错误类型
│  └─ gateway/            # 三协议编解码
│     ├─ index.ts         # 路由装配 / CORS / 鉴权 / 并发闸门
│     ├─ auth.ts          # 复用后台密钥（KV key: 前缀）鉴权
│     ├─ common.ts        # id、token 估算、错误映射、SSE 输出
│     ├─ openai.ts        # /v1/chat/completions
│     ├─ anthropic.ts     # /v1/messages、/v1/messages/count_tokens
│     └─ responses.ts     # /v1/responses
└─ test/                  # 测试脚本（真实请求上游）
```

## 快速开始（本地）

```bash
npm install
npx wrangler dev              # http://127.0.0.1:8787（端口占用时加 --port）
```

1. 打开 http://127.0.0.1:8787 ，用默认账号 **`admin / admin123`** 登录
2. 进「密钥管理」→ 新建密钥 → 复制那串 `sk-...`
3. 进「中转网关」→ 可以看到上游状态、可用模型列表、在线调试框

命令行调用：

```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-你的密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-6-luna","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

---

## 部署到 Cloudflare Workers

### 前置条件

| 项 | 要求 |
| --- | --- |
| Cloudflare 账号 | 需要一个 **Workers 付费版（$5/月起）**，见下方「为什么必须付费版」 |
| Node.js | 20 或以上 |
| 域名 | 可选。默认用 `*.workers.dev` 免费子域 |

### 1. 安装依赖并登录

```bash
cd cf-admin
npm install
npx wrangler login          # 浏览器里点授权
```

验证登录状态：

```bash
npx wrangler whoami
```

### 2. 创建 KV Namespace

```bash
npx wrangler kv namespace create KV
```

输出类似：

```
🌀 Creating namespace with title "adminapi-KV"
✨ Success!
To access your new KV Namespace in your Worker, add the following snippet to your configuration file:
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "3f9a1c2d8e7b4a6f9c0d1e2f3a4b5c6d"
    }
  ]
}
```

> 仓库里 `wrangler.jsonc` 的 `id` 是示例值，**必须换成你自己的这个 id**，否则部署会报
> `KV namespace not found` 或读写到别人的命名空间。

### 3. 修改 `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "adminapi",                    // Worker 名，决定 *.workers.dev 前缀
  "main": "src/index.ts",
  "compatibility_date": "2026-07-23",    // 别调到比代码还旧
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "换成第 2 步拿到的 id"
    }
  ],
  // VQD 求解要跑 QuickJS(WASM)，CPU 时间给足（付费版才生效）
  "limits": { "cpu_ms": 30000 }
}
```

### 4. 部署

```bash
npx wrangler deploy
```

成功后会打印访问地址，形如：

```
https://adminapi.<你的子域>.workers.dev
```

### 5. 首次初始化

1. 浏览器打开上面的地址 → 用 `admin / admin123` 登录
2. **立刻改密码**（左下角「修改密码」），默认密码是公开的
3. 「密钥管理」新建密钥 → 复制 `sk-...`
4. 验证部署：

```bash
BASE=https://adminapi.<你的子域>.workers.dev

curl $BASE/health
# {"status":"ok","upstream":{"upstream":"https://duck.ai","vqd_cached":false,...}}

curl $BASE/v1/models -H "Authorization: Bearer sk-你的密钥"
# {"object":"list","data":[{"id":"gpt-6-luna",...}, ...]}

curl $BASE/v1/chat/completions \
  -H "Authorization: Bearer sk-你的密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-6-luna","messages":[{"role":"user","content":"只回复两个字：可以"}]}'
```

### 6. 绑定自定义域名（可选）

在 `wrangler.jsonc` 里加：

```jsonc
"routes": [
  { "pattern": "api.example.com", "custom_domain": true }
]
```

要求该域名已托管在同一个 Cloudflare 账号下。改完重新 `npx wrangler deploy`。

### 7. 看日志

```bash
npx wrangler tail                # 实时
npx wrangler tail --status error # 只看报错
```

### 8. 为什么必须付费版

VQD 求解要把上游那段 JS 丢进 QuickJS(WASM) 执行，**一次约 100~150ms CPU**。
免费版 Worker 只有 **10ms CPU** 上限，会直接被杀掉（表现为 500 / `Worker exceeded CPU time limit`）。
付费版默认给到 30s，上面 `limits.cpu_ms` 只是显式写清楚。

### 常见部署问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `KV namespace not found` | `wrangler.jsonc` 里的 `id` 还是示例值，换成自己创建的 |
| 请求 500，日志 `exceeded CPU time` | 用的免费版，升级到 Workers Paid |
| 部署成功但访问 404 | `main` 路径写错，或访问的是 `/console` 之外的路径；先试 `/health` |
| 一直 429 | 上游限流，不是部署问题，见「已知限制」 |
| 改了代码没生效 | `wrangler deploy` 要重新跑；`wrangler dev` 才是热更新 |

---

## Claude Code 接入

网关实现了 Anthropic Messages 协议（`POST /v1/messages`、`POST /v1/messages/count_tokens`），
Claude Code 可以直接把本网关当作 Anthropic 端点使用。

> ⚠️ **先看这条**：本网关**不透传 tools / function calling**。Claude Code 的读写文件、执行命令
> 都依赖 tool_use，所以接入后**只能当聊天/问答用，无法真正改代码**。适合的场景是把它当
> 一个便宜的对话后端来试协议、或者做纯文本问答。完整 agent 能力需要支持 tools 的网关。

### 方式一：环境变量（临时生效）

```bash
export ANTHROPIC_BASE_URL="https://adminapi.<你的子域>.workers.dev"   # 注意：不要带 /v1
export ANTHROPIC_AUTH_TOKEN="sk-你在后台生成的密钥"
export ANTHROPIC_MODEL="gpt-6-luna"

claude
```

### 方式二：写进 settings.json（推荐，永久生效）

文件位置：

- macOS / Linux：`~/.claude/settings.json`
- Windows：`C:\Users\<用户名>\.claude\settings.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://adminapi.<你的子域>.workers.dev",
    "ANTHROPIC_AUTH_TOKEN": "sk-你在后台生成的密钥",
    "ANTHROPIC_MODEL": "gpt-6-luna",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-6-luna",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-6-luna",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4-mini",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

各变量作用：

| 变量 | 填什么 | 说明 |
| --- | --- | --- |
| `ANTHROPIC_BASE_URL` | Worker 根地址 | **不要带 `/v1`**，Claude Code 自己拼 `/v1/messages` |
| `ANTHROPIC_AUTH_TOKEN` | `sk-...` | 会以 `Authorization: Bearer` 发送；网关也认 `x-api-key` |
| `ANTHROPIC_MODEL` | `gpt-6-luna` | 主模型，实测最快最稳 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `_OPUS_MODEL` | `gpt-6-luna` | `/model` 里选 sonnet/opus 时实际用的模型 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `gpt-5.4-mini` | 后台小任务（起标题等）用的快模型 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1` | 关掉发往 Anthropic 的非必要遥测请求 |

> `ANTHROPIC_SMALL_FAST_MODEL` 已被官方标记为废弃，新版本请用 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。

### 模型名怎么填

Claude Code 默认会请求 `claude-sonnet-*` / `claude-haiku-*` 这类名字。两种做法：

1. **靠别名自动映射**（省事）：`src/duck/config.ts` 里已内置
   `claude-sonnet-4-5`、`claude-3-5-sonnet`、`claude-3-opus` → `claude-haiku-4-5`，
   `gpt-4o` → `gpt-5.6-luna`。
2. **直接指定可用模型**（推荐）：像上面那样把 `ANTHROPIC_MODEL` 等设成 `gpt-6-luna`。

注意：上游真实 ID（如 `claude-sonnet-4-6`）**故意不写进别名表**，避免你点名某个模型时被静默换掉。

### 验证接入是否成功

启动后输入：

```
/status
```

看到 `API provider` 指向你的 Worker 域名、`Model` 是 `gpt-6-luna` 就对了。
再随便问一句「用一句话介绍你自己」，能正常流式输出即接入成功。

也可以先绕开 Claude Code，用 curl 模拟它的请求形状（system 为 block 数组、带 `cache_control`）：

```bash
curl $BASE/v1/messages \
  -H "x-api-key: sk-你的密钥" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 512,
    "stream": true,
    "system": [{"type":"text","text":"You are Claude Code.","cache_control":{"type":"ephemeral"}}],
    "messages": [{"role":"user","content":[{"type":"text","text":"用一句话介绍你自己"}]}],
    "metadata": {"user_id": "user_123"}
  }'
```

实测返回 200，事件序列为
`message_start → content_block_start → ping → content_block_delta × N → content_block_stop → message_delta → message_stop`，
与 Anthropic 官方一致。

### 其它客户端

同一个端点也能给任何走 Anthropic 协议的客户端用（Cline、Continue、各种 IDE 插件等），
填法一致：Base URL 填 Worker 根地址，API Key 填 `sk-...`，模型填 `gpt-6-luna`。
OpenAI 系客户端则把 Base URL 填成 `https://.../v1`。

---

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/chat/completions` | OpenAI Chat Completions（流式 / 非流式） |
| POST | `/v1/messages` | Anthropic Messages（流式 / 非流式） |
| POST | `/v1/messages/count_tokens` | Anthropic token 估算（不请求上游） |
| POST | `/v1/responses` | OpenAI Responses（流式 / 非流式） |
| GET | `/v1/models`、`/v1/models/:id` | 模型目录 |
| GET | `/health` | 上游健康检查（无需密钥） |
| GET | `/`、`/console` | 登录页 / 控制台 |

鉴权支持两种写法，值就是后台「密钥管理」里那串 `sk-...`：

```
Authorization: Bearer sk-xxxxxxxx
x-api-key: sk-xxxxxxxx
```

密钥状态为「禁用」或已被删除时返回 401。密钥反查表在 isolate 内存里缓存 30 秒，
后台增删密钥会立即让缓存失效（同 isolate 内即时生效）。

## 模型目录与可用性

`GET /v1/models` 返回上游目录 + 内置快照兜底，共 11 个。**不是每个都能真正调用**，
控制台「中转网关 → 可用模型」会直接列出 ID 并标注实测状态：

| 模型 ID | 提供方 | 状态 | 说明 |
| --- | --- | --- | --- |
| `gpt-6-luna` | openai | ✅ 可用 | 默认模型，最快最稳 |
| `gpt-5.6-luna` | openai | ✅ 可用 | 实测可用 |
| `gpt-5.4-mini` | openai | ✅ 可用 | 轻量快 |
| `claude-haiku-4-5` | anthropic | ✅ 可用 | 响应略慢 |
| `mistral-small-2603` | mistral | ✅ 可用 | 实测可用 |
| `gpt-5.6-terra` | openai | ⛔ 受限 | `ERR_MODEL_RESTRICTED` |
| `gpt-5.6-sol` | openai | ⛔ 受限 | `ERR_MODEL_RESTRICTED` |
| `claude-sonnet-4-6` | anthropic | ⛔ 受限 | `ERR_MODEL_RESTRICTED` |
| `claude-opus-4-8` | anthropic | ⛔ 受限 | `ERR_MODEL_RESTRICTED` |
| `tinfoil/gpt-oss-120b` | tinfoil | ⛔ 封禁 | 429 `upstream_banned` |
| `tinfoil/gemma4-31b` | tinfoil | ⛔ 封禁 | 429 `upstream_banned` |

结论表在 `src/duck/models.ts` 的 `AVAILABILITY`，**只影响后台展示与排序，不改
`/v1/models` 的标准返回结构**。上游策略会变，改动后重跑：

```bash
BASE=http://127.0.0.1:8787 KEY=sk-xxx npm run test:models
```

脚本会逐个模型实测并直接打印可粘贴的 `AVAILABILITY` 条目。

## 连续对话（多轮上下文）

网关是**无状态**的：不依赖上游 `conversationId` 保存会话，而是要求客户端像调 OpenAI 一样
**每轮把完整历史带上**（`messages` / `input` 数组），网关负责把历史折叠成上游格式：

| 客户端角色 | 折叠成上游 |
| --- | --- |
| `system` / `developer` | `[System]: …`（user 角色） |
| `assistant` | `content:""` + `parts[{type:"text"}]`（真正的 assistant 轮） |
| `tool` | `[tool_result <id>]: …` |
| 连续多条 `user` | 依次保留，不会合并 |

实测（`npm run test:multi`，真实上游）：

- OpenAI 6 轮：第 1 轮说「我叫林一，工号 A7K29」，第 3/4/5 轮分别准确答出名字、工号、颜色，
  第 6 轮三要素齐全；第 4~6 轮走**流式**，历史照样接得上。
- Anthropic 3 轮：`system` + 多轮历史，暗号「蓝鲸-42」记得住，倒序也能算对。
- Responses 3 轮：`input` 数组含 assistant 轮，经纬度 35.6586 / 139.7454 分轮答对。
- 边界：连续两条 user、空 assistant 占位、22 条长历史都能正常回忆关键事实。

**注意**：每一轮都是一次真实上游请求，上游限流很紧。真实客户端连续快速发消息会收到 429，
建议客户端侧做重试，或降低发送频率。

## 测试

```bash
# 三协议 × 流式/非流式 + 鉴权 + 默认模型回落（28 项）
BASE=http://127.0.0.1:8787 KEY=sk-你的密钥 npm run test:smoke

# 连续对话：6 轮 OpenAI + 3 轮 Anthropic + 3 轮 Responses + 边界用例（15 项）
BASE=http://127.0.0.1:8787 KEY=sk-你的密钥 npm run test:multi

# 走后台「密钥管理」签发密钥的端到端验证（生成 → 调用 → 禁用 → 启用 → 删除，9 项）
BASE=http://127.0.0.1:8787 npm run test:keys

# 控制台「中转网关」页渲染检查（最小 DOM 桩里跑内联脚本，22 项）
BASE=http://127.0.0.1:8787 npm run test:ui

# 逐模型实测可用性（约 1~2 分钟，受上游限流）
BASE=http://127.0.0.1:8787 KEY=sk-你的密钥 npm run test:models
```

`BASE` 不填时默认 `http://127.0.0.1:8787`，端口换了记得带上。

`test:multi` 可以只跑某组：`ONLY=responses,edge npm run test:multi`；
请求间隔用 `GAP` 调整（毫秒，默认 12000）。

前四个脚本都会真实请求 duck.ai。上游是**滑动窗口限流**，连续快速请求会返回 429，
脚本内部会按 `Retry-After` 退避重试（最多等到 60s 一次）。

## 实现要点

### 1. VQD 挑战必须在沙箱里跑 JS

duck.ai 的 `x-vqd-hash-1` 是 base64 编码的一段 JS，必须执行才能算出 `client_hashes`。
Workers 运行时禁止 `eval` / `new Function`（会抛
`EvalError: Code generation from strings disallowed for this context`），
所以用 `quickjs-emscripten`（WASM）起隔离运行时执行挑战：

1. `GET /duckchat/v1/status`（带 `x-vqd-accept: 1`）→ 响应头 `x-vqd-hash-1`
2. QuickJS 里跑挑战（模拟 `navigator` / `document` / `TextEncoder` / `crypto.subtle`）
3. `client_hashes` 逐个 SHA-256 → base64
4. 补 `meta{origin, stack, duration}` 后 `JSON.stringify` → base64 → 回传

`quickjs.wasm` 通过 `import wasmModule from './quickjs.wasm'` 以 `WebAssembly.Module`
形式打进 Worker（wrangler 默认按 CompiledWasm 处理），再手动喂给 emscripten 的
`instantiateWasm` —— Workers 里 emscripten 默认的 fs/fetch 加载路径不可用。

### 2. 上游 wire 形状（2026-10 线上抓包对齐）

请求体没有 `metadata` 段，`canShowGreeting` 恒 `false`，`durableStream` 带一次性
RSA-OAEP-256 公钥（JWK）；请求头带 `x-duckai-consent-purposes`、
`x-duckai-continuation`、`x-duckai-response-id`、`x-fe-signals`（7 条前端遥测事件，
delta 单调递增），`canUseTools=true` 时额外带 `x-duckai-tool-approval`。

### 3. 协议编解码

三协议在接入层先扁平化成「user / assistant + 纯文本」两态消息：
system/developer 折叠成 `[System]: ...`，tool 结果折叠成 `[tool_result <id>]: ...`，
assistant 用 `content: ""` + `parts` 回放。上游不返回 usage，响应里的 token 数是
启发式估算（ASCII 约 4 字符 1 token，非 ASCII 1 字符 1 token）。

## 配置

零配置即可运行。需要覆盖时在 `wrangler.jsonc` 的 `vars` 里加环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DUCK_BASE_URL` | `https://duck.ai` | 上游根地址 |
| `DUCK_DEFAULT_MODEL` | `gpt-6-luna` | 请求未指定 model 时的回落 |
| `DUCK_USER_AGENT` | Chrome/155 桌面 UA | 与 `sec-ch-ua` 需保持一致 |
| `DUCK_REASONING_EFFORT` | `low` | 默认推理强度 |
| `DUCK_CAN_USE_TOOLS` | `false` | 是否向上游声明可用工具 |
| `DUCK_VQD_CACHE_SECS` | `300` | VQD 令牌缓存秒数 |
| `DUCK_MODELS_CACHE_SECS` | `1800` | 模型目录缓存秒数 |
| `DUCK_NEW_CHAT` | `true` | 每次请求都用新 conversationId |
| `DUCK_MAX_CONCURRENCY` | `8` | 单 isolate 并发上限 |
| `DUCK_REQUEST_TIMEOUT_MS` | `300000` | 上游超时 |
| `DUCK_FE_VERSION` / `DUCK_VQD_OVERRIDE` / `DUCK_VQD_STACK` | 空 | 调试用固定值 |

## 已知限制

- **CPU 时间**：QuickJS 求解一次约 100~150ms CPU。免费版 Worker 只有 10ms CPU，
  必须用付费版（或把求解挪到 Durable Object / 外部服务）。
- **出口 IP**：duck.ai 对匿名流量有出口级封禁（418）与滑动窗口限流（429），
  网关会把它们映射成 429 + `Retry-After`，换出口 IP 才能根治。
- **模型可用性**：只有 5 个实测可用；`claude-sonnet-4-6`、`claude-opus-4-8`、
  `gpt-5.6-terra`、`gpt-5.6-sol` 受限，`tinfoil/*` 被风控。
- **工具调用**：本网关不透传 tools / function calling，上游的工具帧会被忽略。
  因此 Claude Code 接入后只能聊天，无法执行读写文件等 agent 操作。
- **密钥一致性**：KV 是最终一致的，多地域部署时新密钥可能有几十秒延迟（同 isolate 内即时）。

## 安全建议

- 首次登录后**立刻修改默认密码** `admin123`。
- 密钥等同于账号，泄露后到「密钥管理」禁用或删除即可立刻失效。
- 不要把 Worker 域名 + 密钥提交到公开仓库；建议在 Cloudflare 侧加 WAF 速率限制。
