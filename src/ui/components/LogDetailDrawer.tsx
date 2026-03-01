import { LogEntry } from '../../types/index'

interface Props {
  log: LogEntry | null
  onClose: () => void
}

export default function LogDetailDrawer({ log, onClose }: Props) {
  if (!log) return null

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* 抽屉 */}
      <div className="fixed right-0 top-0 bottom-0 w-[600px] bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-medium">请求详情</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 space-y-6">
          {/* 基本信息 */}
          <section>
            <h3 className="text-sm font-medium text-gray-600 mb-2">基本信息</h3>
            <div className="bg-gray-50 rounded p-3 text-xs font-mono space-y-1">
              <div><span className="text-gray-500">时间:</span> {new Date(log.timestamp).toLocaleString()}</div>
              <div><span className="text-gray-500">模型:</span> {log.model}</div>
              <div><span className="text-gray-500">规则:</span> {log.matchedRule ?? '无匹配'}</div>
              <div><span className="text-gray-500">上游:</span> {log.upstreamUrl ?? '-'}</div>
              <div><span className="text-gray-500">延迟:</span> {log.latencyMs}ms</div>
              <div><span className="text-gray-500">状态:</span> <span className={log.statusCode < 300 ? 'text-green-600' : 'text-red-600'}>{log.statusCode}</span></div>
            </div>
          </section>

          {/* Token 统计 */}
          {log.tokens && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Token 消耗</h3>
              <div className="bg-gray-50 rounded p-3 text-xs font-mono flex gap-6">
                <div><span className="text-gray-500">Input:</span> {log.tokens.input}</div>
                <div><span className="text-gray-500">Output:</span> {log.tokens.output}</div>
                <div><span className="text-gray-500">Total:</span> {log.tokens.total}</div>
              </div>
            </section>
          )}

          {/* 请求信息 */}
          {log.request && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">请求</h3>
              <div className="space-y-2">
                <div className="text-xs font-mono">
                  <span className="text-blue-600">{log.request.method}</span> {log.request.path}
                </div>
                <details className="bg-gray-50 rounded">
                  <summary className="p-2 text-xs cursor-pointer text-gray-500">Headers</summary>
                  <pre className="p-2 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(log.request.headers, null, 2)}
                  </pre>
                </details>
                {log.request.body && (
                  <details className="bg-gray-50 rounded">
                    <summary className="p-2 text-xs cursor-pointer text-gray-500">Body</summary>
                    <pre className="p-2 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(log.request.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </section>
          )}

          {/* 响应信息 */}
          {log.response && (
            <section>
              <h3 className="text-sm font-medium text-gray-600 mb-2">响应</h3>
              <div className="space-y-2">
                {log.response.error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
                    错误: {log.response.error}
                  </div>
                )}
                <details className="bg-gray-50 rounded">
                  <summary className="p-2 text-xs cursor-pointer text-gray-500">Headers</summary>
                  <pre className="p-2 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(log.response.headers, null, 2)}
                  </pre>
                </details>
                {log.response.body && (
                  <details className="bg-gray-50 rounded">
                    <summary className="p-2 text-xs cursor-pointer text-gray-500">Body</summary>
                    <pre className="p-2 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(log.response.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
