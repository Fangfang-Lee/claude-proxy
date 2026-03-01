import { LogEntry } from '../../types/index'

interface Props {
  logs: LogEntry[]
  onLogClick?: (log: LogEntry) => void
}

export default function LogsPage({ logs, onLogClick }: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm">暂无请求记录</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-sm font-medium text-gray-600 mb-3">请求日志 · 最近 {logs.length} 条</h2>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div
            key={log.id}
            onClick={() => onLogClick?.(log)}
            className={`flex items-center gap-4 px-3 py-2 rounded text-xs font-mono cursor-pointer hover:bg-blue-50 ${
              i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}
          >
            <span className="text-gray-400 w-20 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-blue-500 w-48 truncate shrink-0">{log.model}</span>
            <span className="text-gray-500 flex-1 truncate">
              {log.matchedRule ?? <span className="text-red-400">无匹配规则</span>}
            </span>
            <span className="text-gray-400 w-24 text-right shrink-0">
              {log.tokens ? `${log.tokens.input} → ${log.tokens.output} (${log.tokens.total})` : '-'}
            </span>
            <span className="text-gray-400 w-16 text-right shrink-0">{log.latencyMs}ms</span>
            <span
              className={`w-10 text-right shrink-0 font-medium ${
                log.statusCode < 300 ? 'text-green-600' : log.statusCode < 500 ? 'text-amber-500' : 'text-red-500'
              }`}
            >
              {log.statusCode}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
