import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  FileText,
  Database,
  RefreshCw,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

interface AuditLogItem {
  id: string
  agentName: string
  inputPayload: unknown
  outputPayload: unknown
  validationPassed: boolean
  errorMessage: string | null
  createdAt: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const agentLabels: Record<string, string> = {
  'ai-client': 'AI通用调用',
  'JdParserAgent': 'JD解析Agent',
  'ResumeParserAgent': '简历解析Agent',
  'ScoringAgent': '匹配打分Agent',
  'InterviewQuestionAgent': '面试题生成Agent',
  'ReportAggregatorAgent': '报告聚合Agent',
}

const agentColors: Record<string, string> = {
  'ai-client': 'badge',
  'JdParserAgent': 'badge-primary',
  'ResumeParserAgent': 'badge-success',
  'ScoringAgent': 'badge-accent',
  'InterviewQuestionAgent': 'badge-warning',
  'ReportAggregatorAgent': 'badge',
}

const agentNames = ['', 'ai-client', 'JdParserAgent', 'ResumeParserAgent', 'ScoringAgent', 'InterviewQuestionAgent', 'ReportAggregatorAgent']

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const fetchLogs = useCallback(async (page: number, agentName?: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (agentName) params.set('agentName', agentName)
      const res = await fetch(`${API_BASE}/audit-logs?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '日志读取失败，请重试。')
      if (json.success) {
        setLogs(json.data)
        setPagination(json.pagination)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '日志读取失败，请重试。')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs(1, agentFilter)
  }, [fetchLogs, agentFilter])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const truncatePayload = (obj: unknown, maxLen = 300) => {
    if (!obj) return '无'
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '\n...（已截断，点击展开查看完整内容）'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">审计日志</h3>
          <p className="text-sm text-gray-500 mt-1">共 {pagination.total} 条 AI 调用记录</p>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page, agentFilter)}
          className="btn-ghost flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Search className="w-4 h-4 text-gray-400" />
        <select
          value={agentFilter}
          onChange={(e) => {
            setAgentFilter(e.target.value)
            setExpandedIds({})
          }}
          className="input-field max-w-xs text-sm"
        >
          {agentNames.map((name) => (
            <option key={name} value={name}>
              {name ? agentLabels[name] || name : '全部 Agent'}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner mb-4" role="alert">{error}</div>}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : logs.length === 0 ? error ? null : (
        <div className="card p-12 text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无审计日志</h3>
          <p className="text-sm text-gray-500">还没执行过 AI 调用，请先创建岗位并开始匹配</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const isExpanded = expandedIds[log.id]
            return (
              <div key={log.id} className="card overflow-hidden">
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={agentColors[log.agentName] || 'badge'}>
                        {agentLabels[log.agentName] || log.agentName}
                      </span>
                      {log.validationPassed ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          通过
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-danger">
                          <XCircle className="w-3.5 h-3.5" />
                          失败
                        </span>
                      )}
                      {log.errorMessage && (
                        <span className="flex items-center gap-1 text-xs text-warning">
                          <AlertCircle className="w-3.5 h-3.5" />
                          有错误
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.createdAt)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {log.errorMessage && (
                      <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-red-700">错误信息</p>
                            <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{log.errorMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-gray-700">输入数据 (inputPayload)</span>
                        </div>
                        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-80 whitespace-pre-wrap font-mono leading-relaxed">
                          {truncatePayload(log.inputPayload)}
                        </pre>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-semibold text-gray-700">输出数据 (outputPayload)</span>
                        </div>
                        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-80 whitespace-pre-wrap font-mono leading-relaxed">
                          {truncatePayload(log.outputPayload)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => fetchLogs(pagination.page - 1, agentFilter)}
            disabled={pagination.page <= 1}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <button
            onClick={() => fetchLogs(pagination.page + 1, agentFilter)}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
