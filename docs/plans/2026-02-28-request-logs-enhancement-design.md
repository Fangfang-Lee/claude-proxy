# 请求日志增强功能设计

## 概述

增强现有请求日志功能，支持：
1. 点击查看完整请求/响应详情
2. 显示 Token 消耗明细（Input/Output/Total）
3. 失败请求显示错误原因

## 数据结构

### 扩展 LogEntry 接口

```typescript
export interface LogEntry {
  // 现有字段
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
    error?: string  // 失败原因
  }
  tokens?: {
    input: number
    output: number
    total: number
  }
}
```

## 架构设计

### 1. 代理服务器修改

**server.ts**:
- 解析完整请求信息（method、path、headers、body）
- 将 request 信息传递给 forwardRequest

**upstream.ts**:
- 捕获完整响应（statusCode、headers、body）
- 从响应体解析 Anthropic API 的 `usage` 字段获取 token 使用量
- 错误情况（timeout、upstream error）记录 error 信息
- 回调时携带完整 request/response/tokens

### 2. UI 改动

**列表页 (Logs.tsx)**:
- 每行增加点击事件
- 新增 Token 列：显示格式 `input → output (total)`
- 无 token 时显示 `-`

**详情抽屉 (LogDetailDrawer.tsx)**:
- 从右侧滑出的抽屉组件
- 三个分区：
  1. 请求信息：Method、Path、Headers（可折叠）、Body（JSON 格式化）
  2. 响应信息：Status、Headers、Body、错误信息（红色高亮）
  3. Token 统计：Input、Output、Total
- 点击遮罩或关闭按钮关闭抽屉

### 3. 数据流

```
请求进来 → server.ts 记录 request 信息
    ↓
forwardRequest 转发上游
    ↓
upstream.ts 解析响应，提取 tokens
    ↓
onLog 回调带完整 request/response/tokens
    ↓
App.tsx 存入 logs 数组（内存）
    ↓
LogsPage 展示 + 点击打开 LogDetailDrawer
```

## 实现步骤

1. 扩展 LogEntry 类型定义
2. 修改 server.ts 收集请求信息
3. 修改 upstream.ts 收集响应信息和 token
4. 更新 onLog 回调签名
5. 修改 App.tsx 处理新的日志结构
6. 更新 Logs.tsx 列表页 UI
7. 创建 LogDetailDrawer 详情抽屉组件

## 约束

- 内存存储，不持久化（用户确认）
- 最多保留 200 条日志（现有逻辑）
