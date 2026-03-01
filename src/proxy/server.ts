import http from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import { matchRoute } from './router'
import { forwardRequest } from './upstream'
import { RouteRule, LogEntry, AppSettings } from '../types/index'
import { v4 as uuidv4 } from 'uuid'

type LogCallback = (entry: LogEntry) => void

let server: http.Server | null = null

export function startProxyServer(
  settings: AppSettings,
  getRules: () => RouteRule[],
  onLog: LogCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        const body = Buffer.concat(chunks)
        handleRequest(req, res, body, getRules, onLog, settings.requestTimeoutMs)
      })
    })

    server.listen(settings.port, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })
}

export function stopProxyServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve()
    server.close(() => {
      server = null
      resolve()
    })
  })
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
  getRules: () => RouteRule[],
  onLog: LogCallback,
  timeoutMs: number
): void {
  console.log(`[proxy] ${req.method} ${req.url} body=${body.length}bytes`)

  // 非 /v1/messages 的请求直接返回 404（如 /v1/models 等）
  const pathname = req.url?.split('?')[0]
  if (pathname !== '/v1/messages') {
    console.log(`[proxy] unsupported path: ${req.url}, returning 404`)
    res.writeHead(404)
    res.end(JSON.stringify({ error: { type: 'not_found', message: `Path ${req.url} not supported` } }))
    return
  }

  let model = ''
  let parsed = null
  try {
    parsed = JSON.parse(body.toString())
    model = parsed.model ?? ''
    console.log(`[proxy] parsed model: "${model}"`)
  } catch (e) {
    console.log(`[proxy] JSON parse failed: ${e}`)
    res.writeHead(400)
    res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'Invalid JSON body' } }))
    return
  }

  // 收集请求信息
  const requestInfo = {
    method: req.method ?? 'POST',
    path: req.url ?? '/v1/messages',
    headers: req.headers as Record<string, string>,
    body: parsed,
  }

  const rules = getRules()
  console.log(`[proxy] matching against ${rules.length} rules`)
  const rule = matchRoute(model, rules)
  console.log(`[proxy] matched rule: ${rule ? rule.name : 'none'}`)

  if (!rule) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: { type: 'route_not_found', message: `No route matched model: ${model}` } }))
    onLog({
      id: uuidv4(),
      timestamp: Date.now(),
      model,
      matchedRule: null,
      upstreamUrl: null,
      latencyMs: 0,
      statusCode: 404,
    })
    return
  }

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
}
