import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOff, CheckCheck, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import { Empty, PageHeader, Skeleton } from '../components/ui'
import { NOTIF_META, SEVERITY_STYLE } from '../components/notifMeta'
import { useNotifications } from '../context/NotificationContext'
import { timeAgo } from '../constants'

const TABS = [['all', 'All'], ['unread', 'Unread'], ['alerts', 'Alerts']]
const dayLabel = (d) => {
  const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier'
}

export default function Notifications() {
  const nav = useNavigate()
  const ctx = useNotifications()
  const [tab, setTab] = useState('all')
  const [data, setData] = useState(null)
  const [limit, setLimit] = useState(30)

  const load = useCallback(() =>
    api.get('/notifications', { params: { filter: tab, limit } }).then((r) => setData(r.data)).catch((e) => { toast.error(errMsg(e)); setData({ notifications: [], total: 0, unread: 0, alerts_unread: 0, critical_unread: 0 }) }),
  [tab, limit])
  useEffect(() => { setData(null); load() }, [tab, limit])
  const sync = () => { load(); ctx.refresh() }

  const open = async (n) => {
    if (!n.is_read) await api.post(`/notifications/${n.id}/read`).catch(() => {})
    ctx.refresh()
    if (n.complaint_id) nav(`/app/complaints/${n.complaint_id}`); else load()
  }
  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); sync() } catch (e) { toast.error(errMsg(e)) } }

  const groups = {}
  data?.notifications.forEach((n) => { (groups[dayLabel(n.created_at)] ||= []).push(n) })

  return (
    <>
      <PageHeader title="Notification center" subtitle="Alerts, SLA warnings, escalations and updates — critical items first.">
        <button className="btn-ghost" disabled={!data?.unread} onClick={() => act(() => api.post('/notifications/read'), 'All marked as read')}><CheckCheck size={16} /> Mark all read</button>
        <button className="btn-ghost" onClick={() => act(async () => { const r = await api.delete('/notifications'); toast.success(`${r.data.deleted} read notification(s) cleared`) })}><Trash2 size={16} /> Clear read</button>
      </PageHeader>

      {data && data.critical_unread > 0 && (
        <div className="mb-5 flex animate-fade-up items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 p-4 text-white shadow-lg shadow-rose-500/20">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">!</span>
          <div><p className="font-bold">{data.critical_unread} critical alert{data.critical_unread > 1 ? 's' : ''} need your attention</p><p className="text-sm text-rose-100">Escalations and overdue high-priority complaints are listed first.</p></div>
          <button onClick={() => setTab('alerts')} className="btn ml-auto bg-white !py-2 text-rose-600 hover:bg-rose-50">View alerts</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 p-2">
          {TABS.map(([k, l]) => {
            const n = k === 'unread' ? data?.unread : k === 'alerts' ? data?.alerts_unread : null
            return (
              <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-brand-900 text-white' : 'text-ink-500 hover:bg-slate-50'}`}>
                {l}{n > 0 && <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === k ? 'bg-white/20' : 'bg-violet-100 text-violet-700'}`}>{n}</span>}
              </button>
            )
          })}
        </div>
        {data === null ? <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          : data.notifications.length === 0 ? <Empty title={tab === 'all' ? 'No notifications yet' : 'Nothing to show'} hint={tab === 'all' ? 'New complaints, SLA alerts and updates will appear here.' : 'No notifications match this filter.'}><BellOff className="text-slate-300" /></Empty>
          : Object.entries(groups).map(([label, list]) => (
            <div key={label}>
              <p className="bg-slate-50/70 px-5 py-2 text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
              {list.map((n) => {
                const M = NOTIF_META[n.type] || NOTIF_META.info, S = SEVERITY_STYLE[n.severity] || SEVERITY_STYLE.info, I = M.icon
                return (
                  <div key={n.id} className={`group relative flex items-start gap-4 border-b border-slate-50 px-5 py-4 transition hover:bg-brand-50/50 ${!n.is_read ? 'bg-violet-50/40' : ''}`}>
                    <span className={`absolute inset-y-0 left-0 w-1 ${n.is_read ? 'bg-transparent' : S.bar}`} />
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${S.ring}`}><I size={18} /></span>
                    <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                      <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'text-ink-700'}`}>{n.message}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        <span className={`badge !py-0.5 ${S.ring}`}>{M.label}</span>
                        {n.ticket_id && <span className="font-mono font-semibold text-brand-700">{n.ticket_id}</span>}
                        <span>{timeAgo(n.created_at)}</span>
                      </p>
                    </button>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
                      {!n.is_read && <button title="Mark as read" onClick={() => act(() => api.post(`/notifications/${n.id}/read`))} className="rounded-lg p-2 text-ink-500 hover:bg-white hover:text-emerald-600"><CheckCheck size={16} /></button>}
                      <button title="Delete" onClick={() => act(() => api.delete(`/notifications/${n.id}`))} className="rounded-lg p-2 text-ink-500 hover:bg-white hover:text-rose-600"><X size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        {data && data.total > data.notifications.length && tab === 'all' && (
          <div className="p-4 text-center"><button className="btn-ghost" onClick={() => setLimit(limit + 30)}>Load more</button></div>
        )}
      </div>
    </>
  )
}
