import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import Logo from '../components/Logo'
import { CategoryBadge, PageHeader, PriorityBadge, StatusBadge } from '../components/ui'
import { fmtDateTime, STATUS_COLORS } from '../constants'

export function Timeline({ updates = [] }) {
  return (
    <ol className="relative ml-3 space-y-6 border-l-2 border-slate-100">
      {updates.map((u, i) => (
        <li key={i} className="relative pl-6">
          <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full ring-4 ring-white" style={{ background: STATUS_COLORS[u.status] }} />
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={u.status} /><span className="text-xs text-ink-500">{fmtDateTime(u.created_at)}</span>{u.user_name && <span className="text-xs text-ink-500">· {u.user_name}</span>}</div>
          {u.note && <p className="mt-1.5 text-sm text-ink-700">{u.note}</p>}
        </li>
      ))}
    </ol>
  )
}

export default function Track({ standalone }) {
  const params = useParams()
  const nav = useNavigate()
  const [ticket, setTicket] = useState(params.ticket || '')
  const [c, setC] = useState(null)
  const [busy, setBusy] = useState(false)

  const lookup = async (t) => {
    if (!t.trim()) return toast.error('Enter a ticket ID')
    setBusy(true)
    try { setC((await api.get(`/track/${encodeURIComponent(t.trim())}`)).data.complaint) }
    catch (e) { setC(null); toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  useEffect(() => { if (params.ticket) lookup(params.ticket) }, [params.ticket])

  const body = (
    <>
      <PageHeader title="Track a complaint" subtitle="Enter your ticket ID (e.g. CC-7K2M9QXA) to see live progress." />
      <form onSubmit={(e) => { e.preventDefault(); nav(`${standalone ? '/track' : '/app/track'}/${ticket.trim().toUpperCase()}`) }} className="card flex gap-3 p-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-10 font-mono uppercase" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="CC-XXXXXXXX" /></div>
        <button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Track'}</button>
      </form>
      {c && (
        <div className="card mt-6 animate-fade-up p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-lg font-bold text-brand-700">{c.ticket_id}</span><StatusBadge status={c.status} /></div>
          <h2 className="mt-3 text-xl font-bold">{c.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2"><CategoryBadge category={c.category} /><PriorityBadge priority={c.priority} />{c.department_name && <span className="badge bg-slate-50 text-ink-700 ring-slate-200">{c.department_name}</span>}</div>
          <h3 className="mb-4 mt-8 font-bold">Progress</h3>
          <Timeline updates={c.updates} />
        </div>
      )}
    </>
  )
  if (!standalone) return body
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-100/60 via-white to-violet-50">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5"><Logo /><Link to="/login" className="btn-ghost">Sign in</Link></div>
      <div className="mx-auto max-w-3xl px-5 pb-16">{body}</div>
    </div>
  )
}
