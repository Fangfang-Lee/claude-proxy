import { useState, useEffect } from 'react'
import RoutesPage from './pages/Routes'
import LogsPage from './pages/Logs'
import SettingsPage from './pages/Settings'
import LogDetailDrawer from './components/LogDetailDrawer'
import { LogEntry } from '../types/index'

type Tab = 'routes' | 'logs' | 'settings'

declare global {
  interface Window {
    api: {
      routes: {
        list: () => Promise<import('../types/index').RouteRule[]>
        add: (rule: Omit<import('../types/index').RouteRule, 'id'>) => Promise<import('../types/index').RouteRule>
        update: (rule: import('../types/index').RouteRule) => Promise<import('../types/index').RouteRule>
        delete: (id: string) => Promise<void>
        reorder: (ids: string[]) => Promise<void>
        test: (id: string, model: string) => Promise<import('../types/index').TestResult>
      }
      proxy: {
        status: () => Promise<{ running: boolean; port: number }>
        restart: () => Promise<{ success: boolean }>
      }
      settings: {
        get: () => Promise<import('../types/index').AppSettings>
        update: (s: Partial<import('../types/index').AppSettings>) => Promise<import('../types/index').AppSettings>
      }
      claude: {
        applyConfig: () => Promise<{ success: boolean; error?: string }>
        readConfig: () => Promise<{ success: boolean; content?: string; error?: string }>
        saveConfig: (content: string) => Promise<{ success: boolean; error?: string }>
      }
      onLog: (cb: (entry: unknown) => void) => () => void
    }
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('routes')
  const [proxyStatus, setProxyStatus] = useState<{ running: boolean; port: number } | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [applyMsg, setApplyMsg] = useState('')
  const [applyOk, setApplyOk] = useState(false)

  useEffect(() => {
    window.api.proxy.status().then(setProxyStatus)
    const unsub = window.api.onLog((entry) => {
      setLogs((prev) => [entry as LogEntry, ...prev].slice(0, 200))
    })
    return unsub
  }, [])

  const copyConfig = async () => {
    const port = proxyStatus?.port ?? 3001
    const settings = await window.api.settings.get()
    const aliases = settings.modelAliases ?? {}

    const env: Record<string, string> = {
      ANTHROPIC_BASE_URL: `http://localhost:${port}`,
      ANTHROPIC_AUTH_TOKEN: 'claude-proxy',
    }

    // 添加模型别名
    const aliasKeys = [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_REASONING_MODEL',
    ] as const
    for (const key of aliasKeys) {
      if (aliases[key]) env[key] = aliases[key]!
    }

    const config = JSON.stringify({ env }, null, 2)
    navigator.clipboard.writeText(config)
  }

  const applyConfig = async () => {
    const result = await window.api.claude.applyConfig()
    setApplyOk(result.success)
    setApplyMsg(result.success ? '已写入' : (result.error ?? '写入失败'))
    setTimeout(() => setApplyMsg(''), 3000)
  }

  const tabLabels: Record<Tab, string> = { routes: '路由规则', logs: '请求日志', settings: '设置' }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${proxyStatus?.running ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-gray-500">
            {proxyStatus?.running ? `代理运行中 · 端口 ${proxyStatus.port}` : '代理未运行'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {applyMsg && (
            <span className={`${applyOk ? 'text-green-600' : 'text-red-500'}`}>{applyMsg}</span>
          )}
          <button
            onClick={applyConfig}
            className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
          >
            写入 Claude Code 配置
          </button>
          <button
            onClick={copyConfig}
            className="px-2.5 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            复制配置
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {(['routes', 'logs', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm transition-colors ${
              tab === t
                ? 'text-blue-600 border-b-2 border-blue-500 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tabLabels[t]}
            {t === 'logs' && logs.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                {logs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        {tab === 'routes' && <RoutesPage />}
        {tab === 'logs' && <LogsPage logs={logs} onLogClick={(log) => setSelectedLog(log)} />}
        <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
        {tab === 'settings' && (
          <SettingsPage
            onRestart={async () => {
              await window.api.proxy.restart()
              const s = await window.api.proxy.status()
              setProxyStatus(s)
            }}
          />
        )}
      </div>
    </div>
  )
}
