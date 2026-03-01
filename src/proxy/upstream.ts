import http from 'http'
import https from 'https'
import { URL } from 'url'
import { IncomingMessage, ServerResponse } from 'http'
import { RouteRule } from '../types/index'
import { minimatch } from 'minimatch'

export function resolveTargetModel(incomingModel: string, rule: RouteRule): string {
  for (const mapping of rule.modelMappings) {
    if (minimatch(incomingModel, mapping.pattern)) {
      return mapping.targetModel
    }
  }
  return rule.defaultTargetModel
}

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
  const start = Date.now()

  // 替换 model 字段
  let finalBody = body
  try {
    const parsed = JSON.parse(body.toString())
    const targetModel = resolveTargetModel(parsed.model ?? '', rule)
    parsed.model = targetModel
    finalBody = Buffer.from(JSON.stringify(parsed))
  } catch {
    // 解析失败则原样透传，让上游报错
  }

  const base = rule.upstream.baseUrl.replace(/\/$/, '')
  const targetUrl = new URL(`${base}/v1/messages`)
  console.log(`[upstream] forwarding to: ${targetUrl.href}`)
  const isHttps = targetUrl.protocol === 'https:'
  const transport = isHttps ? https : http

  // 删除可能导致认证冲突的原始请求头
  const filteredHeaders = { ...req.headers }
  delete filteredHeaders['x-api-key']
  delete filteredHeaders['authorization']

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname,
    method: 'POST',
    headers: {
      ...filteredHeaders,
      host: targetUrl.host,
      authorization: `Bearer ${rule.upstream.apiKey}`,
      'content-length': Buffer.byteLength(finalBody),
    },
    timeout: timeoutMs,
  }

  const proxyReq = transport.request(options, (proxyRes) => {
    const statusCode = proxyRes.statusCode ?? 502
    const responseChunks: Buffer[] = []

    // 流式响应：边接收边转发
    proxyRes.on('data', (chunk: Buffer) => {
      responseChunks.push(chunk)
      // 立即转发，不等待全部接收
      if (!reply.headersSent) {
        reply.writeHead(statusCode, proxyRes.headers)
      }
      reply.write(chunk)
    })

    proxyRes.on('end', () => {
      reply.end()

      // 等响应结束后再记录日志（包含完整 body 和 tokens）
      const responseBodyBuffer = Buffer.concat(responseChunks)
      let responseBody: object | null = null
      let tokens: { input: number; output: number; total: number } | undefined = undefined

      try {
        // 流式响应用 text/event-stream，需要解析每个事件行
        const responseText = responseBodyBuffer.toString()
        let usage: { input_tokens?: number; output_tokens?: number } | undefined

        // 尝试从流式响应中提取最后的 usage
        const lines = responseText.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.usage) {
                usage = parsed.usage
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        // 如果找到 usage，尝试解析整个响应为 JSON（非流式情况）
        try {
          responseBody = JSON.parse(responseText)
        } catch {
          responseBody = { _stream: true, _raw: responseText }
        }

        if (usage) {
          tokens = {
            input: usage.input_tokens ?? 0,
            output: usage.output_tokens ?? 0,
            total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        }
      } catch {
        // 解析失败
      }

      const responseInfo = {
        statusCode,
        headers: proxyRes.headers as Record<string, string>,
        body: responseBody,
      }

      onDone(statusCode, Date.now() - start, responseInfo, tokens)
    })
  })

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

  proxyReq.write(finalBody)
  proxyReq.end()
}
