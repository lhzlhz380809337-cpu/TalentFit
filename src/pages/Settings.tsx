import { useEffect, useState } from 'react'
import {
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Save,
  Play,
  Database,
  Brain,
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const providerOptions = [
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Claude', label: 'Claude' },
  { value: 'Azure OpenAI', label: 'Azure OpenAI' },
  { value: '自定义', label: '自定义' },
]

const settingKeys = ['api_provider', 'api_endpoint', 'api_key', 'model_name', 'temperature', 'max_tokens'] as const

type SettingKey = typeof settingKeys[number]

interface SettingsMap {
  api_provider: string
  api_endpoint: string
  api_key: string
  model_name: string
  temperature: string
  max_tokens: string
}

const defaultSettings: SettingsMap = {
  api_provider: 'OpenAI',
  api_endpoint: '',
  api_key: '',
  model_name: '',
  temperature: '0.7',
  max_tokens: '32768',
}

export default function Settings() {
  const [form, setForm] = useState<SettingsMap>(defaultSettings)
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/settings`)
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error || '设置读取失败，请刷新页面重试。')
          const items: { key: string; value: string }[] = json.data || []
          const map: Record<string, string> = {}
          for (const item of items) {
            map[item.key] = item.value
          }
          setForm({ ...defaultSettings, ...map })
      } catch (error) {
        setLoadFailed(true)
        setMessage({ type: 'error', text: error instanceof Error ? error.message : '设置读取失败，请刷新页面重试。' })
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const updateField = (key: SettingKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const settings = settingKeys.map((key) => ({ key, value: form[key] }))
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || json.message || '保存失败')
      setMessage({ type: 'success', text: '设置已保存成功' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败，请检查网络连接' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE}/settings/test-connection`, {
        method: 'POST',
      })
      const json = await res.json()
      const result = json.data || json
      if (result.success) {
        const preview = result.responsePreview ? ` 模型返回: "${result.responsePreview}"` : ''
        setMessage({ type: 'success', text: `连接成功！${preview}` })
      } else {
        setMessage({ type: 'error', text: result.message || '连接失败' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `连接测试失败: ${err instanceof Error ? err.message : '网络错误'}` })
    } finally {
      setTesting(false)
    }
  }

  const isAiConfigured = form.api_key.trim().length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">系统设置</h3>
            <p className="text-sm text-gray-500 mt-1">配置AI模型接入参数</p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'mb-6 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium',
            message.type === 'success'
              ? 'bg-green-50 text-success border border-green-200'
              : 'bg-red-50 text-danger border border-red-200'
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="break-all">{message.text}</span>
        </div>
      )}

      <div className="card p-6 mb-6">
        <h4 className="text-base font-semibold text-gray-900 mb-1">AI模型配置</h4>
        <p className="text-sm text-gray-500 mb-6">配置AI服务商连接参数以启用智能匹配功能</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AI服务商</label>
            <select
              value={form.api_provider}
              onChange={(e) => updateField('api_provider', e.target.value)}
              className="input-field"
            >
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型名称</label>
            <input
              type="text"
              value={form.model_name}
              onChange={(e) => updateField('model_name', e.target.value)}
              placeholder="gpt-4 / claude-3-opus-20240229"
              className="input-field"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API地址</label>
            <input
              type="text"
              value={form.api_endpoint}
              onChange={(e) => updateField('api_endpoint', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="input-field"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => updateField('api_key', e.target.value)}
                placeholder="sk-..."
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Temperature：{parseFloat(form.temperature).toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => updateField('temperature', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">最大Token数（输出长度）</label>
            <input
              type="number"
              value={form.max_tokens}
              onChange={(e) => updateField('max_tokens', e.target.value)}
              placeholder="32768"
              min={1024}
              max={131072}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">建议值 32768，JD解析/评分等长文本输出建议不低于 16384</p>
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h4 className="text-base font-semibold text-gray-900 mb-1">操作</h4>
        <p className="text-sm text-gray-500 mb-6">测试连接或保存当前配置</p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-accent flex items-center gap-2 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            测试连接
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadFailed}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存设置
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h4 className="text-base font-semibold text-gray-900 mb-1">系统状态</h4>
        <p className="text-sm text-gray-500 mb-6">当前系统运行状态概览</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-gray-500">数据库状态</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn('w-2 h-2 rounded-full', loadFailed ? 'bg-danger' : 'bg-success')} />
                <span className="text-sm font-medium text-gray-900">{loadFailed ? '连接失败' : '已连接'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">AI 模型状态</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isAiConfigured ? 'bg-success' : 'bg-warning'
                  )}
                />
                <span className="text-sm font-medium text-gray-900">
                  {isAiConfigured ? '已配置' : '未配置'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-gray-500">匹配引擎版本</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">v2.0 · 岗位达标率</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
