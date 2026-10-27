import { NavLink, Link } from 'react-router-dom'
import { Layers3, Settings2, Activity, BriefcaseBusiness } from 'lucide-react'
import { useUploads } from '@/store/uploads'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pending = useUploads(s => s.tasks.filter(t => ['queued', 'uploading', 'scoring'].includes(t.status)).length)
  return <div className="app-shell">
    <header className="app-header"><Link to="/" className="brand"><div className="brand-mark"><Layers3 size={23} /></div><div>Talent<span>Fit</span><small>让人才与岗位清晰相遇</small></div></Link>
      <nav aria-label="主导航"><NavLink to="/" end><BriefcaseBusiness size={16} />招聘工作台</NavLink><NavLink to="/templates"><Layers3 size={16} />评估标准</NavLink><NavLink to="/settings"><Settings2 size={16} />模型设置</NavLink><NavLink to="/audit"><Activity size={16} />运行记录</NavLink></nav>
      <div className="local-status"><i />{pending ? `${pending} 份处理中` : '本机运行'}</div>
    </header>
    <main className="app-main">{children}</main>
    <footer className="app-footer"><span>TALENTFIT · 人岗匹配工作台</span><span>本地保存 · AI 辅助分析 · 人工复核</span></footer>
  </div>
}
