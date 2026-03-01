import { app, BrowserWindow, ipcMain, net } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { loadRoutes, saveRoutes } from '../src/store/routes'
import { loadSettings, saveSettings } from '../src/store/settings'
import { startProxyServer, stopProxyServer } from '../src/proxy/server'
import { createTray } from './tray'
import { RouteRule, LogEntry } from '../src/types/index'

let mainWindow: BrowserWindow | null = null
let proxyRunning = false
let currentPort = 3000

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

async function startProxy(): Promise<void> {
  const settings = loadSettings()
  const rules = loadRoutes()
  currentPort = settings.port

  await startProxyServer(
    settings,
    () => loadRoutes(),
    (entry: LogEntry) => {
      mainWindow?.webContents.send('log:entry', entry)
    }
  )
  proxyRunning = true
}

app.whenReady().then(async () => {
  createWindow()

  createTray(
    () => mainWindow?.show(),
    () => { app.exit(0) }
  )

  try {
    await startProxy()
  } catch (err) {
    console.error('Failed to start proxy:', err)
  }

  registerIpcHandlers()
})

let quitting = false

app.on('before-quit', () => { quitting = true })

function registerIpcHandlers(): void {
  // Routes
  ipcMain.handle('routes:list', () => loadRoutes())

  ipcMain.handle('routes:add', (_e, rule: Omit<RouteRule, 'id'>) => {
    const rules = loadRoutes()
    const newRule: RouteRule = { ...rule, id: uuidv4() }
    rules.push(newRule)
    saveRoutes(rules)
    return newRule
  })

  ipcMain.handle('routes:update', (_e, rule: RouteRule) => {
    const rules = loadRoutes()
    const idx = rules.findIndex((r) => r.id === rule.id)
    if (idx !== -1) rules[idx] = rule
    saveRoutes(rules)
    return rule
  })

  ipcMain.handle('routes:delete', (_e, { id }: { id: string }) => {
    const rules = loadRoutes().filter((r) => r.id !== id)
    saveRoutes(rules)
  })

  ipcMain.handle('routes:reorder', (_e, { ids }: { ids: string[] }) => {
    const rules = loadRoutes()
    const map = new Map(rules.map((r) => [r.id, r]))
    const reordered = ids.map((id, i) => {
      const r = map.get(id)!
      return { ...r, priority: i + 1 }
    })
    saveRoutes(reordered)
  })

  // Proxy
  ipcMain.handle('proxy:status', () => ({ running: proxyRunning, port: currentPort }))

  ipcMain.handle('proxy:restart', async () => {
    try {
      await stopProxyServer()
      proxyRunning = false
      await startProxy()
      return { success: true }
    } catch (err) {
      return { success: false }
    }
  })

  // Settings
  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:update', (_e, partial: Partial<{ port: number; requestTimeoutMs: number }>) => {
    const current = loadSettings()
    const updated = { ...current, ...partial }
    saveSettings(updated)
    return updated
  })

  // Connectivity test
  ipcMain.handle('route:test', async (_e, { id, model }: { id: string; model: string }) => {
    const rules = loadRoutes()
    const rule = rules.find((r) => r.id === id)
    if (!rule) return { success: false, latencyMs: null, error: 'Rule not found' }

    // 用模型映射解析出实际发给上游的模型名
    const { resolveTargetModel } = await import('../src/proxy/upstream')
    const targetModel = resolveTargetModel(model, rule)

    const start = Date.now()
    try {
      const base = rule.upstream.baseUrl.replace(/\/$/, '')
      const url = `${base}/v1/messages`
      const body = JSON.stringify({
        model: targetModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      })

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = net.request({ method: 'POST', url })
        req.setHeader('Content-Type', 'application/json')
        req.setHeader('Authorization', `Bearer ${rule.upstream.apiKey}`)
        req.on('response', (res) => resolve({ statusCode: res.statusCode }))
        req.on('error', reject)
        req.write(body)
        req.end()
      })

      const latencyMs = Date.now() - start
      const { statusCode } = response

      if (statusCode >= 200 && statusCode < 300) {
        return { success: true, latencyMs, error: null }
      }
      if (statusCode === 401 || statusCode === 403) {
        return { success: false, latencyMs, error: 'API Key 错误' }
      }
      if (statusCode === 404) {
        return { success: false, latencyMs, error: '接口地址错误' }
      }
      return { success: false, latencyMs, error: `上游异常 (${statusCode})` }
    } catch (err: unknown) {
      return { success: false, latencyMs: Date.now() - start, error: '无法连接到上游' }
    }
  })

  // Write Claude Code config
  ipcMain.handle('claude:apply-config', () => {
    const settings = loadSettings()
    const configPath = path.join(os.homedir(), '.claude', 'settings.json')
    try {
      let existing: Record<string, unknown> = {}
      if (fs.existsSync(configPath)) {
        existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }
      const env = (existing.env as Record<string, string>) ?? {}
      env['ANTHROPIC_BASE_URL'] = `http://localhost:${settings.port}`
      env['ANTHROPIC_AUTH_TOKEN'] = 'claude-proxy'
      const aliases = settings.modelAliases ?? {}
      for (const key of ['ANTHROPIC_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_REASONING_MODEL'] as const) {
        if (aliases[key]) env[key] = aliases[key]!
      }
      existing.env = env
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8')
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })
}
