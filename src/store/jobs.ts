import { create } from 'zustand'
import { api } from '../lib/api'
import type { JobBrief, MatchReport, DimensionTemplateDTO } from '../../shared/types'

interface AppStore {
  jobs: JobBrief[]; loading: boolean; error: string | null
  fetchJobs: () => Promise<void>
  createJob: (rawText: string, title?: string) => Promise<JobBrief>
  fetchReport: (jobId: string, candidateId: string) => Promise<MatchReport>
  deleteJob: (jobId: string) => Promise<void>
  fetchTemplates: () => Promise<DimensionTemplateDTO[]>
}
export const useAppStore = create<AppStore>(set => ({
  jobs: [], loading: false, error: null,
  fetchJobs: async () => {
    set({ loading: true, error: null })
    try { set({ jobs: await api<JobBrief[]>('/jobs') }) }
    catch (e) { set({ error: e instanceof Error ? e.message : '岗位读取失败' }) }
    finally { set({ loading: false }) }
  },
  createJob: async (rawText, title) => {
    set({ loading: true, error: null })
    try {
      const job = await api<JobBrief>('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText, title }) })
      set(s => ({ jobs: [{ ...job, candidateCount: 0 }, ...s.jobs] }))
      return job
    } catch (e) { set({ error: e instanceof Error ? e.message : '岗位创建失败' }); throw e }
    finally { set({ loading: false }) }
  },
  // Viewing a report must never start another billable AI request.
  fetchReport: (jobId, candidateId) => api<MatchReport>(`/jobs/${jobId}/candidates/${candidateId}/report`),
  deleteJob: async jobId => {
    try {
      await api(`/jobs/${jobId}`, { method: 'DELETE' })
      set(s => ({ jobs: s.jobs.filter(j => j.id !== jobId) }))
    } catch (e) { set({ error: e instanceof Error ? e.message : '删除失败' }); throw e }
  },
  fetchTemplates: () => api<DimensionTemplateDTO[]>('/templates'),
}))

type Uploaded = { id: string; name: string; scored?: boolean }
export const uploadResumeText = (jobId: string, rawText: string) => api<Uploaded>(`/jobs/${jobId}/candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText }) })
export function uploadResumeFile(jobId: string, file: File): Promise<Uploaded> {
  const body = new FormData(); body.append('file', file)
  return api<Uploaded>(`/jobs/${jobId}/candidates`, { method: 'POST', body })
}
export const scoreCandidateAndGet = (jobId: string, candidateId: string) => api<MatchReport>(`/jobs/${jobId}/candidates/${candidateId}/score`, { method: 'POST' })
