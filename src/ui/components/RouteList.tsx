import { useState } from 'react'
import { RouteRule, TestResult } from '../../types/index'

interface Props {
  rules: RouteRule[]
  onEdit: (rule: RouteRule) => void
  onDelete: (id: string) => void
  onToggle: (rule: RouteRule) => void
  onReorder: (ids: string[]) => void
}

export default function RouteList({ rules, onEdit, onDelete, onToggle }: Props) {
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testInputId, setTestInputId] = useState<string | null>(null)
  const [testModel, setTestModel] = useState('')
  const [testResult, setTestResult] = useState<{ id: string; result: TestResult } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleTestClick = (rule: RouteRule) => {
    setTestInputId(rule.id)
    setTestModel('')
    setTestResult(null)
  }

  const handleTestSubmit = async (rule: RouteRule) => {
    if (!testModel.trim()) return
    setTestingId(rule.id)
    const result = await window.api.routes.test(rule.id, testModel.trim())
    setTestResult({ id: rule.id, result })
    setTestingId(null)
  }

  const closeTestModal = () => {
    setTestInputId(null)
    setTestModel('')
  }

  const currentTestRule = testInputId ? rules.find(r => r.id === testInputId) : null

  if (rules.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">🔀</div>
        <p className="text-sm">暂无规则，点击右上角"+ 新增规则"开始配置</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {rules
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((rule) => {
            return (
              <div
                key={rule.id}
                className={`p-4 bg-white rounded-lg border transition-shadow hover:shadow-sm ${
                  rule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle */}
                    <button
                      onClick={() => onToggle(rule)}
                      className={`w-9 h-5 rounded-full transition-colors shrink-0 ${
                        rule.enabled ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${
                          rule.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800">{rule.name}</span>
                        <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                          {rule.pattern}
                        </span>
                        <span className="text-xs text-gray-400">优先级 {rule.priority}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{rule.upstream.baseUrl}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button
                      onClick={() => handleTestClick(rule)}
                      disabled={testingId === rule.id}
                      className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-40"
                    >
                      {testingId === rule.id ? '测试中…' : '测试'}
                    </button>
                    <button
                      onClick={() => onEdit(rule)}
                      className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      编辑
                    </button>
                    {confirmDeleteId === rule.id ? (
                      <>
                        <button
                          onClick={() => { onDelete(rule.id); setConfirmDeleteId(null) }}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors"
                        >
                          确认删除
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(rule.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {currentTestRule && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={closeTestModal}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-800 mb-4">测试路由 - {currentTestRule.name}</h3>
            <input
              autoFocus
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTestSubmit(currentTestRule)
                if (e.key === 'Escape') closeTestModal()
              }}
              placeholder={`输入模型名，如 ${currentTestRule.defaultTargetModel}`}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-4"
            />
            {testResult && (
              <div className={`mb-4 p-3 rounded text-sm ${testResult.result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {testResult.result.success ? `✓ 连接成功 (${testResult.result.latencyMs}ms)` : `✗ ${testResult.result.error}`}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeTestModal}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => handleTestSubmit(currentTestRule)}
                disabled={testingId !== null}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors disabled:opacity-50"
              >
                {testingId ? '测试中...' : '测试'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
