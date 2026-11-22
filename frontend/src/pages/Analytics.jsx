import { useEffect, useState } from 'react'
import { AlertOctagon, Brain, Copy, Download, Gauge, Loader2, RefreshCw, ShieldAlert, Star, Timer, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { download, errMsg } from '../api'
import { Bars, ChartCard, Donut, TrendChart } from '../components/Charts'
import { PageHeader, PageSkeleton, Stars, StatCard } from '../components/ui'
import { CATEGORY_COLORS, PRIORITY_COLORS, SENTIMENT_COLORS, STATUS_COLORS, fmtDateTime } from '../constants'
import { useAuth } from '../context/AuthContext'

const RATING_COLORS = { '1★': '#e11d48', '2★': '#f97316', '3★': '#f59e0b', '4★': '#84cc16', '5★': '#10b981' }

export default function Analytics() {
  const { user } = useAuth()
  const [a, setA] = useState(null)
  const [busy, setBusy] = useState('')
  const load = () => api.get('/analytics').then((r) => setA(r.data)).catch((e) => toast.error(errMsg(e)))
  useEffect(() => { load() }, [])

  const run = (key, fn) => async () => { setBusy(key); try { await fn() } catch (e) { toast.error(errMsg(e)) } finally { setBusy('') } }
  const retrain = run('retrain', async () => { await api.post('/admin/retrain'); toast.success('Model retrained with latest data and admin feedback'); await load() })
  const slaCheck = run('sla', async () => { const r = (await api.post('/admin/sla-check')).data.result; toast.success(`SLA check done: ${r.warned} warned, ${r.breached} breached, ${r.escalated} escalated`); await load() })
  const report = run('report', async () => { await download('/reports/summary'); toast.success('Summary report downloaded') })

  if (!a) return <PageSkeleton />
  const { stats: s, model: m } = a

  return (
    <>
      <PageHeader title="Analytics" subtitle="Trends, SLA performance, service quality and AI health.">
        {user.role === 'admin' && <button className="btn-ghost" onClick={slaCheck} disabled={!!busy}>{busy === 'sla' ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} Run SLA check</button>}
        <button className="btn-primary" onClick={report} disabled={!!busy}>{busy === 'report' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export summary CSV</button>
      </PageHeader>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Timer} label="SLA compliance" value={s.sla_compliance != null ? `${s.sla_compliance}%` : '—'} hint={`${s.overdue} overdue · ${s.at_risk} at risk`} tone={s.overdue ? 'rose' : 'emerald'} />
        <StatCard icon={AlertOctagon} label="Escalated open" value={s.escalated_open} hint="Auto + manual escalations" tone="amber" />
        <StatCard icon={Star} label="Average rating" value={s.avg_rating != null ? `${s.avg_rating.toFixed(1)} / 5` : '—'} hint={`${s.rated_count} rating${s.rated_count === 1 ? '' : 's'} · ${s.awaiting_rating} awaiting`} tone="violet" />
        <StatCard icon={Timer} label="Avg resolution" value={s.avg_resolution_hours != null ? `${s.avg_resolution_hours}h` : '—'} hint={`${s.resolution_rate}% resolution rate`} tone="blue" />
        <StatCard icon={Gauge} label="Avg AI confidence" value={`${s.avg_confidence}%`} tone="violet" />
        <StatCard icon={Wand2} label="Admin corrections" value={s.corrected} hint={s.ai_acceptance != null ? `${s.ai_acceptance}% accepted as-is` : '—'} tone="amber" />
        <StatCard icon={Copy} label="Duplicates flagged" value={s.duplicates} tone="blue" />
        <StatCard icon={Brain} label="Total complaints" value={s.total} tone="slate" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <ChartCard title="Complaint volume" subtitle="Last 14 days" className="lg:col-span-2"><TrendChart data={a.trend} /></ChartCard>
        <ChartCard title="Sentiment" subtitle="Lexicon-based analysis"><Donut data={a.by_sentiment} colors={SENTIMENT_COLORS} /></ChartCard>
        <ChartCard title="SLA compliance by priority" subtitle="% of resolved complaints closed within target"><Bars data={a.sla_by_priority} colors={PRIORITY_COLORS} /></ChartCard>
        <ChartCard title="Rating distribution" subtitle="Student resolution ratings"><Bars data={a.rating_distribution} colors={RATING_COLORS} /></ChartCard>
        <ChartCard title="Status"><Donut data={a.by_status} colors={STATUS_COLORS} /></ChartCard>
        <ChartCard title="Category distribution"><Bars data={a.by_category} colors={CATEGORY_COLORS} /></ChartCard>
        <ChartCard title="Priority"><Bars data={a.by_priority} colors={PRIORITY_COLORS} /></ChartCard>
        {user.role === 'admin' && <ChartCard title="Workload by department"><Bars data={a.by_department} horizontal /></ChartCard>}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="p-5 pb-3"><h3 className="font-bold">Department performance</h3><p className="text-xs text-ink-500">SLA targets: {Object.entries(a.sla_targets).map(([p, h]) => `${p} ${h}h`).join(' · ')}</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-ink-500">{['Department', 'Total', 'Open', 'Overdue', 'SLA compliance', 'Avg resolution', 'Rating'].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{a.department_performance.map((d) => (
              <tr key={d.name} className="border-b border-slate-50 transition hover:bg-brand-50/40">
                <td className="px-5 py-3 font-semibold">{d.name}</td><td className="px-5 py-3 tabular-nums">{d.total}</td><td className="px-5 py-3 tabular-nums">{d.open}</td>
                <td className="px-5 py-3">{d.overdue ? <span className="badge bg-rose-50 text-rose-700 ring-rose-200">{d.overdue}</span> : <span className="text-ink-500">0</span>}</td>
                <td className="px-5 py-3">{d.sla_compliance != null ? <span className={`font-semibold ${d.sla_compliance >= 80 ? 'text-emerald-600' : d.sla_compliance >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{d.sla_compliance}%</span> : '—'}</td>
                <td className="px-5 py-3 tabular-nums">{d.avg_resolution_hours != null ? `${d.avg_resolution_hours}h` : '—'}</td>
                <td className="px-5 py-3">{d.avg_rating != null ? <span className="flex items-center gap-2"><Stars value={d.avg_rating} size={13} /><span className="text-xs text-ink-500">{d.avg_rating}</span></span> : '—'}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 font-bold"><Brain size={18} className="text-violet-600" /> Model performance</h3>
            <p className="text-xs text-ink-500">TF-IDF + Multinomial Naive Bayes · trained {fmtDateTime(m.trained_at)} · {m.samples} samples ({m.feedback_samples} from admin feedback)</p></div>
          {user.role === 'admin' && <button className="btn-primary" onClick={retrain} disabled={!!busy}>{busy === 'retrain' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Retrain model</button>}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Category accuracy', m.category.accuracy], ['Category 5-fold CV', m.category.cv_mean], ['Priority accuracy', m.priority.accuracy], ['Priority 5-fold CV', m.priority.cv_mean]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 p-4"><p className="text-xs font-semibold text-ink-500">{l}</p><p className="gradient-text font-display text-2xl font-extrabold">{(v * 100).toFixed(1)}%</p></div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">Metrics use group-aware splits: whole complaint templates are held out so scores reflect unseen wording, not memorisation.</p>
      </div>
    </>
  )
}
