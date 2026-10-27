import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  User,
  Briefcase,
  Target,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  Star,
  FileQuestion,
  CheckCircle2,
  HelpCircle,
  FileText,
  ArrowUpRight,
  Search,
  Lightbulb,
  Download,
} from 'lucide-react'
import { useAppStore } from '@/store/jobs'
import RadarChart from '@/components/RadarChart'
import type { MatchReport, DimensionScore, GapItem, RiskItem, InterviewQuestionDTO } from '../../shared/types'

const confidenceColors: Record<string, string> = {
  high: 'badge-success',
  medium: 'badge-warning',
  low: 'badge-danger',
}

const confidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export default function Report() {
  const { id, candidateId } = useParams<{ id: string; candidateId: string }>()
  const { fetchReport } = useAppStore()

  const [report, setReport] = useState<MatchReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedDims, setExpandedDims] = useState<Record<string, boolean>>({})
  const [expandedGaps, setExpandedGaps] = useState<Record<number, boolean>>({})
  const [basicInfo, setBasicInfo] = useState<{ name: string; phone: string; email: string } | null>(null)

  useEffect(() => {
    if (!id || !candidateId) return
    setLoading(true)
    setError('')
    fetchReport(id, candidateId).then((r) => {
      setReport(r)
      if (r) {
        setBasicInfo({ name: r.candidateName || '', phone: '', email: '' })
        const initial: Record<string, boolean> = {}
        r.dimensionScores.forEach((dim) => { initial[dim.dimensionId] = true })
        setExpandedDims(initial)
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [id, candidateId, fetchReport])

  const toggleDim = (dimensionId: string) => {
    setExpandedDims((prev) => ({ ...prev, [dimensionId]: !prev[dimensionId] }))
  }

  const toggleGap = (idx: number) => {
    setExpandedGaps((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const getMatchLevel = (score: number) => {
    if (score >= 0.8) return { label: '高度匹配', color: 'text-success' }
    if (score >= 0.6) return { label: '部分匹配', color: 'text-accent' }
    return { label: '差距较大', color: 'text-danger' }
  }

  // 导出 PDF：走浏览器打印（打印对话框可另存为 PDF），打印样式见 index.css
  const handleExportPdf = () => {
    const prevTitle = document.title
    document.title = `${report?.candidateName || ''} - 匹配报告 - TalentFit`
    window.print()
    document.title = prevTitle
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-primary">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">加载报告中...</span>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="card p-12 text-center">
        <FileQuestion className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{error || '未找到匹配报告'}</p>
        <a href={`/jobs/${id}`} className="btn-primary inline-block mt-4">返回候选人列表</a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{basicInfo?.name || report.candidateName}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {report.jobTitle}
                </span>
                {basicInfo?.phone && <span>{basicInfo.phone}</span>}
                {basicInfo?.email && <span>{basicInfo.email}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={handleExportPdf}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 print:hidden"
          >
            <Download className="w-3.5 h-3.5" />
            导出 PDF
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            岗位达标率
          </h4>
          <span className="text-xs text-gray-400">* 仅供参考，非录用结论</span>
        </div>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-bold text-primary">
            {report.overallMatch}%
          </span>
          <span className={`text-lg font-medium mb-1 ${getMatchLevel(report.overallMatch / 100).color}`}>
            {getMatchLevel(report.overallMatch / 100).label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-1">P-J Fit（人岗匹配 · 可验证维度）</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">{report.pjMatch}%</span>
              <span className={`text-xs ${getMatchLevel((report.pjMatch || 0) / 100).color}`}>
                {getMatchLevel((report.pjMatch || 0) / 100).label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">基于专业知识、问题解决、数据分析、沟通协调、执行力5个维度</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">P-O Fit（人组织匹配 · 待验证维度）</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-accent">{report.poMatch}%</span>
              <span className={`text-xs ${getMatchLevel((report.poMatch || 0) / 100).color}`}>
                {getMatchLevel((report.poMatch || 0) / 100).label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">基于学习敏锐度、团队文化契合度2个维度，需面试核实</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h4 className="font-medium text-gray-900 mb-4">能力维度雷达图</h4>
        <div className="max-w-lg mx-auto">
          <RadarChart
            labels={report.dimensionScores.map((d) => d.dimensionName)}
            requiredLevels={report.dimensionScores.map((d) => d.requiredLevel)}
            candidateLevels={report.dimensionScores.map((d) => d.candidateLevel)}
            verifiableDimensions={report.dimensionScores.map((d) => d.verifiable)}
          />
        </div>
      </div>

      <div className="card p-6">
        <h4 className="font-medium text-gray-900 mb-1">逐维度详情</h4>
        <p className="text-xs text-gray-500 mb-4">
          每个维度包含证据引用、岗位要求等级说明、候选人评分依据和差距分析
        </p>
        <div className="space-y-4">
          {report.dimensionScores.map((dim: DimensionScore) => {
            const isExpanded = expandedDims[dim.dimensionId] !== false
            const hasGap = dim.candidateLevel < dim.requiredLevel
            return (
              <div key={dim.dimensionId} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDim(dim.dimensionId)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{dim.dimensionName}</span>
                      {dim.verifiable ? (
                        <span className="badge-success text-xs">可验证</span>
                      ) : (
                        <span className="badge-warning text-xs">待验证</span>
                      )}
                      <span className={confidenceColors[dim.confidence] || 'badge'}>
                        可信度: {confidenceLabels[dim.confidence] || dim.confidence}
                      </span>
                      {hasGap && (
                        <span className="badge-danger text-xs">差距{dim.requiredLevel - dim.candidateLevel}级</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">
                        要求{dim.requiredLevel}级 / 得分{dim.candidateLevel}级
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-12">得分</span>
                    <div className="flex-1 progress-bar">
                      <div
                        className={`progress-fill ${
                          dim.candidateLevel >= dim.requiredLevel ? 'bg-success' : 'bg-accent'
                        }`}
                        style={{ width: `${(dim.candidateLevel / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{dim.candidateLevel}/5</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-gray-700">证据引用</span>
                      </div>
                      <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                        {dim.evidence || '无'}
                      </div>
                    </div>

                    {dim.requiredLevelReason && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-semibold text-gray-700">岗位要求等级说明（为什么要求L{dim.requiredLevel}级）</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {dim.requiredLevelReason}
                        </div>
                      </div>
                    )}

                    {dim.candidateLevelReason && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="w-3.5 h-3.5 text-success" />
                          <span className="text-xs font-semibold text-gray-700">候选人评分依据（为什么得L{dim.candidateLevel}级）</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {dim.candidateLevelReason}
                        </div>
                      </div>
                    )}

                    {dim.gapNote && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-3.5 h-3.5 text-warning" />
                          <span className="text-xs font-semibold text-gray-700">差距分析与面试建议</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {dim.gapNote}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {report.gaps.length > 0 && (
        <div className="card p-6 border-l-4 border-accent">
          <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-accent" />
            差距与待验证清单
          </h4>
          <p className="text-xs text-gray-500 mb-4">
            以下列出了候选人与岗位要求之间存在差距或无法通过简历验证的维度，每项包含详细的差距说明和面试建议
          </p>
          <div className="space-y-3">
            {report.gaps.map((gap: GapItem, idx: number) => {
              const isExpanded = expandedGaps[idx] !== false
              return (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGap(idx)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <HelpCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{gap.dimensionName}</p>
                            <span className={`text-xs ${
                              gap.gapType === 'low_score' ? 'badge-danger' : 'badge-warning'
                            }`}>
                              {gap.gapType === 'low_score' ? '评分不足' : '无法验证'}
                            </span>
                            {gap.dimensionDetail && (
                              <span className="text-xs text-gray-500">
                                L{gap.dimensionDetail.candidateLevel} → 要求 L{gap.dimensionDetail.requiredLevel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{gap.description}</p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-semibold text-gray-700">岗位要求依据</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {gap.requirementReference || '暂无详情'}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="w-3.5 h-3.5 text-success" />
                          <span className="text-xs font-semibold text-gray-700">候选人现状</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {gap.candidateActual || '暂无详情'}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-3.5 h-3.5 text-warning" />
                          <span className="text-xs font-semibold text-gray-700">差距详情与验证建议</span>
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
                          {gap.whatIsMissing || '暂无详情'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {report.interviewQuestions?.length > 0 && (
        <div className="card p-6">
          <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-accent" />
            面试官关注清单
          </h4>
          <div className="space-y-3">
            {report.interviewQuestions.map((q: InterviewQuestionDTO, idx: number) => (
              <div key={idx} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                  <span className={`text-xs ${
                    q.gapType === 'low_score' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {q.gapType === 'low_score' ? '评分差距' : '待验证'}
                  </span>
                  {q.dimensionName && (
                    <span className="text-xs text-gray-500">{q.dimensionName}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">{q.question}</p>
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>关注点：{q.whatToListenFor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="card p-6 border-l-4 border-warning">
          <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-warning" />
            风险与异常提示
          </h4>
          <div className="space-y-2">
            {report.risks.map((risk: RiskItem, idx: number) => (
              <div key={idx} className="flex items-start gap-3 bg-orange-50 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-900">{risk.description}</p>
                  <span className="text-xs text-gray-500 mt-1 inline-block">{risk.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4 bg-gray-50">
        <p className="text-xs text-gray-400 leading-relaxed text-center">
          本报告由 AI 系统自动生成，仅基于候选人简历信息与岗位要求进行匹配度分析，仅供人力资源决策参考，不构成任何形式的录用结论或推荐意见。最终录用决策应结合面试表现、背景调查等多方面信息综合判断。
        </p>
      </div>
    </div>
  )
}
