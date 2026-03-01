# Claude Proxy - 技术方案设计文档

## 项目概述

一个基于 Electron 的桌面应用，内嵌 LLM API 代理服务器。支持将不同模型的请求路由到不同的上游订阅服务，通过可视化界面管理路由规则，无需手动编辑配置文件。

主要用途：让 Claude Code 等客户端通过单一本地入口，访问多个不同的 LLM 订阅服务。

---

## 已确认的产品逻辑

### 使用场景

用户购买了多个 LLM 订阅服务，每个服务支持不同的模型：

| 模型匹配 | 上游服务 | 协议 |
|---|---|---|
| `claude-*` | `https://code.newcli.com/claude/aws` | Anthropic |
| `minimax-*` | `https://api.minimaxi.com/anthropic` | Anthropic |
| 未来新增... | 动态添加 | Anthropic |

> 当前所有上游均为 Anthropic 协议，无需协议转换。未来如有 OpenAI 协议上游，可扩展支持。

### 核心诉求

1. Claude Code 只配置一个 `ANTHROPIC_BASE_URL`（指向本地代理 `http://localhost:3000`）
2. 代理根据请求的 `model` 字段自动路由到对应订阅服务
3. 新增订阅时通过桌面 App 可视化配置，无需改代码或重启

### 部署方式

本地部署，打包为 macOS 桌面 App（Electron）。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron |
| 语言 | TypeScript |
| 代理服务器 | Fastify（运行在 Electron Main Process） |
| UI | React + Tailwind CSS |
| 构建工具 | Vite + electron-builder |
| 路由规则存储 | 本地 JSON 文件（userData 目录） |

---

## 应用全局配置

除路由规则外，App 还维护一份全局配置文件 `settings.json`，存储路径：

```
~/Library/Application Support/claude-proxy/settings.json
```

```typescript
interface AppSettings {
  port: number;        // 代理监听端口，默认 3000
  requestTimeoutMs: number;  // 上游请求超时，默认 30000（30 秒）
  modelAliases: {      // 全局模型别名配置
    ANTHROPIC_MODEL?: string;
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
    ANTHROPIC_REASONING_MODEL?: string;
  };
}
```

默认值：

```json
{
  "port": 3000,
  "requestTimeoutMs": 30000,
  "modelAliases": {}
}
```

> `modelAliases` 用于配置全局默认模型映射，例如设置 `ANTHROPIC_DEFAULT_SONNET_MODEL` 为 `claude-sonnet-4-5-20251101`。此配置优先级低于路由规则内的 `modelMappings`，但高于直接使用请求中的模型名。

修改端口后需重启代理服务器生效（App 内提供重启按钮，无需退出整个应用）。

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   Electron App                          │
│                                                         │
│  ┌──────────────────────┐  ┌───────────────────────┐   │
│  │   Main Process       │  │   Renderer Process    │   │
│  │                      │  │                       │   │
│  │  ┌────────────────┐  │  │  ┌─────────────────┐  │   │
│  │  │ Fastify 代理   │  │  │  │  React 管理界面  │  │   │
│  │  │ :3000          │  │  │  │                 │  │   │
│  │  └────────────────┘  │  │  │ - 路由规则列表  │  │   │
│  │  ┌────────────────┐  │  │  │ - 增删改查      │  │   │
│  │  │ 路由规则存储   │◀─┼──┼─▶│ - 服务状态      │  │   │
│  │  │ routes.json    │  │  │  │ - 请求日志      │  │   │
│  │  └────────────────┘  │  │  └─────────────────┘  │   │
│  │  ┌────────────────┐  │  └───────────────────────┘   │
│  │  │ 系统托盘       │  │                               │
│  │  └────────────────┘  │                               │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
         │ 转发请求
         ├──▶ https://code.newcli.com/claude/aws
         └──▶ https://api.minimaxi.com/anthropic
```

---

## 目录结构

```
claude-proxy/
├── electron/
│   ├── main.ts           # Electron 主进程入口
│   ├── tray.ts           # 系统托盘
│   └── preload.ts        # IPC 预加载脚本
├── src/
│   ├── proxy/
│   │   ├── server.ts     # Fastify 代理服务器
│   │   ├── router.ts     # 路由匹配逻辑
│   │   └── upstream.ts   # 上游请求转发（含流式）
│   ├── store/
│   │   └── routes.ts     # 路由规则读写（JSON 文件）
│   ├── ui/
│   │   ├── App.tsx       # React 根组件
│   │   ├── pages/
│   │   │   ├── Routes.tsx    # 路由规则管理页
│   │   │   ├── Logs.tsx      # 请求日志页
│   │   │   └── Settings.tsx  # 设置页
│   │   └── components/
│   │       ├── RouteForm.tsx  # 新增/编辑规则表单
│   │       └── RouteList.tsx  # 规则列表
│   └── types/
│       └── index.ts      # 共享类型定义
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
└── DESIGN.md
```

---

## 路由规则数据结构

```typescript
interface ModelMapping {
  pattern: string        // 匹配 Claude Code 发来的模型名，如 "claude-sonnet-*"
  targetModel: string    // 转发给上游的模型名，如 "claude-sonnet-4-5-20251101"
}

interface RouteRule {
  id: string;          // 唯一标识（UUID）
  name: string;        // 描述名称，如 "MiniMax 订阅"
  pattern: string;     // 模型名称匹配，支持通配符，如 "minimax-*"
  modelMappings: ModelMapping[];  // 规则内部的模型名映射，可为空数组
  defaultTargetModel: string;    // 没有映射命中时的兜底模型名
  upstream: {
    baseUrl: string;   // 上游 base URL
    apiKey: string;    // 上游 API Key（明文存储，本地文件）
  };
  priority: number;    // 优先级，数字越小越优先
  enabled: boolean;
}
```

初始路由规则示例：

```json
[
  {
    "id": "rule-minimax",
    "name": "MiniMax 订阅",
    "pattern": "minimax-*",
    "modelMappings": [
      { "pattern": "minimax-text-01", "targetModel": "abab6.5s-chat" },
      { "pattern": "minimax-reasoning-*", "targetModel": "abab6.5s-thinking" }
    ],
    "defaultTargetModel": "abab6.5s-chat",
    "upstream": {
      "baseUrl": "https://api.minimaxi.com/anthropic",
      "apiKey": "your-minimax-key"
    },
    "priority": 1,
    "enabled": true
  },
  {
    "id": "rule-claude",
    "name": "Claude 中转站",
    "pattern": "claude-*",
    "modelMappings": [
      { "pattern": "claude-sonnet-*", "targetModel": "claude-sonnet-4-5-20251101" }
    ],
    "defaultTargetModel": "claude-sonnet-4-5-20251101",
    "upstream": {
      "baseUrl": "https://code.newcli.com/claude/aws",
      "apiKey": "your-newcli-key"
    },
    "priority": 2,
    "enabled": true
  }
]
```

> `modelMappings` 允许在同一规则内对不同模型名做映射；`defaultTargetModel` 是没有映射命中时的兜底模型名。如果两者都为空，则直接使用请求中的模型名。

---

## 请求处理流程

```
Claude Code 发出请求
  │ POST http://localhost:3000/v1/messages
  │ { model: "minimax-m2.5", messages: [...] }
  ▼
Fastify 代理服务器
  │
  ├─ 1. 解析请求体，提取 model 字段
  │
  ├─ 2. 路由匹配
  │     按 priority 排序所有 enabled 规则
  │     用 minimatch 做 glob 匹配
  │     → 匹配到 "minimax-*" 规则
  │     → 无匹配规则时，返回 404（见错误处理章节）
  │
  ├─ 3. 转发请求
  │     目标: https://api.minimaxi.com/anthropic/v1/messages
  │     替换 Authorization: Bearer <minimax-api-key>
  │     原样透传请求体
  │
  ├─ 4. 响应处理
  │     流式(stream=true): 透传 SSE 数据流
  │     非流式: 直接返回响应体
  │
  └─ 5. 记录日志（模型、上游、延迟、状态码）
```

---

## 错误处理策略

### 无匹配路由规则

请求的 `model` 字段没有匹配任何启用的规则时，返回 404：

```json
HTTP/1.1 404 Not Found

{
  "error": {
    "type": "route_not_found",
    "message": "No route matched model: gpt-4"
  }
}
```

### 上游服务不可达

上游请求超时或连接失败时，返回 502：

```json
HTTP/1.1 502 Bad Gateway

{
  "error": {
    "type": "upstream_error",
    "message": "Upstream request failed: connect ECONNREFUSED"
  }
}
```

### 上游返回错误

上游返回 4xx/5xx 时，原样透传状态码和响应体，不做额外包装。

### 请求超时

上游请求默认超时时间：**30 秒**。超时后返回 504。

---

## UI 功能页面

### 路由规则页

- 规则列表（显示名称、匹配模式、上游 URL、状态）
- 新增规则（表单：名称、pattern、baseUrl、apiKey、优先级）
- 编辑 / 删除规则
- 启用 / 禁用开关
- 拖拽调整优先级
- 每条规则提供"测试连通性"按钮，发送探测请求验证上游是否可达（见连通性测试章节）

### 请求日志页

- 实时显示最近请求（时间、模型、匹配规则、延迟、状态）
- 方便排查路由是否正确

### 设置页

- 代理端口（默认 3000，修改后点击"重启代理"生效）
- 请求超时时间（默认 30 秒）

### 状态栏

- 代理服务器运行状态（端口、是否正常）
- 一键复制 Claude Code 配置

---

## IPC 通信接口

Main Process 和 Renderer 之间通过以下 IPC 频道通信：

### 路由规则管理

| 频道名 | 方向 | 参数 | 返回值 |
|---|---|---|---|
| `routes:list` | Renderer → Main | 无 | `RouteRule[]` |
| `routes:add` | Renderer → Main | `Omit<RouteRule, 'id'>` | `RouteRule` |
| `routes:update` | Renderer → Main | `RouteRule` | `RouteRule` |
| `routes:delete` | Renderer → Main | `{ id: string }` | `void` |
| `routes:reorder` | Renderer → Main | `{ ids: string[] }` | `void` |

### 代理服务器状态

| 频道名 | 方向 | 参数 | 返回值 |
|---|---|---|---|
| `proxy:status` | Renderer → Main | 无 | `{ running: boolean, port: number }` |
| `proxy:restart` | Renderer → Main | 无 | `{ success: boolean }` |

### 全局设置

| 频道名 | 方向 | 参数 | 返回值 |
|---|---|---|---|
| `settings:get` | Renderer → Main | 无 | `AppSettings` |
| `settings:update` | Renderer → Main | `Partial<AppSettings>` | `AppSettings` |

### 连通性测试

| 频道名 | 方向 | 参数 | 返回值 |
|---|---|---|---|
| `route:test` | Renderer → Main | `{ id: string, model: string }` | `TestResult` |

```typescript
interface TestResult {
  success: boolean;
  latencyMs: number | null;
  error: string | null;  // 失败时的错误信息
}
```

### 请求日志（实时推送）

| 频道名 | 方向 | 数据 |
|---|---|---|
| `log:entry` | Main → Renderer | `LogEntry`（见下方类型定义） |

```typescript
interface LogEntry {
  id: string;
  timestamp: number;
  model: string;
  matchedRule: string | null;  // 规则名称，无匹配时为 null
  upstreamUrl: string | null;
  latencyMs: number;
  statusCode: number;
}
```

---

## routes.json 存储说明

**存储路径：**
```
~/Library/Application Support/claude-proxy/routes.json
```

**初始化逻辑：**
- App 首次启动时，若文件不存在，自动创建空数组 `[]`
- 不预置任何默认规则，由用户通过 UI 手动添加

**异常处理：**
- 文件内容损坏（JSON 解析失败）时，备份原文件为 `routes.json.bak`，重置为空数组，并在 UI 中提示用户
- 写入失败时，IPC 调用返回错误，UI 显示提示，不影响代理服务器继续运行

---

## 连通性测试

点击规则列表中的"测试"按钮后，弹出输入框让用户填入要测试的模型名（如 `minimax-text-01`），Main Process 用该模型名向上游发送探测请求：

```
POST {baseUrl}/v1/messages
Authorization: Bearer {apiKey}

{
  "model": "<用户输入的模型名>",
  "max_tokens": 1,
  "messages": [{ "role": "user", "content": "hi" }]
}
```

模型名填错则上游正常报错，行为与 Claude Code 实际使用一致。

**结果判断：**

| 上游响应 | 判定 | 显示 |
|---|---|---|
| 2xx | 成功 | 绿色 ✓，显示延迟（如 `320ms`） |
| 401 / 403 | API Key 无效 | 红色，提示"API Key 错误" |
| 404 | URL 路径不对 | 红色，提示"接口地址错误" |
| 连接超时 / 无法连接 | 不可达 | 红色，提示"无法连接到上游" |
| 其他 4xx / 5xx | 上游异常 | 红色，显示状态码 |

测试请求不经过路由匹配逻辑，直接由 Main Process 发起，不会产生日志记录。

---

## Claude Code 接入配置

App 启动后，在 Claude Code 的 settings.json 中配置：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000",
    "ANTHROPIC_API_KEY": "any-string"
  }
}
```

> `ANTHROPIC_API_KEY` 填任意字符串即可，实际鉴权由各上游规则中的 apiKey 负责。

---

## 后续扩展方向

- **OpenAI 协议支持** - 上游为 OpenAI 协议时自动转换请求格式
- **负载均衡** - 同一 pattern 配置多个上游，轮询或按权重分配
- **用量统计** - 按上游统计 token 消耗和请求次数
- **API Key 加密** - 使用系统 Keychain 存储 API Key
- **自动更新** - electron-updater 支持 App 自动升级

---

## 功能增强计划

已实现的功能增强记录在 `docs/plans/` 目录：

| 文件 | 功能描述 |
|---|---|
| `docs/plans/2026-02-28-request-logs-enhancement-design.md` | 请求日志增强功能设计 |
| `docs/plans/2026-02-28-request-logs-enhancement-implementation.md` | 请求日志增强功能实现计划 |

### 请求日志增强（已实现）

- 点击查看完整请求/响应详情
- 显示 Token 消耗明细（Input/Output/Total）
- 失败请求显示错误原因
