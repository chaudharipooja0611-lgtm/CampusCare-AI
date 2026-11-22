import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FilePlus2, ListChecks, Search, Building2, Users, BarChart3, Bell, LogOut, Menu, X, ArrowRight } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { NotificationProvider, useNotifications } from '../context/NotificationContext'
import api from '../api'
import { timeAgo } from '../constants'
import { NOTIF_META, SEVERITY_STYLE } from './notifMeta'

const NAV = {
  student: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/new', label: 'New Complaint', icon: FilePlus2 },
    { to: '/app/complaints', label: 'My Complaints', icon: ListChecks },
    { to: '/app/track', label: 'Track Ticket', icon: Search },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: true },
  ],
  department: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/complaints', label: 'Assigned Complaints', icon: ListChecks },
    { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/app/new', label: 'New Complaint', icon: FilePlus2 },
  ],
  admin: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/complaints', label: 'All Complaints', icon: ListChecks },
    { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/app/departments', label: 'Departments', icon: Building2 },
    { to: '/app/users', label: 'Users', icon: Users },
    { to: '/app/new', label: 'New Complaint', icon: FilePlus2 },
  ],
}

function Bell_() {
  const [open, setOpen] = useState(false)
  const { unread, criticalUnread, latest, refresh } = useNotifications()
  const nav = useNavigate()
  const ref = useRef()

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const openNotif = async (n) => {
    setOpen(false)
    if (!n.is_read) { await api.post(`/notifications/${n.id}/read`).catch(() => {}); refresh() }
    if (n.complaint_id) nav(`/app/complaints/${n.complaint_id}`)
  }
  const markAll = async () => { await api.post('/notifications/read').catch(() => {}); refresh() }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-ink-700 transition hover:border-violet-300 hover:text-violet-700">
        <Bell size={18} />
        {unread > 0 && (
          <span className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${criticalUnread ? 'animate-pulse2 bg-rose-600' : 'bg-violet-600'}`}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-96 max-w-[88vw] animate-fade-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-violet-700 hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {latest.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-500">You're all caught up 🎉</p>}
            {latest.map((n) => {
              const M = NOTIF_META[n.type] || NOTIF_META.info, S = SEVERITY_STYLE[n.severity] || SEVERITY_STYLE.info, I = M.icon
              return (
                <button key={n.id} onClick={() => openNotif(n)} className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-brand-50/60 ${!n.is_read ? 'bg-violet-50/40' : ''}`}>
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${S.ring}`}><I size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${!n.is_read ? 'font-semibold' : 'text-ink-700'}`}>{n.message}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{M.label} · {timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
                </button>
              )
            })}
          </div>
          <button onClick={() => { setOpen(false); nav('/app/notifications') }} className="flex w-full items-center justify-center gap-1.5 bg-slate-50 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
            Open notification center <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function Shell() {
  const { user, logout } = useAuth()
  const { unread } = useNotifications()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const items = NAV[user.role]

  const search = (e) => {
    e.preventDefault()
    if (q.trim()) { nav(`/app/complaints?q=${encodeURIComponent(q.trim())}`); setQ('') }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/40">
      {open && <div className="fixed inset-0 z-30 bg-brand-950/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 p-5 shadow-navy transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between">
          <Logo to="/app" light />
          <button className="text-white/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">Menu</p>
        <nav className="flex-1 space-y-1">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-violet-400" />}
                  <Icon size={18} className={`transition group-hover:scale-110 ${isActive ? 'text-violet-300' : ''}`} />
                  <span className="flex-1">{label}</span>
                  {badge && unread > 0 && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 font-bold text-white">{user.name[0]}</span>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user.name}</p><p className="truncate text-xs text-white/50">{user.email}</p></div>
          </div>
          <span className="badge mt-3 bg-white/10 capitalize text-violet-200 ring-white/10">{user.role}{user.department_name ? ` · ${user.department_name}` : ''}</span>
          <button onClick={() => { logout(); nav('/') }} className="btn mt-3 w-full border border-white/15 bg-white/5 !py-2 text-white hover:bg-white/10"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-8">
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <form onSubmit={search} className="relative hidden max-w-md flex-1 sm:block">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !rounded-full !bg-slate-50 !pl-10" placeholder="Search tickets, titles, locations…  ⏎" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
          </form>
          <div className="ml-auto flex items-center gap-3"><Bell_ /></div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

export default function Layout() {
  return <NotificationProvider><Shell /></NotificationProvider>
}
