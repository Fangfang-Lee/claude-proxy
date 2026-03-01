import { useState } from 'react'
import { RouteRule, ModelMapping } from '../../types/index'

interface Props {
  initial?: RouteRule
  existingPriorities: number[]
  onSave: (data: Omit<RouteRule, 'id'>) => void
  onCancel: () => void
}

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-800 placeholder-gray-300'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function RouteForm({ initial, existingPriorities, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [pattern, setPattern] = useState(initial?.pattern ?? '')
  const [baseUrl, setBaseUrl] = useState(initial?.upstream.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(initial?.upstream.apiKey ?? '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [priority, setPriority] = useState(String(initial?.priority ?? 10))
  const [defaultTargetModel, setDefaultTargetModel] = useState(initial?.defaultTargetModel ?? '')
  const [mappings, setMappings] = useState<ModelMapping[]>(initial?.modelMappings ?? [])
  const [priorityError, setPriorityError] = useState('')

  const addMapping = () => setMappings([...mappings, { pattern: '', targetModel: '' }])
  const updateMapping = (i: number, field: keyof ModelMapping, value: string) =>
    setMappings(mappings.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  const removeMapping = (i: number) => setMappings(mappings.filter((_, idx) => idx !== i))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = Number(priority)
    const isDuplicate = existingPriorities
      .filter((existing) => initial?.priority !== existing)
      .includes(p)
    if (isDuplicate) { setPriorityError(`优先级 ${p} 已被其他规则使用`); return }
    onSave({
      name, pattern,
      upstream: { baseUrl, apiKey },
      modelMappings: mappings.filter((m) => m.pattern && m.targetModel),
      defaultTargetModel,
      priority: p,
      enabled: initial?.enabled ?? true,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-800 mb-5">{initial ? '编辑规则' : '新增规则'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="名称" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：Claude 中转站" required className={inputCls} />
          </Field>

          <Field label="上游匹配模式" required hint="决定走哪个上游，如 claude-* 或 minimax-*">
            <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="claude-*" required className={inputCls} />
          </Field>

          <Field label="上游 Base URL" required>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/anthropic" required className={inputCls} />
          </Field>

          <Field label="API Key" required>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                required
                className={`${inputCls} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          <Field label="默认目标模型" required hint="没有模型映射命中时，转发给上游的模型名">
            <input value={defaultTargetModel} onChange={(e) => setDefaultTargetModel(e.target.value)} placeholder="如：claude-sonnet-4-6" required className={inputCls} />
          </Field>

          <Field label="优先级" hint="数字越小越优先，不能与其他规则重复">
            <input type="number" value={priority} onChange={(e) => { setPriority(e.target.value); setPriorityError('') }} className={inputCls} />
            {priorityError && <p className="text-xs text-red-500 mt-1">{priorityError}</p>}
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">模型映射（可选）</label>
              <button type="button" onClick={addMapping} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                + 添加映射
              </button>
            </div>
            {mappings.length === 0 && (
              <p className="text-xs text-gray-400 py-2">无映射时所有请求使用默认目标模型</p>
            )}
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={m.pattern} onChange={(e) => updateMapping(i, 'pattern', e.target.value)} placeholder="匹配模式，如 claude-sonnet-*" className={`${inputCls} flex-1`} />
                  <span className="text-gray-300 shrink-0">→</span>
                  <input value={m.targetModel} onChange={(e) => updateMapping(i, 'targetModel', e.target.value)} placeholder="目标模型名" className={`${inputCls} flex-1`} />
                  <button type="button" onClick={() => removeMapping(i)} className="text-gray-300 hover:text-red-400 shrink-0 px-1 transition-colors">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
              取消
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
