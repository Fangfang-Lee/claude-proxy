import { useState, useEffect } from 'react'
import { AppSettings } from '../../types/index'

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

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-800'

export default function SettingsPage({ onRestart }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [port, setPort] = useState('')
  const [timeout, setTimeout_] = useState('')
  const [aliases, setAliases] = useState<Record<AliasKey, string>>({} as Record<AliasKey, string>)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

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
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-800 mb-6">设置</h2>

      <div className="space-y-6">
        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">代理配置</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">代理端口</label>
            <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">修改后需点击"保存并重启代理"生效</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">请求超时（秒）</label>
            <input type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} className={inputCls} />
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">模型别名</h3>
            <p className="text-xs text-gray-400 mt-1">写入 Claude Code 配置时生效，留空则不写入</p>
          </div>
          {MODEL_ALIAS_KEYS.map((k) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{k}</label>
              <input
                value={aliases[k] ?? ''}
                onChange={(e) => setAliases((prev) => ({ ...prev, [k]: e.target.value }))}
                placeholder="留空则不写入"
                className={inputCls}
              />
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors disabled:opacity-50"
          >
            {restarting ? '重启中…' : '保存并重启代理'}
          </button>
          {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
        </div>
      </div>
    </div>
  )
}
