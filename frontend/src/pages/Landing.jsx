import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Route, Gauge, Copy, BarChart3, ShieldCheck, FileText, Cpu, Bell, Menu, X, Loader2, Sparkles, Search, Timer, AlertOctagon, Star, Download, Lightbulb, GraduationCap, Building2, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../components/Logo'
import AIResult from '../components/AIResult'
import { CATEGORY_META, CATEGORIES } from '../constants'
import { useAuth } from '../context/AuthContext'
import api, { errMsg } from '../api'

const FEATURES = [
  [Brain, 'AI classification', 'TF-IDF + Multinomial Naive Bayes sorts every complaint into six categories with a confidence score.'],
  [Lightbulb, 'Explainable predictions', 'See exactly which words pushed the model towards a category or priority — no black box.'],
  [Timer, 'SLA countdowns', 'Every complaint gets a resolution deadline based on priority, with live countdowns and overdue alerts.'],
  [AlertOctagon, 'Auto-escalation', 'Hazard keywords, safety issues and SLA breaches escalate to administrators automatically.'],
  [Star, 'Resolution ratings', 'Students rate resolved complaints, giving departments real feedback and admins a quality signal.'],
  [Bell, 'Smart notifications', 'A prioritised notification center puts critical alerts first and keeps everyone in the loop.'],
  [Copy, 'Duplicate detection', 'TF-IDF cosine similarity flags repeat complaints so teams fix an issue once.'],
  [Download, 'CSV reports', 'Filter by anything and export complaints or a management summary in one click.'],
  [BarChart3, 'Live analytics', 'Interactive dashboards for trends, workload, SLA compliance, ratings and model quality.'],
]

function TryAI() {
  const [text, setText] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try { setRes((await api.post('/complaints/predict', { title: '', description: text })).data) }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  const samples = ['Sparks and burning smell from the switchboard in the hostel corridor', 'My scholarship amount has not been credited for three months', 'The reference books for DBMS are missing from the library']
  return (
    <div className="card grid gap-6 p-6 md:grid-cols-2 md:p-8">
      <div>
        <label className="label">Describe a campus problem</label>
        <textarea className="input h-36 resize-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Wifi has been down in the hostel since morning…" maxLength={1000} />
        <div className="mt-3 flex flex-wrap gap-2">
          {samples.map((s) => <button key={s} onClick={() => setText(s)} className="rounded-lg bg-violet-50 px-2.5 py-1 text-left text-xs text-violet-700 transition hover:bg-violet-100">{s.slice(0, 38)}…</button>)}
        </div>
        <button className="btn-primary mt-4" onClick={run} disabled={busy || text.trim().length < 10}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyse with AI</button>
      </div>
      <div className="max-h-[34rem] overflow-y-auto rounded-2xl bg-slate-50 p-5">
        {res ? <AIResult result={res} text={text} /> : <div className="grid h-full min-h-40 place-items-center text-center text-sm text-ink-500">The real model's prediction, confidence and explanation appear here.</div>}
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const links = [['Features', '#features'], ['How it works', '#how'], ['Try the AI', '#try'], ['Roles', '#roles']]
  return (
    <div className="overflow-x-hidden bg-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <Logo light />
          <nav className="hidden items-center gap-8 md:flex">
            {links.map(([l, h]) => <a key={l} href={h} className="text-sm font-semibold text-white/70 transition hover:text-white">{l}</a>)}
            <Link to="/track" className="text-sm font-semibold text-white/70 transition hover:text-white">Track ticket</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {user ? <Link to="/app" className="btn bg-white text-brand-800 hover:bg-brand-50">Open dashboard <ArrowRight size={16} /></Link> : <>
              <Link to="/login" className="btn border border-white/20 text-white hover:bg-white/10">Sign in</Link>
              <Link to="/register" className="btn bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 hover:brightness-110">Get started</Link></>}
          </div>
          <button className="text-white md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="space-y-2 border-t border-white/10 bg-brand-950 px-5 py-4 md:hidden">
            {links.map(([l, h]) => <a key={l} href={h} onClick={() => setOpen(false)} className="block py-1.5 text-sm font-semibold text-white/80">{l}</a>)}
            <Link to="/track" className="block py-1.5 text-sm font-semibold text-white/80">Track ticket</Link>
            <Link to={user ? '/app' : '/login'} className="btn-primary w-full">{user ? 'Open dashboard' : 'Sign in'}</Link>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -left-24 top-10 h-96 w-96 animate-blob rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute right-0 top-24 h-[28rem] w-[28rem] animate-blob rounded-full bg-violet-500/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <span className="badge bg-white/10 text-violet-200 ring-white/15 backdrop-blur"><Sparkles size={12} /> Explainable NLP helpdesk for campuses</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-6xl">Complaints <span className="gradient-text-light">classified, routed &amp; resolved</span> on the clock</h1>
            <p className="mt-6 max-w-xl text-lg text-brand-200">A trained machine-learning model understands every complaint, explains its reasoning, routes it to the right department and starts an SLA countdown — escalating anything critical automatically.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/app/new' : '/register'} className="btn bg-gradient-to-r from-violet-500 to-indigo-500 !px-6 !py-3 text-base text-white shadow-lg shadow-violet-500/30 hover:brightness-110">Submit a complaint <ArrowRight size={18} /></Link>
              <Link to="/track" className="btn border border-white/20 !px-6 !py-3 text-base text-white hover:bg-white/10"><Search size={18} /> Track a ticket</Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-6 text-sm">
              {[['6', 'AI categories'], ['3', 'SLA tiers'], ['24/7', 'SLA monitoring']].map(([n, l]) => (
                <div key={l}><p className="gradient-text-light font-display text-3xl font-extrabold">{n}</p><p className="text-brand-300">{l}</p></div>
              ))}
            </div>
          </div>
          <div className="relative animate-float">
            <div className="relative space-y-4 rounded-3xl bg-white/95 p-6 text-ink-900 shadow-navy ring-1 ring-white/30">
              <div className="flex items-center justify-between"><p className="font-display font-bold">CC-7K2M9QXA</p><span className="badge bg-rose-50 text-rose-700 ring-rose-200"><AlertOctagon size={12} /> Escalated</span></div>
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-ink-700">“<mark className="rounded bg-violet-200 px-0.5 font-semibold">Sparks</mark> from the <mark className="rounded bg-violet-200 px-0.5 font-semibold">switchboard</mark> in Block B and a <mark className="rounded bg-violet-100 px-0.5 font-semibold">burning smell</mark>. Please act immediately.”</p>
              {[['Electrical', 94, '#8b5cf6'], ['Safety', 4, '#e11d48'], ['Maintenance', 2, '#0ea5b7']].map(([c, v, col]) => (
                <div key={c} className="flex items-center gap-3 text-xs"><span className="w-20 font-semibold">{c}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full animate-grow rounded-full" style={{ width: `${v}%`, background: col }} /></div><span className="w-8 tabular-nums">{v}%</span></div>
              ))}
              <div className="flex flex-wrap items-center gap-2"><span className="badge bg-rose-50 text-rose-700 ring-rose-200">High priority</span><span className="badge bg-violet-50 text-violet-700 ring-violet-200">→ Electrical Dept.</span><span className="badge bg-amber-50 text-amber-700 ring-amber-200"><Timer size={12} /> 23:41:08 left</span></div>
              <p className="text-[11px] text-ink-500">Illustrative example of the pipeline output.</p>
            </div>
            <div className="absolute -bottom-5 -left-6 hidden items-center gap-2 rounded-2xl bg-white px-4 py-3 text-ink-900 shadow-glow sm:flex"><Bell size={16} className="text-violet-600" /><span className="text-xs font-semibold">Admins alerted instantly</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center"><span className="badge bg-violet-50 text-violet-700 ring-violet-200">Features</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Everything a modern campus helpdesk needs</h2><p className="mt-3 text-ink-500">Real machine learning and real workflows — from first complaint to rated resolution.</p></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([I, t, d]) => (
            <div key={t} className="card card-hover p-6"><span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-700 to-violet-600 text-white shadow-lg shadow-violet-500/25"><I size={22} /></span><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="mt-1.5 text-sm text-ink-500">{d}</p></div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="mb-12 text-center text-3xl font-extrabold sm:text-4xl">From complaint to rated resolution</h2>
          <div className="grid gap-5 md:grid-cols-4">
            {[[FileText, 'Submit', 'Describe the issue, add location and a photo.'], [Cpu, 'AI analyses', 'Category, priority, sentiment, duplicates and the reasoning behind them.'], [Route, 'Routed + SLA', 'The right department gets it with a ticket ID and countdown.'], [ShieldCheck, 'Resolved & rated', 'Track progress, then rate how it was handled.']].map(([I, t, d], i) => (
              <div key={t} className="card relative p-6 text-center"><span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-800 px-2.5 py-0.5 text-xs font-bold text-white">{i + 1}</span><I className="mx-auto text-violet-600" size={28} /><h3 className="mt-3 font-bold">{t}</h3><p className="mt-1 text-sm text-ink-500">{d}</p></div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => { const I = CATEGORY_META[c].icon; return <span key={c} className={`badge !px-3.5 !py-1.5 text-sm ${CATEGORY_META[c].cls}`}><I size={14} /> {c}</span> })}
          </div>
        </div>
      </section>

      <section id="try" className="mx-auto max-w-5xl px-5 py-20">
        <div className="mb-8 text-center"><span className="badge bg-violet-50 text-violet-700 ring-violet-200">Live demo</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Try the AI yourself</h2><p className="mt-3 text-ink-500">This calls the trained model on our Flask backend. Open “Why did the AI predict this?” to see the reasoning.</p></div>
        <TryAI />
      </section>

      <section id="roles" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="mb-12 text-center text-3xl font-extrabold sm:text-4xl">Built for everyone on campus</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {[[GraduationCap, 'Students', ['Submit with photos and live AI preview', 'Track tickets with SLA countdown', 'Rate resolutions and leave feedback']],
              [Building2, 'Departments', ['Dedicated queue of assigned complaints', 'Overdue and escalation alerts', 'Update status, escalate, export CSV']],
              [UserCog, 'Administrators', ['Correct AI predictions and re-route', 'Manage departments, users and roles', 'Analytics, SLA compliance and model retraining']]].map(([I, t, items]) => (
              <div key={t} className="card p-7"><span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-900 text-violet-300"><I size={22} /></span><h3 className="mt-4 text-xl font-bold">{t}</h3>
                <ul className="mt-3 space-y-2 text-sm text-ink-700">{items.map((i) => <li key={i} className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-violet-500" />{i}</li>)}</ul></div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-800 to-violet-700 p-10 text-center text-white shadow-navy sm:p-14">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative"><h2 className="text-3xl font-extrabold sm:text-4xl">Ready to make your campus run smoother?</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-200">Create a free account and submit your first complaint in under a minute.</p>
            <Link to="/register" className="btn mt-7 bg-white !px-7 !py-3 text-brand-800 hover:bg-brand-50">Get started free <ArrowRight size={18} /></Link></div>
        </div>
      </section>
      <footer className="border-t border-slate-100 bg-white py-8 text-center text-sm text-ink-500">© {new Date().getFullYear()} CampusCare AI · Smart Complaint Classification and Routing System</footer>
    </div>
  )
}
