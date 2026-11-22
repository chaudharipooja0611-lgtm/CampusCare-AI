import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, Brain, CheckCircle2, Copy, MapPin, Save, Wand2, User, Building2, Clock, Timer, Send, Star, Lightbulb, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg, fileUrl } from '../api'
import { CategoryBadge, ConfidenceBar, EscalationBadge, Modal, PriorityBadge, SentimentBadge, Skeleton, Stars, StarInput, StatusBadge, slaStateOf, useCountdown } from '../components/ui'
import Explainability from '../components/Explainability'
import { CATEGORIES, PRIORITIES, STATUSES, fmtDateTime, fmtDuration, isOpen } from '../constants'
import { useAuth } from '../context/AuthContext'
import { Timeline } from './Track'

function SlaCard({ c }) {
  const left = useCountdown(c, 1000)
  const state = slaStateOf(c, left)
  const open = isOpen(c.status)
  const total = c.sla_total_seconds
  const elapsedPct = left == null ? 100 : Math.min(100, Math.max(0, ((total - left) / total) * 100))
  const tone = { on_track: ['from-emerald-400 to-emerald-500', 'text-emerald-600'], at_risk: ['from-amber-400 to-orange-500', 'text-amber-600'], overdue: ['from-rose-500 to-rose-600', 'text-rose-600'], met: ['from-emerald-400 to-emerald-500', 'text-emerald-600'], resolved_late: ['from-amber-400 to-orange-500', 'text-amber-600'], closed: ['from-slate-300 to-slate-400', 'text-slate-500'] }[state]
  const headline = open ? (left < 0 ? 'Overdue' : 'Time remaining') : state === 'met' ? 'Resolved within SLA' : state === 'resolved_late' ? 'Resolved after the deadline' : 'Closed'
  return (
    <div className={`card overflow-hidden p-6 ${state === 'overdue' ? 'border-rose-200 ring-1 ring-rose-100' : ''}`}>
      <h3 className="mb-3 flex items-center gap-2 font-bold"><Timer size={18} className="text-violet-600" /> SLA tracking</h3>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{headline}</p>
      <p className={`font-display text-3xl font-extrabold tabular-nums ${tone[1]} ${state === 'overdue' ? 'animate-pulse2' : ''}`}>
        {open && left != null ? `${left < 0 ? '−' : ''}${fmtDuration(left, true)}` : state === 'met' ? '✓ On time' : state === 'resolved_late' ? 'Late' : '—'}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-gradient-to-r transition-all ${tone[0]}`} style={{ width: `${elapsedPct}%` }} /></div>
      <div className="mt-3 flex justify-between text-xs text-ink-500"><span>Target: <b className="text-ink-900">{total / 3600}h</b> ({c.priority})</span><span>Due: <b className="text-ink-900">{fmtDateTime(c.sla_due_at)}</b></span></div>
      {c.sla_breached_at && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">SLA breach flagged on {fmtDateTime(c.sla_breached_at)}.</p>}
    </div>
  )
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { state } = useLocation()
  const [c, setC] = useState(null)
  const [depts, setDepts] = useState([])
  const [st, setSt] = useState({ status: '', note: '' })
  const [fix, setFix] = useState({ category: '', priority: '', department_id: '' })
  const [busy, setBusy] = useState('')
  const [escOpen, setEscOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [rate, setRate] = useState({ rating: 0, feedback: '' })

  const apply = (data) => {
    const comp = data.complaint
    setC((prev) => ({ ...(prev || {}), ...comp, updates: data.updates || comp.updates || prev?.updates, duplicates: comp.duplicates ?? prev?.duplicates, explanation: comp.explanation ?? prev?.explanation }))
    setSt({ status: comp.status, note: '' })
    setFix({ category: comp.category, priority: comp.priority, department_id: comp.department_id || '' })
  }

  useEffect(() => {
    setC(null)
    api.get(`/complaints/${id}`).then((r) => apply(r.data)).catch((e) => { toast.error(errMsg(e)); setC(false) })
    if (user.role === 'admin') api.get('/departments').then((r) => setDepts(r.data.departments))
  }, [id])

  if (c === null) return <div className="space-y-5"><Skeleton className="h-8 w-40" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 !rounded-2xl lg:col-span-2" /><Skeleton className="h-96 !rounded-2xl" /></div></div>
  if (c === false) return <div className="card p-10 text-center">Complaint not found or you do not have access. <Link to="/app/complaints" className="font-semibold text-brand-700">Go back</Link></div>

  const canManage = user.role === 'admin' || user.role === 'department'
  const open = isOpen(c.status)
  const isOwner = c.user_id === user.id

  const run = (key, fn, ok) => async () => {
    setBusy(key)
    try { const r = await fn(); apply(r.data); toast.success(ok) } catch (e) { toast.error(errMsg(e)); return false } finally { setBusy('') }
    return true
  }
  const saveStatus = run('status', () => api.patch(`/complaints/${id}/status`, st), 'Status updated')
  const saveFix = run('fix', () => api.patch(`/complaints/${id}/correct`, { ...fix, department_id: fix.department_id || undefined }), 'AI prediction corrected. Feedback saved for retraining.')
  const submitRating = async () => {
    if (!rate.rating) return toast.error('Please choose a star rating')
    await run('rate', () => api.post(`/complaints/${id}/rating`, rate), 'Thank you for your feedback!')()
  }
  const escalate = async () => {
    if (reason.trim().length < 5) return toast.error('Please give a reason (at least 5 characters)')
    if (await run('esc', () => api.post(`/complaints/${id}/escalate`, { reason }), 'Complaint escalated')()) { setEscOpen(false); setReason('') }
  }
  const onCategory = (category) => {
    const d = depts.find((x) => x.category === category)
    setFix({ ...fix, category, department_id: d ? d.id : fix.department_id })
  }

  return (
    <>
      <Link to="/app/complaints" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={16} /> Back to complaints</Link>
      {state?.fresh && (
        <div className="mb-5 flex animate-fade-up items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 /> <div><p className="font-bold">Complaint submitted successfully</p><p className="text-sm">Your ticket ID is <span className="font-mono font-bold">{c.ticket_id}</span> — keep it to track progress.</p></div>
        </div>
      )}
      {c.escalation_level > 0 && open && (
        <div className={`mb-5 flex animate-fade-up items-start gap-3 rounded-2xl p-4 text-white shadow-lg ${c.escalation_level > 1 ? 'bg-gradient-to-r from-rose-700 to-rose-500 shadow-rose-500/20' : 'bg-gradient-to-r from-brand-900 to-rose-600 shadow-rose-500/10'}`}>
          <AlertOctagon className="mt-0.5 shrink-0" />
          <div><p className="font-bold">{c.escalation_level > 1 ? 'Critical escalation' : 'Escalated to administrators'}</p><p className="text-sm text-white/85">{c.escalation_reason}{c.escalated_at && ` · ${fmtDateTime(c.escalated_at)}`}</p></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-brand-50 px-3 py-1 font-mono text-sm font-bold text-brand-800">{c.ticket_id}</span>
              <div className="flex flex-wrap gap-2"><StatusBadge status={c.status} /><PriorityBadge priority={c.priority} /><EscalationBadge level={c.escalation_level} /></div>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold">{c.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1"><MapPin size={14} />{c.location}</span>
              <span className="flex items-center gap-1"><User size={14} />{c.user_name}</span>
              <span className="flex items-center gap-1"><Clock size={14} />{fmtDateTime(c.created_at)}</span>
              <span className="flex items-center gap-1"><Building2 size={14} />{c.department_name || 'Unassigned'}</span>
            </div>
            <p className="mt-5 whitespace-pre-wrap leading-relaxed text-ink-700">{c.description}</p>
            {c.image_path && <a href={fileUrl(c.image_path)} target="_blank" rel="noreferrer"><img src={fileUrl(c.image_path)} alt="Attachment" className="mt-5 max-h-80 rounded-xl object-cover ring-1 ring-slate-200 transition hover:opacity-90" /></a>}
          </div>

          {c.status === 'Resolved' && (
            <div className="card p-6">
              <h3 className="mb-4 flex items-center gap-2 font-bold"><Star size={18} className="text-amber-500" /> Resolution feedback</h3>
              {c.rating ? (
                <div className="rounded-xl bg-amber-50/60 p-4"><div className="flex items-center gap-3"><Stars value={c.rating} size={22} /><span className="text-sm font-bold">{c.rating}/5</span><span className="text-xs text-ink-500">rated {fmtDateTime(c.rated_at)}</span></div>
                  {c.feedback ? <p className="mt-2 text-sm text-ink-700">“{c.feedback}”</p> : <p className="mt-2 text-sm text-ink-500">No written feedback.</p>}</div>
              ) : isOwner ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-500">Your complaint was resolved. How well was it handled?</p>
                  <StarInput value={rate.rating} onChange={(rating) => setRate({ ...rate, rating })} />
                  <textarea className="input h-24 resize-none" placeholder="Tell us more (optional)" maxLength={500} value={rate.feedback} onChange={(e) => setRate({ ...rate, feedback: e.target.value })} />
                  <button className="btn-primary" onClick={submitRating} disabled={busy === 'rate'}>{busy === 'rate' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit feedback</button>
                </div>
              ) : <p className="text-sm text-ink-500">Waiting for the student to rate this resolution.</p>}
            </div>
          )}

          <div className="card p-6"><h3 className="mb-4 font-bold">Status timeline</h3><Timeline updates={c.updates} /></div>
        </div>

        <div className="space-y-6">
          <SlaCard c={c} />

          <div className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold"><Brain size={18} className="text-violet-600" /> AI insights</h3>
            <div className="space-y-4 text-sm">
              <div><p className="label">Category</p><div className="flex items-center gap-2"><CategoryBadge category={c.category} />{c.is_corrected ? <span className="text-xs text-violet-600">AI said: {c.predicted_category}</span> : null}</div></div>
              <div><p className="label">Prediction confidence</p><ConfidenceBar value={c.confidence} /></div>
              <div><p className="label">Sentiment</p><SentimentBadge sentiment={c.sentiment} /> <span className="text-xs text-ink-500">score {c.sentiment_score}</span></div>
              {c.duplicate_of && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><p className="flex items-center gap-1 font-bold"><Copy size={12} /> Possible duplicate</p>Similar to {c.duplicate_ticket} ({c.duplicate_score}% match)</div>}
              {c.duplicates?.length > 0 && <div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="mb-1 font-bold">Linked duplicates</p>{c.duplicates.map((d) => <Link key={d.id} to={`/app/complaints/${d.id}`} className="block text-brand-700 hover:underline">{d.ticket_id} – {d.title}</Link>)}</div>}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold"><Lightbulb size={18} className="text-violet-600" /> Why this prediction?</h3>
            <Explainability explanation={c.explanation} text={`${c.title}. ${c.description}`} />
            {c.is_corrected ? <p className="mt-3 text-xs text-ink-500">Explains the original AI prediction (<b>{c.predicted_category}</b>); an administrator later changed it.</p> : null}
          </div>

          {canManage && (
            <div className="card p-6">
              <h3 className="mb-4 font-bold">Update status</h3>
              <select className="input mb-3" value={st.status} onChange={(e) => setSt({ ...st, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              <textarea className="input mb-3 h-24 resize-none" placeholder="Add a note (required for Resolved / Rejected)" value={st.note} onChange={(e) => setSt({ ...st, note: e.target.value })} maxLength={500} />
              <button className="btn-primary w-full" onClick={saveStatus} disabled={busy === 'status'}>{busy === 'status' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save update</button>
              {open && c.escalation_level < 2 && <button className="btn-danger mt-3 w-full" onClick={() => setEscOpen(true)}><AlertOctagon size={16} /> Escalate complaint</button>}
              {!open && user.role !== 'admin' && <p className="mt-3 text-xs text-ink-500">Closed complaints can only be reopened by an administrator.</p>}
            </div>
          )}

          {user.role === 'admin' && (
            <div className="card border-violet-200 p-6">
              <h3 className="mb-1 flex items-center gap-2 font-bold"><Wand2 size={18} className="text-violet-600" /> Correct AI prediction</h3>
              <p className="mb-4 text-xs text-ink-500">Corrections re-route the complaint, recalculate its SLA if priority changes, and are saved as training feedback.</p>
              <div className="space-y-3">
                <div><label className="label">Category</label><select className="input" value={fix.category} onChange={(e) => onCategory(e.target.value)}>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div><label className="label">Priority</label><select className="input" value={fix.priority} onChange={(e) => setFix({ ...fix, priority: e.target.value })}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div><label className="label">Department</label><select className="input" value={fix.department_id} onChange={(e) => setFix({ ...fix, department_id: Number(e.target.value) })}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <button className="btn-ghost w-full" onClick={saveFix} disabled={busy === 'fix'}><Save size={16} /> Apply correction</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {escOpen && (
        <Modal title="Escalate complaint" onClose={() => setEscOpen(false)}>
          <p className="mb-3 text-sm text-ink-500">Administrators will be alerted immediately. {c.escalation_level === 1 ? 'This raises it to a critical escalation.' : ''}</p>
          <textarea className="input h-28 resize-none" autoFocus placeholder="Why does this need urgent attention?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEscOpen(false)}>Cancel</button><button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={escalate} disabled={busy === 'esc'}>{busy === 'esc' && <Loader2 size={16} className="animate-spin" />} Escalate</button></div>
        </Modal>
      )}
    </>
  )
}
