# 请求日志增强功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增强请求日志功能，支持点击查看完整请求/响应详情，显示 Token 消耗明细

**Architecture:** 扩展 LogEntry 类型，增加 request/response/tokens 字段；代理服务器捕获完整请求响应信息；UI 新增详情抽屉组件

**Tech Stack:** TypeScript, React, Electron

---

## Task 1: 扩展 LogEntry 类型定义

**Files:**
- Modify: `src/types/index.ts:32-40`

**Step 1: 扩展 LogEntry 接口**

修改 `src/types/index.ts`，将 LogEntry 接口扩展为：

```typescript
export interface LogEntry {
  id: string
  timestamp: number
  model: string
  matchedRule: string | null
  upstreamUrl: string | null
  latencyMs: number
  statusCode: number
  // 新增字段
  request?: {
    method: string
    path: string
    headers: Record<string, string>
    body: object | null
  }
  response?: {
    statusCode: number
    headers: Record<string, string>
    body: object | null
    error?: string
  }
  tokens?: {
    input: number
    output: number
    total: number
  }
}
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

---

## Task 2: 修改 server.ts 收集请求信息

**Files:**
- Modify: `src/proxy/server.ts:1-104`

**Step 1: 修改 handleRequest 函数收集 request 信息**

在 handleRequest 函数中，当解析请求体成功后，构造 request 对象：

```typescript
// 在解析 body 成功后（约第 64 行后）添加
const requestInfo = {
  method: req.method ?? 'POST',
  path: req.url ?? '/v1/messages',
  headers: req.headers as Record<string, string>,
  body: parsed,
}
```

**Step 2: 传递给 forwardRequest**

修改 forwardRequest 调用，传入 requestInfo：

```typescript
forwardRequest(req, res, body, rule, timeoutMs, requestInfo, (statusCode, latencyMs, responseInfo, tokens) => {
  onLog({
    id: uuidv4(),
    timestamp: Date.now(),
    model,
    matchedRule: rule.name,
    upstreamUrl: rule.upstream.baseUrl,
    latencyMs,
    statusCode,
    request: requestInfo,
    response: responseInfo,
    tokens,
  })
})
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`
Expected: 有错误，因为 upstream.ts 还没修改

---

## Task 3: 修改 upstream.ts 收集响应信息和 token

**Files:**
- Modify: `src/proxy/upstream.ts:17-84`

**Step 1: 修改 forwardRequest 函数签名**

修改函数签名，增加 request 参数和修改回调：

```typescript
export async function forwardRequest(
  req: IncomingMessage,
  reply: ServerResponse,
  body: Buffer,
  rule: RouteRule,
  timeoutMs: number,
  requestInfo: {
    method: string
    path: string
    headers: Record<string, string>
    body: object | null
  },
  onDone: (statusCode: number, latencyMs: number, responseInfo: {
    statusCode: number
    headers: Record<string, string>
    body: object | null
    error?: string
  }, tokens: { input: number; output: number; total: number } | undefined) => void
): Promise<void> {
```

**Step 2: 收集响应体和 token**

修改 proxyReq 的 response 处理：

```typescript
const proxyReq = transport.request(options, (proxyRes) => {
  const statusCode = proxyRes.statusCode ?? 502
  const responseChunks: Buffer[] = []

  proxyRes.on('data', (chunk: Buffer) => {
    responseChunks.push(chunk)
  })

  proxyRes.on('end', () => {
    const responseBodyBuffer = Buffer.concat(responseChunks)
    let responseBody: object | null = null
    let tokens: { input: number; output: number; total: number } | undefined = undefined

    try {
      responseBody = JSON.parse(responseBodyBuffer.toString())
      // 解析 Anthropic API 的 usage 字段
      if (responseBody && typeof responseBody === 'object' && 'usage' in responseBody) {
        const usage = (responseBody as any).usage
        tokens = {
          input: usage.input_tokens ?? 0,
          output: usage.output_tokens ?? 0,
          total: usage.input_tokens + usage.output_tokens ?? 0,
        }
      }
    } catch {
      // 解析失败，body 为 null
    }

    const responseInfo = {
      statusCode,
      headers: proxyRes.headers as Record<string, string>,
      body: responseBody,
    }

    reply.writeHead(statusCode, proxyRes.headers)
    reply.write(responseBodyBuffer)
    reply.end()

    onDone(statusCode, Date.now() - start, responseInfo, tokens)
  })
})
```

**Step 3: 修改错误处理**

在 timeout 和 error 情况下也要传递 responseInfo：

```typescript
proxyReq.on('timeout', () => {
  proxyReq.destroy()
  reply.writeHead(504)
  const errorBody = { error: { type: 'timeout', message: 'Upstream request timed out' } }
  reply.end(JSON.stringify(errorBody))
  onDone(504, Date.now() - start, {
    statusCode: 504,
    headers: {},
    body: errorBody,
    error: 'Timeout',
  }, undefined)
})

proxyReq.on('error', (err) => {
  if (!reply.headersSent) {
    reply.writeHead(502)
    const errorBody = { error: { type: 'upstream_error', message: err.message } }
    reply.end(JSON.stringify(errorBody))
  }
  onDone(502, Date.now() - start, {
    statusCode: 502,
    headers: {},
    body: { error: { type: 'upstream_error', message: err.message } },
    error: err.message,
  }, undefined)
})
```

**Step 4: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

---

## Task 4: 修改 App.tsx 处理新的日志结构

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: 添加选中日志的 state**

在 App.tsx 中添加：

```typescript
const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
```

**Step 2: 传递给 LogsPage**

修改 LogsPage 调用，添加 onLogClick：

```tsx
<LogsPage logs={logs} onLogClick={(log) => setSelectedLog(log)} />
```

---

## Task 5: 更新 Logs.tsx 列表页 UI

**Files:**
- Modify: `src/ui/pages/Logs.tsx`

**Step 1: 修改 Props 接口**

```typescript
interface Props {
  logs: LogEntry[]
  onLogClick?: (log: LogEntry) => void
}
```

**Step 2: 修改组件接收 onLogClick**

```typescript
export default function LogsPage({ logs, onLogClick }: Props) {
```

**Step 3: 添加 Token 列和点击事件**

修改列表项，添加：

```typescript
<div
  key={log.id}
  onClick={() => onLogClick?.(log)}
  className={`flex items-center gap-4 px-3 py-2 rounded text-xs font-mono cursor-pointer hover:bg-blue-50 ${
    i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  }`}
>
  {/* 现有字段... */}
  <span className="text-gray-400 w-20 shrink-0">
    {new Date(log.timestamp).toLocaleTimeString()}
  </span>
  <span className="text-blue-500 w-48 truncate shrink-0">{log.model}</span>
  <span className="text-gray-500 flex-1 truncate">
    {log.matchedRule ?? <span className="text-red-400">无匹配规则</span>}
  </span>
  {/* 新增 Token 列 */}
  <span className="text-gray-400 w-24 text-right shrink-0">
    {log.tokens ? `${log.tokens.input} → ${log.tokens.output} (${log.tokens.total})` : '-'}
  </span>
  <span className="text-gray-400 w-16 text-right shrink-0">{log.latencyMs}ms</span>
  <span className={`w-10 text-right shrink-0 font-medium ${
    log.statusCode < 300 ? 'text-green-600' : log.statusCode < 500 ? 'text-amber-500' : 'text-red-500'
  }`}>
    {log.statusCode}
  </span>
</div>
```

**Step 4: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

---

## Task 6: 创建 LogDetailDrawer 详情抽屉组件

**Files:**
- Create: `src/ui/components/LogDetailDrawer.tsx`

**Step 1: 创建组件**

```typescript
import { LogEntry } from '../../types/index'

interface Props {
  log: LogEntry | null
  onClose: () => void
}

export default function LogDetailDrawer({ log, onClose }: Props) {
  if (!log) return null

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* 抽屉 */}
      <div className="fixed right-0 top-0 bottom-0 w-[600px] bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-medium">请求详情</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 space-y-6">
          {/* 基本信息 */}
          <section>
            <h3 className="text-sm font-medium text-gray-600 mb-2">基本信息</h3>
            <div className="bg-gray-50 rounded p-3 text-xs font-mono space-y-1">
              <div><span className="text-gray-500">时间:</span> {new Date(log.timestamp).toLocaleString()}</div>
              <div><span className="text-gray-500">模型:</span> {log.model}</div>
              <div><span className="text-gray-500">规则:</span> {log.matchedRule ?? '无匹配'}</div>
              <div><span className="text-gray-500">上游:</span> {log.upstreamUrl ?? '-'}</div>
              <div><span className="text-gray-500">延迟:</span> {log.latencyMs}ms</div>
              <div><span className="text-gray-500">状态:</span> <span className={log.statusCode < 300 ? 'text-green-600' : 'text-red-600'}>{log.statusCode}</span></div>
            </div>
          </section>

          {/* Token 统计 */}
          {log.tokens && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Token 消耗</h3>
              <div className="bg-gray-50 rounded p-3 text-xs font-mono flex gap-6">
                <div><span className="text-gray-500">Input:</span> {log.tokens.input}</div>
                <div><span className="text-gray-500">Output:</span> {log.tokens.output}</div>
                <div><span className="text-gray-500">Total:</span> {log.tokens.total}</div>
              </div>
            </section>
          )}

          {/* 请求信息 */}
          {log.request && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">请求</h3>
              <div className="space-y-2">
                <div className="text-xs font-mono">
                  <span className="text-blue-600">{log.request.method}</span> {log.request.path}
                </div>
                <details className="bg-gray-50 rounded">
                  <summary className="p-2 text-xs cursor-pointer text-gray-500">Headers</summary>
                  <pre className="p-2 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(log.request.headers, null, 2)}
                  </pre>
                </details>
                {log.request.body && (
                  <details className="bg-gray-50 rounded">
                    <summary className="p-2 text-xs cursor-pointer text-gray-500">Body</summary>
                    <pre className="p-2 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(log.request.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </section>
          )}

          {/* 响应信息 */}
          {log.response && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">响应</h3>
              <div className="space-y-2">
                {log.response.error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
                    错误: {log.response.error}
                  </div>
                )}
                <details className="bg-gray-50 rounded">
                  <summary className="p-2 text-xs cursor-pointer text-gray-500">Headers</summary>
                  <pre className="p-2 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(log.response.headers, null, 2)}
                  </pre>
                </details>
                {log.response.body && (
                  <details className="bg-gray-50 rounded">
                    <summary className="p-2 text-xs cursor-pointer text-gray-500">Body</summary>
                    <pre className="p-2 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(log.response.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

---

## Task 7: 在 App.tsx 中集成 LogDetailDrawer

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: 引入组件**

在 App.tsx 顶部添加：

```typescript
import LogDetailDrawer from './components/LogDetailDrawer'
```

**Step 2: 在 render 中添加组件**

在 return 语句的 LogsPage 后添加：

```tsx
<LogsPage logs={logs} onLogClick={(log) => setSelectedLog(log)} />
<LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

---

## Task 8: 构建并测试

**Step 1: 运行构建**

Run: `npm run build`
Expected: 构建成功，无错误

**Step 2: 启动开发服务器测试**

Run: `npm run dev`
Expected: 应用正常启动，可以发送测试请求验证功能

---

## 执行方式

**Plan complete and saved to `docs/plans/2026-02-28-request-logs-enhancement-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
