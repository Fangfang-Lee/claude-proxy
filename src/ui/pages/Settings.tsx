import { useState, useEffect } from 'react'
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

export default function SettingsPage({ onRestart }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [port, setPort] = useState('')
  const [timeout, setTimeout_] = useState('')
  const [aliases, setAliases] = useState<Record<AliasKey, string>>({} as Record<AliasKey, string>)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [claudeConfig, setClaudeConfig] = useState('')
  const [configLoading, setConfigLoading] = useState(false)
  const [configMsg, setConfigMsg] = useState('')

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

  const loadClaudeConfig = async () => {
    setConfigLoading(true)
    const result = await window.api.claude.readConfig()
    if (result.success && result.content) {
      setClaudeConfig(result.content)
      setConfigMsg('已加载')
    } else {
      setConfigMsg(result.error ?? '加载失败')
    }
    setTimeout(() => setConfigMsg(''), 2000)
    setConfigLoading(false)
  }

  const saveClaudeConfig = async () => {
    if (!claudeConfig.trim()) {
      setConfigMsg('配置不能为空')
      setTimeout(() => setConfigMsg(''), 2000)
      return
    }
    setConfigLoading(true)
    const result = await window.api.claude.saveConfig(claudeConfig)
    if (result.success) {
      setConfigMsg('已保存')
    } else {
      setConfigMsg(result.error ?? '保存失败')
    }
    setTimeout(() => setConfigMsg(''), 2000)
    setConfigLoading(false)
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：代理配置 + 模型别名 */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-5">代理配置</h3>
            <div className="space-y-5">
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

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">模型别名</h3>
            <p className="text-xs text-gray-400 mb-5">写入 Claude Code 配置时生效，留空则不写入</p>
            <div className="space-y-4">
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
          </section>

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

        {/* 右侧：Claude Code 配置 */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Claude Code 配置</h3>
                <p className="text-xs text-gray-400 mt-1">手动编辑 Claude Code 配置文件</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadClaudeConfig}
                  disabled={configLoading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {configLoading && !claudeConfig ? '加载中…' : '加载配置'}
                </button>
                <button
                  onClick={saveClaudeConfig}
                  disabled={configLoading || !claudeConfig}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {configLoading && claudeConfig ? '保存中…' : '保存配置'}
                </button>
              </div>
            </div>
            {configMsg && (
              <p className={`text-sm mb-3 ${configMsg.includes('失败') || configMsg.includes('不能为空') ? 'text-red-500' : 'text-green-600'}`}>
                {configMsg}
              </p>
            )}
            {claudeConfig ? (
              <textarea
                value={claudeConfig}
                onChange={(e) => setClaudeConfig(e.target.value)}
                className={TEXTAREA_CLS}
                placeholder='点击"加载配置"读取当前配置文件'
              />
            ) : (
              <div className={`${TEXTAREA_CLS} flex items-center justify-center text-gray-400`}>
                点击"加载配置"读取当前配置文件
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">保存后将直接写入 ~/.claude/settings.json，请确保 JSON 格式正确</p>
          </section>
        </div>
      </div>
    </div>
  )
}
