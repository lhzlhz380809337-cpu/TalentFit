import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import RadarChart from '@/components/RadarChart'
import type { MatchReport } from '../../shared/types'

export default function Compare() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const idsValue = params.get('ids') || ''
  const ids = useMemo(() => [...new Set(idsValue.split(',').filter(Boolean))], [idsValue])
  const [reports, setReports] = useState<MatchReport[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    setError(''); setLoading(true)
    if (ids.length < 2 || ids.length > 4) { setError('请选择同一岗位的 2–4 位候选人。'); setLoading(false); return }
    Promise.all(ids.map(cid => api<MatchReport>(`/jobs/${id}/candidates/${cid}/report`)))
      .then(r => { if (live) setReports(r) }).catch(e => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [id, ids])
  const dims = [...new Map(reports.flatMap(r => r.dimensionScores).map(d => [d.dimensionId, d])).values()].map(d => ({ ...d, weight: Number((d.weight ?? 1).toFixed(2)) }))
  const exportCsv = () => {
    const rows = [['比较项目', ...reports.map(r => r.candidateName)], ['岗位达标率', ...reports.map(r => `${r.overallMatch}%`)], ...dims.flatMap(d => [
      [d.dimensionName, ...reports.map(r => { const s = r.dimensionScores.find(s => s.dimensionId === d.dimensionId); return s ? `L${s.candidateLevel} / 目标 L${s.requiredLevel}` : '暂无评分' })],
      [`${d.dimensionName} — 证据`, ...reports.map(r => r.dimensionScores.find(s => s.dimensionId === d.dimensionId)?.evidence || '')],
    ])]
    const escape = (s: string) => `"${s.replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = '候选人比较.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="workspace-page"><Link className="back-link" to={`/jobs/${id}`}><ArrowLeft size={15} />返回候选人</Link>
    <div className="page-heading"><div><span className="eyebrow">SIDE BY SIDE</span><h1>候选人比较</h1><p>{reports[0]?.jobTitle || '同一岗位，同一把尺子。'} · 先看差异，再核对证据</p></div>{reports.length > 0 && !error && <button className="btn-primary inline-flex gap-2 items-center print:hidden" onClick={exportCsv}><Download size={16} />导出比较表</button>}</div>
    {loading ? <div className="loading-state"><Loader2 className="animate-spin" />正在整理比较…</div> : error ? <div className="notice error" role="alert">{error}</div> : <>
      <div className="notice mb-5">达标率 = 各维度 min（当前等级 ÷ 岗位目标，100%）按岗位权重加权。超过要求的优势单列；待核实分数属于初步判断。</div>
      <div className="card overflow-x-auto"><table className="compare-table"><thead><tr><th>对照项目</th>{reports.map((r, i) => <th key={ids[i]}><span className="compare-dot" style={{ background: ['#72ddd2', '#b3a3ff', '#efbe77', '#82b7fb'][i] }} />{r.candidateName}<Link to={`/jobs/${id}/candidates/${ids[i]}/report`}>查看完整报告 ↗</Link></th>)}</tr></thead><tbody>
        <tr><th>岗位达标率</th>{reports.map((r, i) => <td key={ids[i]}><strong className="compare-score">{r.overallMatch}<small>%</small></strong></td>)}</tr>
        <tr><th>超出要求</th>{reports.map((r, i) => <td key={ids[i]}>{r.dimensionScores.filter(d => d.candidateLevel > d.requiredLevel).map(d => <p key={d.dimensionId} className="text-success mb-2">{d.dimensionName} +{d.candidateLevel - d.requiredLevel} 级</p>)}{!r.dimensionScores.some(d => d.candidateLevel > d.requiredLevel) && <span className="muted">暂无超出目标的维度</span>}</td>)}</tr>
        <tr><th>需要核实</th>{reports.map((r, i) => <td key={ids[i]}>{r.dimensionScores.filter(d => !d.verifiable || d.confidence === 'low').map(d => <p className="text-warning mb-2" key={d.dimensionId}>{d.dimensionName}</p>)}{!r.dimensionScores.some(d => !d.verifiable || d.confidence === 'low') && <span className="muted">请结合原文复核</span>}</td>)}</tr>
        {dims.map(d => <tr key={d.dimensionId}><th>{d.dimensionName}<small>岗位目标 L{d.requiredLevel} · 权重 {d.weight ?? 1}</small></th>{reports.map((r, i) => { const s = r.dimensionScores.find(s => s.dimensionId === d.dimensionId); return <td key={ids[i]}>{s ? <><span className={s.candidateLevel >= s.requiredLevel ? 'badge-success' : 'badge-warning'}>L{s.candidateLevel} · {s.candidateLevel >= s.requiredLevel ? '达到目标' : `差 ${s.requiredLevel - s.candidateLevel} 级`}</span><p className="mt-3 leading-6">{s.candidateLevelReason || s.gapNote || '展开查看原文依据'}</p><details className="mt-3"><summary>原文证据{(!s.verifiable || s.confidence === 'low') && ' · 待核实'}</summary><p className="whitespace-pre-wrap mt-3 muted leading-6">{s.evidence || '未找到足够证据'}</p></details></> : <span className="muted">暂无评分</span>}</td> })}</tr>)}
        <tr><th>建议追问</th>{reports.map((r, i) => <td key={ids[i]}>{r.interviewQuestions.slice(0, 3).map((q, j) => <p key={j} className="mb-3 leading-6">{j + 1}. {q.question}</p>)}</td>)}</tr>
      </tbody></table></div>
      <div className="card p-6 mt-5"><h2 className="text-lg mb-4">能力分布</h2><div className="max-w-2xl mx-auto"><RadarChart labels={dims.map(d => d.dimensionName)} requiredLevels={dims.map(d => d.requiredLevel)} candidateLevels={[]} verifiableDimensions={dims.map(d => d.verifiable)} series={reports.map(r => ({ label: r.candidateName, levels: dims.map(d => r.dimensionScores.find(s => s.dimensionId === d.dimensionId)?.candidateLevel ?? null) }))} /></div></div>
    </>}
  </div>
}
