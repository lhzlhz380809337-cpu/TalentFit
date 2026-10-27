export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(json.error || `请求失败 (${res.status})，请重试。`)
  return json.data
}
