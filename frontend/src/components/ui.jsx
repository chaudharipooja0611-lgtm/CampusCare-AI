import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, Star, Timer, X } from 'lucide-react'
import { CATEGORY_META, fmtDuration, isOpen } from '../constants'

const STATUS_CLS = {
  Assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  'In Progress': 'bg-violet-50 text-violet-700 ring-violet-200',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
}
const PRIORITY_CLS = { High: 'bg-rose-50 text-rose-700 ring-rose-200', Medium: 'bg-amber-50 text-amber-700 ring-amber-200', Low: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
const SENT_CLS = { Positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Neutral: 'bg-slate-100 text-slate-600 ring-slate-200', Negative: 'bg-rose-50 text-rose-700 ring-rose-200' }

export const StatusBadge = ({ status }) => (
  <span className={`badge ${STATUS_CLS[status] || STATUS_CLS.Assigned}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
)
export const PriorityBadge = ({ priority }) => <span className={`badge ${PRIORITY_CLS[priority]}`}>{priority}</span>
export const SentimentBadge = ({ sentiment }) => <span className={`badge ${SENT_CLS[sentiment]}`}>{sentiment}</span>
export const CategoryBadge = ({ category }) => {
  const m = CATEGORY_META[category]
  const Icon = m?.icon
  return <span className={`badge ${m?.cls}`}>{Icon && <Icon size={12} />}{category}</span>
}
export const EscalationBadge = ({ level }) =>
  level > 0 ? (
    <span className={`badge ${level > 1 ? 'bg-rose-600 text-white ring-rose-600' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
      <AlertOctagon size={12} />{level > 1 ? 'Critical' : 'Escalated'}
    </span>
  ) : null

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-500"><Loader2 className="animate-spin text-violet-600" size={20} /> {label}</div>
)
export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={`skeleton ${className}`} />
export const TableSkeleton = ({ rows = 6 }) => (
  <div className="space-y-3 p-5">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
)
export const PageSkeleton = () => (
  <div className="space-y-5">
    <Skeleton className="h-9 w-64" />
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 !rounded-2xl" />)}</div>
    <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-72 !rounded-2xl lg:col-span-2" /><Skeleton className="h-72 !rounded-2xl" /></div>
  </div>
)

export const Empty = ({ title = 'Nothing here yet', hint, children }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 text-violet-600"><Inbox /></div>
    <p className="font-display font-bold">{title}</p>
    {hint && <p className="mt-1 max-w-xs text-sm text-ink-500">{hint}</p>}
    <div className="mt-4">{children}</div>
  </div>
)

export const ConfidenceBar = ({ value, className = '' }) => {
  const color = value >= 85 ? 'from-emerald-400 to-emerald-500' : value >= 60 ? 'from-brand-600 to-violet-500' : 'from-amber-400 to-orange-500'
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full animate-grow rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-bold tabular-nums">{Number(value).toFixed(1)}%</span>
    </div>
  )
}

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
    </div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
)

export const StatCard = ({ icon: Icon, label, value, hint, tone = 'blue', to, pulse }) => {
  const tones = {
    blue: 'from-brand-600 to-brand-800', violet: 'from-violet-500 to-indigo-600', emerald: 'from-emerald-400 to-emerald-600',
    rose: 'from-rose-400 to-rose-600', amber: 'from-amber-400 to-orange-500', slate: 'from-slate-500 to-slate-700',
  }
  return (
    <div className={`card card-hover animate-fade-up p-5 ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tones[tone]} ${pulse ? 'animate-pulse2' : ''}`}><Icon size={20} /></span>
      </div>
    </div>
  )
}

export const Modal = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="card w-full max-w-lg animate-fade-up p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Pagination = ({ page, pages, total, perPage, onChange }) => {
  if (total === 0) return null
  const from = (page - 1) * perPage + 1, to = Math.min(total, page * perPage)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-ink-500">
      <span>Showing <b className="text-ink-900">{from}–{to}</b> of <b className="text-ink-900">{total}</b></span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={14} /> Prev</button>
        <span className="px-2 text-xs font-semibold">Page {page} / {pages}</span>
        <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ratings
export const Stars = ({ value = 0, size = 16 }) => (
  <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />)}
  </span>
)
export const StarInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(0)
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="rounded-md p-0.5 transition hover:scale-125">
            <Star size={28} className={n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-ink-500">{labels[hover || value]}</span>
    </div>
  )
}

// ---------------------------------------------------------------- SLA
/** Live countdown derived from the server-reported seconds remaining (immune to clock/timezone differences). */
export function useCountdown(c, tickMs = 1000) {
  const base = useMemo(() => Date.now(), [c.id, c.sla_seconds_left])
  const [now, setNow] = useState(Date.now())
  const active = isOpen(c.status) && c.sla_seconds_left != null
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(t)
  }, [active, tickMs, c.id, c.sla_seconds_left])
  return active ? c.sla_seconds_left - Math.floor((now - base) / 1000) : null
}

const SLA_TONES = {
  on_track: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  at_risk: 'bg-amber-50 text-amber-700 ring-amber-200',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
  met: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  resolved_late: 'bg-amber-50 text-amber-700 ring-amber-200',
  closed: 'bg-slate-100 text-slate-500 ring-slate-200',
}
export function slaStateOf(c, left) {
  if (left == null) return c.sla_state
  if (left < 0) return 'overdue'
  return left < (c.sla_total_seconds || 1) * 0.2 ? 'at_risk' : 'on_track'
}

export function SlaPill({ c }) {
  const left = useCountdown(c, 30000)
  const state = slaStateOf(c, left)
  let text
  if (left != null) text = left < 0 ? `Overdue ${fmtDuration(left)}` : `${fmtDuration(left)} left`
  else text = { met: 'Within SLA', resolved_late: 'Resolved late', closed: 'Closed' }[state] || '—'
  const Icon = state === 'met' ? CheckCircle2 : state === 'overdue' ? AlertOctagon : Timer
  return <span className={`badge whitespace-nowrap ${SLA_TONES[state]} ${state === 'overdue' ? 'animate-pulse2' : ''}`}><Icon size={12} />{text}</span>
}
