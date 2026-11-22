import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, FilePlus2, PartyPopper, ShieldCheck, Star, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import { ChartCard, Donut, TrendChart } from '../components/Charts'
import { Empty, EscalationBadge, PageHeader, PageSkeleton, PriorityBadge, SlaPill, Stars, StatCard } from '../components/ui'
import { CATEGORY_COLORS } from '../constants'
import { useAuth } from '../context/AuthContext'
import { ComplaintTable } from './Complaints'

export default function Dashboard() {
  const { user } = useAuth()
  const [a, setA] = useState(null)
  const [recent, setRecent] = useState(null)
  const [attention, setAttention] = useState(null)

  useEffect(() => {
    api.get('/analytics').then((r) => setA(r.data)).catch((e) => toast.error(errMsg(e)))
    api.get('/complaints', { params: { per_page: 6 } }).then((r) => setRecent(r.data.complaints)).catch(() => setRecent([]))
    api.get('/complaints', { params: { attention: 1, sort: 'sla', order: 'asc', per_page: 5 } }).then((r) => setAttention(r.data)).catch(() => setAttention({ complaints: [], total: 0 }))
  }, [])

  if (!a || recent === null || attention === null) return <PageSkeleton />
  const s = a.stats
  const titles = { student: 'Your dashboard', department: `${user.department_name || 'Department'} dashboard`, admin: 'Admin dashboard' }
  const L = (to, node) => <Link to={to} className="block">{node}</Link>

  return (
    <>
      <PageHeader title={titles[user.role]} subtitle="A live overview of complaint activity, SLAs and service quality.">
        <Link to="/app/new" className="btn-primary"><FilePlus2 size={16} /> New complaint</Link>
      </PageHeader>

      {user.role === 'student' && s.awaiting_rating > 0 && (
        <Link to="/app/complaints?unrated=1" className="mb-5 flex animate-fade-up items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-violet-50 p-4 ring-1 ring-amber-200 transition hover:shadow-soft">
          <Star className="fill-amber-400 text-amber-400" /><p className="text-sm"><b>{s.awaiting_rating} resolved complaint{s.awaiting_rating > 1 ? 's' : ''}</b> waiting for your rating — it takes 10 seconds and helps improve service.</p><ArrowRight size={16} className="ml-auto shrink-0" />
        </Link>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {L('/app/complaints', <StatCard icon={FileText} label="Total complaints" value={s.total} hint={`${s.resolution_rate}% resolved`} tone="blue" />)}
        {L('/app/complaints?status=Assigned,In Progress', <StatCard icon={Clock} label="Active" value={s.active} hint="Assigned or in progress" tone="violet" />)}
        {L('/app/complaints?status=Resolved', <StatCard icon={CheckCircle2} label="Resolved" value={s.resolved} hint={s.avg_resolution_hours != null ? `Avg ${s.avg_resolution_hours}h to resolve` : 'No resolutions yet'} tone="emerald" />)}
        {L('/app/complaints?priority=High&status=Assigned,In Progress', <StatCard icon={AlertTriangle} label="High priority open" value={s.high_open} hint="Needs attention first" tone="rose" />)}
        {L('/app/complaints?overdue=1', <StatCard icon={AlertOctagon} label="Overdue (SLA)" value={s.overdue} hint={s.overdue ? 'Past their deadline' : 'Nothing overdue'} tone={s.overdue ? 'rose' : 'emerald'} pulse={s.overdue > 0} />)}
        {L('/app/complaints?escalated=1', <StatCard icon={ShieldCheck} label="Escalated open" value={s.escalated_open} hint={`${s.at_risk} close to deadline`} tone="amber" />)}
        <StatCard icon={Timer} label="SLA compliance" value={s.sla_compliance != null ? `${s.sla_compliance}%` : '—'} hint="Resolved within target" tone="blue" />
        <StatCard icon={Star} label="Average rating" value={s.avg_rating != null ? s.avg_rating.toFixed(1) : '—'} hint={s.rated_count ? `${s.rated_count} rating${s.rated_count > 1 ? 's' : ''}` : 'No ratings yet'} tone="violet" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card animate-fade-up overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3"><div><h3 className="font-bold">Needs attention</h3><p className="text-xs text-ink-500">Overdue or escalated complaints, most urgent first</p></div>
            {attention.total > 0 && <Link to="/app/complaints?attention=1&sort=sla&order=asc" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">All {attention.total} <ArrowRight size={14} /></Link>}</div>
          {attention.complaints.length === 0 ? <Empty title="All clear" hint="No overdue or escalated complaints right now."><PartyPopper className="text-violet-400" /></Empty> : (
            <ul>{attention.complaints.map((c) => (
              <li key={c.id}><Link to={`/app/complaints/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-3.5 transition hover:bg-brand-50/50">
                <span className="font-mono text-xs font-bold text-brand-700">{c.ticket_id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.title}</span>
                <PriorityBadge priority={c.priority} /><EscalationBadge level={c.escalation_level} /><SlaPill c={c} />
              </Link></li>))}</ul>
          )}
        </div>
        <ChartCard title="By category" subtitle="AI-assigned (after corrections)"><Donut data={a.by_category} colors={CATEGORY_COLORS} /></ChartCard>
      </div>
      <ChartCard title="Complaints – last 14 days" subtitle="Daily submissions" className="mt-6"><TrendChart data={a.trend} /></ChartCard>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5"><h3 className="font-bold">Recent complaints</h3><Link to="/app/complaints" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">View all <ArrowRight size={14} /></Link></div>
        {recent.length ? <ComplaintTable rows={recent} showUser={user.role !== 'student'} /> : <Empty title="No complaints yet" hint="Submit your first complaint and watch the AI route it." />}
      </div>
    </>
  )
}
