import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Clipboard, Loader2, CheckCircle2, AlertCircle, X, Search, GitCompareArrows, FileText, ArrowUpRight, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useUploads } from '@/store/uploads'
import type { CandidateBrief, JDRequirement } from '../../shared/types'

type Job = { id: string; title: string; rawText: string; requirements: JDRequirement[] }
const labels = { queued: '等待处理', uploading: '解析简历', scoring: '匹配评分', done: '已完成', error: '需要处理' }

export default function JobDetail() {
  const { id = '' } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<CandidateBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('score')
  const [selected, setSelected] = useState<string[]>([])
  const [text, setText] = useState('')
  const [showText, setShowText] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState<string[]>([])
  const { tasks, add, retry, remove } = useUploads()
  const queue = tasks.filter(t => t.jobId === id)
  const progressKey = queue.map(t => `${t.key}:${t.status}:${t.candidateId || ''}`).join('|')
  const active = queue.filter(t => ['queued', 'uploading', 'scoring'].includes(t.status)).length
  const completed = queue.filter(t => t.status === 'done').length

  useEffect(() => {
    let live = true
    setLoading(true); setSelected([]); setError('')
    Promise.all([api<Job>(`/jobs/${id}`), api<CandidateBrief[]>(`/jobs/${id}/candidates`)])
      .then(([j, c]) => { if (live) { setJob(j); setCandidates(c) } })
      .catch(e => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [id])

  useEffect(() => {
    let live = true
    if (progressKey) api<CandidateBrief[]>(`/jobs/${id}/candidates`).then(c => { if (live) setCandidates(c) }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [id, progressKey])

  const visible = useMemo(() => candidates.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'scored' ? c.matchScore !== null : c.matchScore === null)))
    .sort((a, b) => sort === 'score' ? (b.matchScore ?? -1) - (a.matchScore ?? -1) : b.createdAt.localeCompare(a.createdAt)), [candidates, query, filter, sort])
  const addFiles = (files: FileList | File[]) => add(id, Array.from(files).map(file => ({ file, label: file.name })))
  const score = (c: CandidateBrief) => {
    useUploads.setState(s => ({ tasks: [...s.tasks, { key: crypto.randomUUID(), jobId: id, candidateId: c.id, label: c.name, status: 'error' }] }))
    const task = useUploads.getState().tasks.at(-1)!
    retry(task.key)
  }
  async function deleteCandidate(c: CandidateBrief) {
    if (!confirm(`删除「${c.name}」及其报告？`)) return
    setBusy(b => [...b, c.id]); setError('')
    try {
      await api(`/jobs/${id}/candidates/${c.id}`, { method: 'DELETE' })
      setCandidates(prev => prev.filter(p => p.id !== c.id)); setSelected(prev => prev.filter(p => p !== c.id))
      queue.filter(t => t.candidateId === c.id).forEach(t => remove(t.key))
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败') }
    finally { setBusy(b => b.filter(x => x !== c.id)) }
  }
  if (loading) return <div className="loading-state"><Loader2 className="animate-spin" />正在加载岗位…</div>
  if (!job) return <div className="card p-8"><p role="alert">{error || '岗位不存在'}</p><Link className="btn-primary inline-block mt-4" to="/">返回工作台</Link></div>

  return <div className="workspace-page">
    <Link to="/" className="back-link"><ArrowLeft size={15} />所有岗位</Link>
    <div className="page-heading"><div><span className="eyebrow">CANDIDATE WORKSPACE</span><h1>{job.title}</h1><p>批量导入简历，让每一次比较都有据可查。</p></div><div className="mini-stats"><b>{candidates.length}<small>候选人</small></b><b>{candidates.filter(c => c.matchScore !== null).length}<small>已完成匹配</small></b></div></div>
    {error && <div className="notice error" role="alert"><AlertCircle size={16} />{error}<button onClick={() => setError('')} aria-label="关闭错误"><X size={16} /></button></div>}
    <div className="candidate-layout">
      <section className="space-y-5 min-w-0">
        <div className={`upload-zone ${candidates.length ? 'compact' : ''} ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
          <div className="upload-symbol"><Upload size={24} /></div><h2>一次放入多份简历</h2><p>自动解析、逐份匹配。失败后可以单独重试。</p>
          <div className="flex gap-3 justify-center mt-5 flex-wrap"><label className="btn-primary cursor-pointer inline-flex gap-2 items-center"><Upload size={16} />选择简历<input aria-label="选择简历文件" className="sr-only" type="file" accept=".pdf,.docx,.txt" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} /></label><button className="btn-ghost inline-flex gap-2 items-center" onClick={() => setShowText(!showText)}><Clipboard size={16} />粘贴文本</button></div>
          <small>PDF / DOCX / TXT · 每份不超过 10 MB · 扫描件请先转文字</small>
        </div>
        {showText && <div className="card p-5"><label htmlFor="resume-text" className="block mb-3">粘贴一位候选人的完整简历</label><textarea id="resume-text" className="input-field h-40" value={text} onChange={e => setText(e.target.value)} placeholder="姓名、工作经历、项目成果、技能…" /><div className="flex justify-end mt-3"><button className="btn-primary" disabled={text.trim().length < 10} onClick={() => { add(id, [{ rawText: text.trim(), label: text.trim().split('\n')[0].slice(0, 30) || '文本简历' }]); setText(''); setShowText(false) }}>加入并自动匹配</button></div></div>}
        {queue.length > 0 && <details className="card p-5" open={active > 0 || queue.some(t => t.status === 'error')}><summary className="queue-toggle"><strong>处理队列</strong><span>{completed} / {queue.length}</span><span>展开 / 收起</span></summary><div aria-live="polite" className="pt-3"><div className="flex justify-end"><button className="btn-ghost" onClick={() => queue.filter(t => t.status === 'done').forEach(t => remove(t.key))}>清理已完成</button></div>{active > 0 && <p className="muted text-xs mb-3">同时处理 2 份，请保持窗口打开。可以在应用内切换页面。</p>}<div className="queue-list">{queue.map(t => <div className="queue-item" key={t.key}><div>{t.status === 'done' ? <CheckCircle2 size={17} className="text-success" /> : t.status === 'error' ? <AlertCircle size={17} className="text-danger" /> : <Loader2 size={17} className={t.status === 'queued' ? 'muted' : 'animate-spin text-primary'} />}</div><div className="min-w-0 flex-1"><p className="truncate">{t.label}</p><small className={t.error ? 'text-danger' : 'muted'}>{t.error || labels[t.status]}</small></div>{t.status === 'error' && <button className="btn-ghost shrink-0" onClick={() => retry(t.key)}>{t.candidateId ? '重试评分' : '重新解析'}</button>}{!['uploading', 'scoring'].includes(t.status) && <button aria-label={`移除任务 ${t.label}`} className="icon-button" onClick={() => remove(t.key)}><X size={15} /></button>}</div>)}</div></div></details>}
        <div className="card candidate-card"><div className="section-heading p-5 pb-3"><h2>候选人 <span>{candidates.length}</span></h2><span className="muted text-xs">选择 2–4 人进行比较</span></div>
          <div className="candidate-toolbar"><div className="search-field"><Search size={16} /><input aria-label="搜索候选人" placeholder="搜索姓名" value={query} onChange={e => setQuery(e.target.value)} /></div><select aria-label="筛选状态" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部状态</option><option value="scored">已匹配</option><option value="pending">待匹配</option></select><select aria-label="排序" value={sort} onChange={e => setSort(e.target.value)}><option value="score">达标率优先</option><option value="newest">最近添加</option></select></div>
          {visible.length === 0 ? <div className="empty-state"><FileText size={30} /><h3>{candidates.length ? '没有符合条件的候选人' : '等待第一份简历'}</h3><p>{candidates.length ? '试试调整搜索或筛选条件。' : '上传后，候选人和匹配进度会显示在这里。'}</p></div> : <div>{visible.map(c => {
            const processing = queue.some(t => t.candidateId === c.id && ['queued', 'uploading', 'scoring'].includes(t.status))
            return <div className="candidate-row" key={c.id}><input type="checkbox" aria-label={`选择 ${c.name} 进行比较`} checked={selected.includes(c.id)} disabled={c.matchScore === null || (!selected.includes(c.id) && selected.length >= 4)} onChange={e => setSelected(s => e.target.checked ? [...s, c.id] : s.filter(x => x !== c.id))} /><div className="avatar">{c.name.slice(0, 1)}</div><div className="candidate-name"><strong>{c.name}</strong><small>{new Date(c.createdAt).toLocaleDateString('zh-CN')}</small></div><div className="score-value">{c.matchScore !== null ? <><b>{c.matchScore}<em>%</em></b><small>岗位达标率</small></> : <span className="badge-warning">待匹配</span>}</div><div className="flex items-center gap-2">{processing ? <span className="muted text-xs inline-flex gap-1"><Loader2 className="animate-spin" size={14} />评分中</span> : c.matchScore !== null ? <Link className="btn-ghost inline-flex items-center gap-1" to={`/jobs/${id}/candidates/${c.id}/report`}>报告<ArrowUpRight size={15} /></Link> : <button className="btn-primary" onClick={() => score(c)}>开始匹配</button>}<button title="删除候选人" aria-label={`删除 ${c.name}`} className="icon-button" disabled={processing || busy.includes(c.id)} onClick={() => deleteCandidate(c)}><Trash2 size={15} /></button></div></div>
          })}</div>}
          {selected.length > 0 && <div className="comparison-bar"><span>已选择 <b>{selected.length}</b> 人</span><button className="btn-ghost" onClick={() => setSelected([])}>清空</button>{selected.length >= 2 ? <Link className="btn-primary inline-flex gap-2 items-center" to={`/jobs/${id}/compare?ids=${selected.join(',')}`}><GitCompareArrows size={16} />横向比较</Link> : <span className="muted text-xs">再选择 1 人即可比较</span>}</div>}
        </div>
      </section>
      <aside className="job-context"><div className="card p-5"><span className="eyebrow">THE SAME STANDARD</span><h2 className="mt-2 mb-2 text-lg font-semibold">岗位要求</h2><p className="muted text-xs leading-6 mb-5">所有候选人使用同一组目标和权重。达标率按各维度达标程度加权计算；超出要求的能力在比较中单独展示。</p>{job.requirements.map((r, i) => <div className="requirement" key={i}><div className="flex gap-2 justify-between mb-2"><span className={r.priority === 'must_have' ? 'badge-primary' : 'badge'}>{r.priority === 'must_have' ? '必需' : '加分'}</span><span className="muted text-xs">目标 L{r.targetLevel}</span></div><p>{r.description}</p></div>)}<details className="mt-4"><summary>查看岗位原文</summary><p className="whitespace-pre-wrap text-sm muted mt-3">{job.rawText}</p></details></div><div className="context-note"><CheckCircle2 size={16} /><p>分数用于辅助比较。打开报告可查看原文证据和待核实项。</p></div></aside>
    </div>
  </div>
}
