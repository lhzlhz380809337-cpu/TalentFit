import { useEffect, useState } from 'react'
import {
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '@/store/jobs'
import type { DimensionTemplateDTO } from '../../shared/types'

const jobFamilyLabels: Record<string, string> = {
  technical: '技术族',
  managerial: '管理族',
  functional: '职能族',
}

export default function Templates() {
  const { fetchTemplates } = useAppStore()
  const [templates, setTemplates] = useState<DimensionTemplateDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchTemplates().then((data) => {
      setTemplates(data)
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [fetchTemplates])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Layers className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无维度模板</h3>
        <p className="text-sm text-gray-500">{error || '尚无评估标准，请检查安装包是否完整。'}</p>
      </div>
    )
  }

  const grouped = templates.reduce((acc, t) => {
    const key = t.jobFamily || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {} as Record<string, DimensionTemplateDTO[]>)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">维度模板管理</h3>
        <p className="text-sm text-gray-500 mt-1">管理各岗位族的评估维度与行为锚点</p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([family, dims]) => (
          <div key={family}>
            <h4 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
              {jobFamilyLabels[family] || family}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dims.map((template) => (
                <div key={template.id} className="card overflow-hidden">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(template.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-900 text-sm">{template.name}</h5>
                          <p className="text-xs text-gray-400">{template.dimensionKey}</p>
                        </div>
                      </div>
                      {template.verifiable ? (
                        <span className="badge-success text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          可验证
                        </span>
                      ) : (
                        <span className="badge-warning text-xs">待验证</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>满分: {template.maxScore}</span>
                      <span>权重: {template.weight}%</span>
                      <span>锚点: {template.anchors?.length || 0} 级</span>
                    </div>
                    {template.anchors && template.anchors.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        {expandedId === template.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        行为锚点
                      </div>
                    )}
                  </div>

                  {expandedId === template.id && template.anchors && (
                    <div className="border-t border-gray-100">
                      {template.anchors
                        .sort((a, b) => a.level - b.level)
                        .map((anchor) => (
                          <div
                            key={anchor.level}
                            className="flex items-start gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <span className="text-xs font-medium text-primary w-8 flex-shrink-0">
                              L{anchor.level}
                            </span>
                            <p className="text-xs text-gray-700">{anchor.description}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
