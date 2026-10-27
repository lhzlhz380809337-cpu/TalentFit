import { create } from 'zustand'
import { uploadResumeFile, uploadResumeText, scoreCandidateAndGet } from './jobs'

export type UploadTask = {
  key: string; jobId: string; label: string; file?: File; rawText?: string; candidateId?: string
  status: 'queued' | 'uploading' | 'scoring' | 'done' | 'error'; error?: string
}
interface UploadState {
  tasks: UploadTask[]
  add: (jobId: string, items: { file?: File; rawText?: string; label: string }[]) => void
  retry: (key: string) => void
  remove: (key: string) => void
}
export const useUploads = create<UploadState>((set, get) => ({
  tasks: [],
  add: (jobId, items) => {
    const tasks = [...get().tasks]
    for (const item of items) {
      const duplicate = tasks.some(t => t.jobId === jobId && t.status !== 'error' && (item.file
        ? t.file?.name === item.file.name && t.file?.size === item.file.size && t.file?.lastModified === item.file.lastModified
        : t.rawText === item.rawText))
      if (duplicate) continue
      const error = item.file && (!/\.(pdf|docx|txt)$/i.test(item.file.name) ? '支持 PDF、DOCX、TXT；旧版 DOC 请先另存为 DOCX。' : item.file.size > 10 * 1024 * 1024 ? '文件超过 10 MB，请压缩后重试。' : item.file.size === 0 ? '文件为空。' : undefined)
      tasks.push({ ...item, jobId, key: crypto.randomUUID(), status: error ? 'error' : 'queued', error: error || undefined })
    }
    set({ tasks }); void pump()
  },
  retry: key => { set({ tasks: get().tasks.map(t => t.key === key ? { ...t, status: 'queued', error: undefined } : t) }); void pump() },
  remove: key => set({ tasks: get().tasks.filter(t => t.key !== key || t.status === 'uploading' || t.status === 'scoring') }),
}))

let workers = 0
const update = (key: string, patch: Partial<UploadTask>) => useUploads.setState(s => ({ tasks: s.tasks.map(t => t.key === key ? { ...t, ...patch } : t) }))

async function pump() {
  while (workers < 2) {
    const task = useUploads.getState().tasks.find(t => t.status === 'queued')
    if (!task) return
    workers++
    update(task.key, { status: task.candidateId ? 'scoring' : 'uploading' })
    void run(task).finally(() => { workers--; void pump() })
  }
}

async function run(task: UploadTask) {
  try {
    let candidateId = task.candidateId
    if (!candidateId) {
      const result = task.file ? await uploadResumeFile(task.jobId, task.file) : await uploadResumeText(task.jobId, task.rawText || '')
      candidateId = result.id
      if (result.scored) { update(task.key, { candidateId, status: 'done' }); return }
      update(task.key, { candidateId, status: 'scoring' })
    }
    await scoreCandidateAndGet(task.jobId, candidateId)
    update(task.key, { status: 'done' })
  } catch (error) {
    update(task.key, { status: 'error', error: error instanceof Error ? error.message : '处理失败，请重试。' })
  }
}

window.addEventListener('beforeunload', event => {
  if (useUploads.getState().tasks.some(t => ['queued', 'uploading', 'scoring'].includes(t.status))) {
    event.preventDefault(); event.returnValue = ''
  }
})
