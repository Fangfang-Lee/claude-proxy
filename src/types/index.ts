export interface ModelMapping {
  pattern: string        // 匹配 Claude Code 发来的模型名，如 "claude-sonnet-*"
  targetModel: string    // 转发给上游的模型名，如 "claude-sonnet-4-5-20251101"
}

export interface RouteRule {
  id: string
  name: string
  pattern: string        // 决定走哪个上游，如 "claude-*"
  upstream: {
    baseUrl: string
    apiKey: string
  }
  modelMappings: ModelMapping[]   // 规则内部的模型名映射，可为空数组
  defaultTargetModel: string      // 没有映射命中时的兜底模型名
  priority: number
  enabled: boolean
}

export interface AppSettings {
  port: number
  requestTimeoutMs: number
  modelAliases: {
    ANTHROPIC_MODEL?: string
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string
    ANTHROPIC_REASONING_MODEL?: string
  }
}

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

export interface TestResult {
  success: boolean
  latencyMs: number | null
  error: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  port: 3000,
  requestTimeoutMs: 30000,
  modelAliases: {},
}
