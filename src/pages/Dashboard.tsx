import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, Users, Clock, FileText, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/jobs'

const jobFamilyLabels: Record<string, string> = {
  technical: '技术族',
  managerial: '管理族',
  functional: '职能族',
}

const jobFamilyColors: Record<string, string> = {
  technical: 'badge-primary',
  managerial: 'badge-accent',
  functional: 'badge-success',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { jobs, loading, error, fetchJobs, createJob, deleteJob } = useAppStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [jdText, setJdText] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleCreate = async () => {
    if (!jdText.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const job = await createJob(jdText, jobTitle || undefined)
      setShowCreateModal(false)
      setJdText('')
      setJobTitle('')
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败，请检查API配置或JD文本后重试')
    }
    setCreating(false)
  }

  const handleDelete = async (jobId: string, jobTitle: string) => {
    if (!window.confirm(`确定要删除岗位「${jobTitle}」吗？此操作不可撤销。`)) return
    setDeleting(jobId)
    try { await deleteJob(jobId) } catch { /* Store exposes the error inline. */ }
    finally { setDeleting(null) }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch {
      return dateStr
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR HIRING DESK</span>
          <h1>把合适的人，看得更清楚。</h1>
          <p>选择一个岗位，批量导入简历，从证据出发比较候选人。共 {jobs.length} 个岗位。</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建岗位
        </button>
      </div>

      {error && <div role="alert" className="notice error">{error}<button onClick={() => fetchJobs()}>重试</button></div>}
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无岗位</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            创建第一个岗位，粘贴职位描述。系统建立统一评估标准后，即可批量导入简历并比较候选人。
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            新建岗位
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="card p-5 text-left hover:shadow-md transition-shadow duration-200 group relative"
            >
              <button
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full text-left cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3 pr-8">
                  <h4 className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                    {job.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={jobFamilyColors[job.jobFamily] || 'badge-primary'}>
                    {jobFamilyLabels[job.jobFamily] || job.jobFamily}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {job.candidateCount} 位候选人
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(job.createdAt)}
                  </span>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(job.id, job.title)
                }}
                disabled={deleting === job.id}
                className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50"
                title="删除岗位"
              >
                {deleting === job.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-card shadow-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">新建岗位</h3>
                <p className="text-sm text-gray-500">输入岗位名称并粘贴职位描述（JD）文本</p>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                岗位名称 <span className="text-gray-400 font-normal">(可选，留空则由AI自动生成)</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="例：高级前端开发工程师"
                className="input-field"
                maxLength={100}
              />
            </div>

            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="请粘贴职位描述文本，系统将自动解析结构化信息..."
              className="input-field h-48 resize-none mb-4"
            />

            {createError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{createError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setJdText(''); setJobTitle(''); setCreateError(null) }}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !jdText.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                创建并解析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
