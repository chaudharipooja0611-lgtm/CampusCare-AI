import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, Copy, Download, FilePlus2, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { download, errMsg } from '../api'
import { CategoryBadge, ConfidenceBar, Empty, EscalationBadge, PageHeader, Pagination, PriorityBadge, SlaPill, Stars, StatusBadge, TableSkeleton } from '../components/ui'
import { CATEGORIES, PRIORITIES, SENTIMENTS, STATUSES, fmtDate } from '../constants'
import { useAuth } from '../context/AuthContext'

const PER_PAGE = 12

export function ComplaintTable({ rows, showUser, sort, order, onSort }) {
  const nav = useNavigate()
  const Th = ({ label, k }) => (
    <th className="px-4 py-3 font-semibold">
      {onSort && k ? (
        <button onClick={() => onSort(k)} className={`flex items-center gap-1 uppercase tracking-wide transition hover:text-brand-700 ${sort === k ? 'text-brand-800' : ''}`}>
          {label}{sort === k && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
      ) : label}
    </th>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-ink-500">
          <Th label="Ticket" /><Th label="Complaint" /><Th label="Category" /><Th label="Priority" k="priority" /><Th label="Status" k="status" /><Th label="SLA" k="sla" /><Th label="AI confidence" k="confidence" /><Th label="Date" k="created_at" />
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} onClick={() => nav(`/app/complaints/${c.id}`)} className="cursor-pointer border-b border-slate-50 transition hover:bg-brand-50/50">
              <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-bold text-brand-700">{c.ticket_id}</td>
              <td className="max-w-xs px-4 py-3.5">
                <p className="flex items-center gap-1.5 truncate font-semibold">{c.title}{c.duplicate_of && <span title={`Possible duplicate of ${c.duplicate_ticket}`}><Copy size={13} className="shrink-0 text-amber-500" /></span>}</p>
                <p className="flex items-center gap-2 truncate text-xs text-ink-500">{showUser ? `${c.user_name} · ` : ''}{c.location}{c.rating ? <Stars value={c.rating} size={11} /> : null}</p>
              </td>
              <td className="px-4 py-3.5"><CategoryBadge category={c.category} />{c.is_corrected ? <span className="ml-1 text-[10px] font-semibold text-violet-600">edited</span> : null}</td>
              <td className="px-4 py-3.5"><div className="flex flex-col items-start gap-1"><PriorityBadge priority={c.priority} /><EscalationBadge level={c.escalation_level} /></div></td>
              <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3.5"><SlaPill c={c} /></td>
              <td className="w-40 px-4 py-3.5"><ConfidenceBar value={c.confidence} /></td>
              <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-500">{fmtDate(c.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CHIPS = [['overdue', 'Overdue'], ['escalated', 'Escalated'], ['low_confidence', 'Low AI confidence'], ['duplicate', 'Duplicates'], ['corrected', 'AI corrected'], ['unrated', 'Awaiting rating']]
const ADV_KEYS = ['sentiment', 'department_id', 'date_from', 'date_to', 'min_confidence', 'rating_max']

export default function Complaints() {
  const { user } = useAuth()
  const [sp, setSp] = useSearchParams()
  const [data, setData] = useState(null)
  const [depts, setDepts] = useState([])
  const [exporting, setExporting] = useState(false)
  const [showAdv, setShowAdv] = useState(ADV_KEYS.some((k) => sp.get(k)))
  const [q, setQ] = useState(sp.get('q') || '')
  const titles = { student: ['My complaints', 'Everything you have submitted'], department: ['Assigned complaints', 'Complaints routed to your department'], admin: ['All complaints', 'Search, review, correct and export every complaint'] }

  const params = useMemo(() => Object.fromEntries(sp.entries()), [sp])
  const page = Number(params.page || 1)
  const sort = params.sort || 'created_at'
  const order = params.order || 'desc'

  const setParam = (changes) => {
    const next = new URLSearchParams(sp)
    Object.entries(changes).forEach(([k, v]) => (v === '' || v === null || v === undefined ? next.delete(k) : next.set(k, v)))
    if (!('page' in changes)) next.delete('page')
    setSp(next, { replace: true })
  }

  // keep the search box in sync with URL changes (e.g. top-bar search) and debounce typing
  useEffect(() => { setQ(sp.get('q') || '') }, [sp.get('q')])
  useEffect(() => {
    if (q === (sp.get('q') || '')) return
    const t = setTimeout(() => setParam({ q: q.trim() }), 350)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => { if (user.role === 'admin') api.get('/departments').then((r) => setDepts(r.data.departments)).catch(() => {}) }, [user.role])

  useEffect(() => {
    let live = true
    setData(null)
    api.get('/complaints', { params: { ...params, per_page: PER_PAGE, page } })
      .then((r) => live && setData(r.data))
      .catch((e) => { toast.error(errMsg(e)); live && setData({ complaints: [], total: 0, page: 1, pages: 1 }) })
    return () => { live = false }
  }, [sp])

  const activeCount = Object.keys(params).filter((k) => !['page', 'sort', 'order'].includes(k)).length
  const onSort = (k) => setParam({ sort: k, order: sort === k && order === 'desc' ? 'asc' : 'desc' })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { page: _p, ...filters } = params
      const n = await download('/complaints/export', filters)
      toast.success(`Exported ${n} complaint${n === 1 ? '' : 's'} to CSV`)
    } catch (e) {
      toast.error(e?.response?.data instanceof Blob ? 'Export failed. Please try again.' : errMsg(e))
    } finally { setExporting(false) }
  }

  const Sel = ({ k, label, opts }) => (
    <select className="input !w-auto" value={params[k] || ''} onChange={(e) => setParam({ [k]: e.target.value })} aria-label={label}>
      <option value="">{label}</option>{opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <>
      <PageHeader title={titles[user.role][0]} subtitle={titles[user.role][1]}>
        <button className="btn-ghost" onClick={exportCsv} disabled={exporting || !data?.total}>{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV</button>
        <Link to="/app/new" className="btn-primary"><FilePlus2 size={16} /> New complaint</Link>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-10" placeholder="Search ticket, title, description, location, student…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} /></div>
            <Sel k="status" label="All statuses" opts={STATUSES} /><Sel k="category" label="All categories" opts={CATEGORIES} /><Sel k="priority" label="All priorities" opts={PRIORITIES} />
            <button className={`btn-ghost ${showAdv ? '!border-violet-300 !bg-violet-50 !text-violet-800' : ''}`} onClick={() => setShowAdv(!showAdv)}><SlidersHorizontal size={16} /> Filters <ChevronDown size={14} className={`transition ${showAdv ? 'rotate-180' : ''}`} /></button>
          </div>

          {showAdv && (
            <div className="grid animate-fade-up gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label">Sentiment</label><select className="input" value={params.sentiment || ''} onChange={(e) => setParam({ sentiment: e.target.value })}><option value="">Any</option>{SENTIMENTS.map((s) => <option key={s}>{s}</option>)}</select></div>
              {user.role === 'admin' && <div><label className="label">Department</label><select className="input" value={params.department_id || ''} onChange={(e) => setParam({ department_id: e.target.value })}><option value="">Any</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
              <div><label className="label">From date</label><input type="date" className="input" value={params.date_from || ''} max={params.date_to || undefined} onChange={(e) => setParam({ date_from: e.target.value })} /></div>
              <div><label className="label">To date</label><input type="date" className="input" value={params.date_to || ''} min={params.date_from || undefined} onChange={(e) => setParam({ date_to: e.target.value })} /></div>
              <div><label className="label">Min. AI confidence</label><select className="input" value={params.min_confidence || ''} onChange={(e) => setParam({ min_confidence: e.target.value })}><option value="">Any</option>{[50, 70, 90].map((n) => <option key={n} value={n}>{n}%+</option>)}</select></div>
              <div><label className="label">Rating</label><select className="input" value={params.rating_max || ''} onChange={(e) => setParam({ rating_max: e.target.value })}><option value="">Any</option><option value="2">2★ or lower</option><option value="3">3★ or lower</option></select></div>
              <div><label className="label">Sort by</label><select className="input" value={sort} onChange={(e) => setParam({ sort: e.target.value })}>{[['created_at', 'Date submitted'], ['priority', 'Priority'], ['sla', 'SLA deadline'], ['confidence', 'AI confidence'], ['status', 'Status']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="label">Order</label><select className="input" value={order} onChange={(e) => setParam({ order: e.target.value })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {CHIPS.map(([k, l]) => {
              const on = params[k] === '1'
              return <button key={k} onClick={() => setParam({ [k]: on ? '' : '1' })} className={`badge !px-3 !py-1.5 transition ${on ? 'bg-brand-900 text-white ring-brand-900' : 'bg-white text-ink-700 ring-slate-200 hover:ring-violet-300'}`}>{l}</button>
            })}
            {activeCount > 0 && <button onClick={() => { setQ(''); setSp({}, { replace: true }) }} className="ml-auto flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"><X size={12} /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}</button>}
          </div>
        </div>

        {data === null ? <TableSkeleton />
          : data.complaints.length === 0 ? <Empty title="No complaints found" hint={activeCount ? 'No complaints match these filters. Try removing some.' : 'Submit a complaint to get started.'} />
          : <><ComplaintTable rows={data.complaints} showUser={user.role !== 'student'} sort={sort} order={order} onSort={onSort} />
              <Pagination page={data.page} pages={data.pages} total={data.total} perPage={PER_PAGE} onChange={(p) => setParam({ page: p })} /></>}
      </div>
    </>
  )
}
