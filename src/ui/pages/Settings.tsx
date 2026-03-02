import { useState, useEffect, useMemo } from 'react'
import { AppSettings } from '../../types/index'

const TEXTAREA_CLS = 'w-full h-80 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-800 resize-none'

interface Props {
  onRestart: () => Promise<void>
}

const MODEL_ALIAS_KEYS = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_REASONING_MODEL',
] as const

type AliasKey = typeof MODEL_ALIAS_KEYS[number]

const inputCls = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-800'

type ViewMode = 'form' | 'json'

// 完整的 Claude Code 配置类型
interface ClaudeConfig {
  enabledPlugins?: Record<string, boolean>
  env?: Record<string, string>
  forceLoginMethod?: string
  hooks?: unknown
  permissions?: Record<string, unknown>
  skipDangerousModePermissionPrompt?: boolean
  [key: string]: unknown
}

// 解析 Claude Code 配置为完整对象
function parseClaudeConfig(content: string): ClaudeConfig {
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

// 将完整配置对象转换为格式化的 JSON 字符串
function configToJson(config: ClaudeConfig): string {
  return JSON.stringify(config, null, 2)
}

export default function SettingsPage({ onRestart }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [port, setPort] = useState('')
  const [timeout, setTimeout_] = useState('')
  const [aliases, setAliases] = useState<Record<AliasKey, string>>({} as Record<AliasKey, string>)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // Claude Code 配置相关状态
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfig>({})
  const [claudeConfigJson, setClaudeConfigJson] = useState('')
  const [configLoading, setConfigLoading] = useState(false)
  const [configMsg, setConfigMsg] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('form')
  const [jsonError, setJsonError] = useState('')

  // 从 aliases 构建当前 env 对象
  const currentEnv = useMemo(() => {
    const env: Record<string, string> = {}
    for (const k of MODEL_ALIAS_KEYS) {
      if (aliases[k]) {
        env[k] = aliases[k]
      }
    }
    return env
  }, [aliases])

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      setPort(String(s.port))
      setTimeout_(String(s.requestTimeoutMs / 1000))
      const a = {} as Record<AliasKey, string>
      for (const k of MODEL_ALIAS_KEYS) a[k] = s.modelAliases?.[k] ?? ''
      setAliases(a)
    })
  }, [])

  // 加载 Claude Code 配置
  const loadClaudeConfig = async () => {
    setConfigLoading(true)
    const result = await window.api.claude.readConfig()
    if (result.success && result.content) {
      const config = parseClaudeConfig(result.content)
      setClaudeConfig(config)
      setClaudeConfigJson(result.content)
      // 同步到表单
      const env = config.env ?? {}
      const newAliases = { ...aliases } as Record<AliasKey, string>
      for (const k of MODEL_ALIAS_KEYS) {
        newAliases[k] = env[k] ?? ''
      }
      setAliases(newAliases)
      setConfigMsg('已加载')
    } else {
      setConfigMsg(result.error ?? '加载失败')
    }
    setTimeout(() => setConfigMsg(''), 2000)
    setConfigLoading(false)
  }

  // 保存 Claude Code 配置（JSON 视图）
  const saveClaudeConfig = async () => {
    if (!claudeConfigJson.trim()) {
      setConfigMsg('配置不能为空')
      setTimeout(() => setConfigMsg(''), 2000)
      return
    }
    // 验证 JSON 格式
    try {
      JSON.parse(claudeConfigJson)
    } catch {
      setConfigMsg('JSON 格式错误')
      setTimeout(() => setConfigMsg(''), 2000)
      return
    }
    setConfigLoading(true)
    const result = await window.api.claude.saveConfig(claudeConfigJson)
    if (result.success) {
      setConfigMsg('已保存')
    } else {
      setConfigMsg(result.error ?? '保存失败')
    }
    setTimeout(() => setConfigMsg(''), 2000)
    setConfigLoading(false)
  }

  // 切换到 JSON 视图时，将表单数据合并到完整配置中
  const switchToJson = () => {
    // 创建新的配置对象，合并表单中的 env
    const newConfig = {
      ...claudeConfig,
      env: {
        ...(claudeConfig.env ?? {}),
        ...currentEnv,
      },
    }
    setClaudeConfig(newConfig)
    setClaudeConfigJson(configToJson(newConfig))
    setJsonError('')
    setViewMode('json')
  }

  // 切换到表单视图时，解析 JSON 数据到表单
  const switchToForm = () => {
    try {
      const config = parseClaudeConfig(claudeConfigJson)
      setClaudeConfig(config)
      const env = config.env ?? {}
      const newAliases = { ...aliases } as Record<AliasKey, string>
      for (const k of MODEL_ALIAS_KEYS) {
        newAliases[k] = env[k] ?? ''
      }
      setAliases(newAliases)
      setJsonError('')
      setViewMode('form')
    } catch {
      setJsonError('JSON 格式错误，无法切换到表单视图')
    }
  }

  // JSON 编辑器内容变化时同步
  const handleJsonChange = (value: string) => {
    setClaudeConfigJson(value)
    setJsonError('')
    // 尝试解析并同步到表单
    try {
      const config = parseClaudeConfig(value)
      setClaudeConfig(config)
      const env = config.env ?? {}
      const newAliases = { ...aliases } as Record<AliasKey, string>
      for (const k of MODEL_ALIAS_KEYS) {
        newAliases[k] = env[k] ?? ''
      }
      setAliases(newAliases)
    } catch {
      // JSON 解析错误时不更新表单
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const modelAliases: AppSettings['modelAliases'] = {}
    for (const k of MODEL_ALIAS_KEYS) {
      if (aliases[k].trim()) modelAliases[k] = aliases[k].trim()
    }
    const updated = await window.api.settings.update({
      port: Number(port),
      requestTimeoutMs: Number(timeout) * 1000,
      modelAliases,
    })
    setSettings(updated)
    setSaving(false)
    setSavedMsg('已保存')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const handleRestart = async () => {
    setRestarting(true)
    await handleSave()
    await onRestart()
    setRestarting(false)
    setSavedMsg('已保存并重启')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  if (!settings) return null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-8">设置</h2>

      <div className="space-y-6">
        {/* 代理配置 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">代理配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">代理端口</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-2">修改后需点击"保存并重启代理"生效</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">请求超时（秒）</label>
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout_(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        {/* 模型配置 - 包含表单视图和 JSON 视图 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {/* 视图切换开关 */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Claude Code 模型配置</h3>
              <p className="text-xs text-gray-400 mt-1">
                {viewMode === 'form'
                  ? '表单模式 - 填写常用的模型配置项'
                  : 'JSON 模式 - 自由编辑完整配置'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={switchToForm}
                disabled={viewMode === 'form' || !!jsonError}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'form'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                } ${jsonError ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                表单
              </button>
              <button
                onClick={switchToJson}
                disabled={viewMode === 'json'}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'json'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          {/* 表单视图 - 只展示 env 下的配置项 */}
          {viewMode === 'form' && (
            <>
              <p className="text-xs text-gray-400 mb-5">填写后点击"保存配置"生效，留空则不写入该项</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODEL_ALIAS_KEYS.map((k) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{k}</label>
                    <input
                      value={aliases[k] ?? ''}
                      onChange={(e) => setAliases((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="留空则不写入"
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={switchToJson}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  切换到 JSON 视图编辑完整配置
                </button>
              </div>
            </>
          )}

          {/* JSON 视图 - 展示完整配置 */}
          {viewMode === 'json' && (
            <>
              {jsonError && (
                <p className="text-sm text-red-500 mb-3">{jsonError}</p>
              )}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={loadClaudeConfig}
                  disabled={configLoading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {configLoading && !claudeConfigJson ? '加载中…' : '加载配置'}
                </button>
                <button
                  onClick={saveClaudeConfig}
                  disabled={configLoading || !claudeConfigJson}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {configLoading && claudeConfigJson ? '保存中…' : '保存配置'}
                </button>
                {configMsg && (
                  <span className={`text-sm ${configMsg.includes('失败') || configMsg.includes('错误') ? 'text-red-500' : 'text-green-600'}`}>
                    {configMsg}
                  </span>
                )}
              </div>
              <textarea
                value={claudeConfigJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                className={TEXTAREA_CLS}
                placeholder='点击"加载配置"读取当前配置文件'
              />
              <p className="text-xs text-gray-400 mt-4">
                保存后将直接写入 ~/.claude/settings.json，请确保 JSON 格式正确
              </p>
            </>
          )}
        </section>

        {/* 保存按钮 */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {restarting ? '重启中…' : '保存并重启代理'}
          </button>
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
        </div>
      </div>
    </div>
  )
}
