import { useState, useEffect } from 'react'
import { RouteRule } from '../../types/index'
import RouteList from '../components/RouteList'
import RouteForm from '../components/RouteForm'

export default function RoutesPage() {
  const [rules, setRules] = useState<RouteRule[]>([])
  const [editing, setEditing] = useState<RouteRule | null>(null)
  const [showForm, setShowForm] = useState(false)

  const reload = () => window.api.routes.list().then(setRules)
  useEffect(() => { reload() }, [])

  const handleSave = async (data: Omit<RouteRule, 'id'>) => {
    if (editing) await window.api.routes.update({ ...data, id: editing.id })
    else await window.api.routes.add(data)
    setShowForm(false)
    setEditing(null)
    reload()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">路由规则</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
        >
          + 新增规则
        </button>
      </div>

      <RouteList
        rules={rules}
        onEdit={(rule) => { setEditing(rule); setShowForm(true) }}
        onDelete={async (id) => { await window.api.routes.delete(id); reload() }}
        onToggle={async (rule) => { await window.api.routes.update({ ...rule, enabled: !rule.enabled }); reload() }}
        onReorder={async (ids) => { await window.api.routes.reorder(ids); reload() }}
      />

      {showForm && (
        <RouteForm
          initial={editing ?? undefined}
          existingPriorities={rules.map((r) => r.priority)}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
