import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, Loader2, Brain, Route, Gauge } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { errMsg } from '../api'

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-bg absolute inset-0 opacity-60" /><div className="absolute -right-24 -top-24 h-96 w-96 animate-blob rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 animate-blob rounded-full bg-brand-500/30 blur-3xl" />
        <Logo light />
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight">Complaints, understood and routed in seconds.</h2>
          <p className="mt-4 max-w-md text-brand-200">A trained NLP model reads every complaint, predicts its category and urgency, explains why, and routes it with an SLA clock attached.</p>
          <div className="mt-8 space-y-3">
            {[[Brain, 'Explainable TF-IDF + Naive Bayes AI'], [Route, 'Automatic routing with SLA tracking'], [Gauge, 'Auto-escalation of critical issues']].map(([I, t]) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur"><I size={18} /> <span className="text-sm font-medium">{t}</span></div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-brand-300">© {new Date().getFullYear()} CampusCare AI</p>
      </div>
      <div className="flex items-center justify-center bg-gradient-to-br from-white to-violet-50/60 p-6">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mb-8 mt-2 text-ink-500">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
        </div>
      </div>
    </div>
  )
}

function strength(pw) {
  let n = 0
  if (pw.length >= 8) n++
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) n++
  if (pw.length >= 12) n++
  if (/[^A-Za-z0-9]/.test(pw) && /[A-Z]/.test(pw)) n++
  return n
}
function Strength({ pw }) {
  if (!pw) return null
  const n = strength(pw)
  const label = ['Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'][n]
  const color = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'][n]
  return (
    <div className="-mt-1">
      <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= n ? color : 'bg-slate-200'}`} />)}</div>
      <p className="mt-1 text-xs text-ink-500">{label} · min. 8 characters with a letter and a number</p>
    </div>
  )
}

function Field({ icon: Icon, label, type = 'text', value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !pl-10" type={isPw && show ? 'text' : type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required />
        {isPw && <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
      </div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await login(f)
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`)
      nav('/app')
    } catch (err) { toast.error(errMsg(err)) } finally { setBusy(false) }
  }
  const demo = (email, password) => setF({ email, password })

  return (
    <Shell title="Welcome back" subtitle="Sign in to manage and track campus complaints." footer={<>New here? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="you@college.edu" autoComplete="email" />
        <Field icon={Lock} label="Password" type="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder="••••••••" autoComplete="current-password" />
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Sign in</button>
      </form>
      <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Demo accounts (click to fill)</p>
        <div className="flex flex-wrap gap-2">
          {[['Student', 'student@campuscare.edu', 'student123'], ['Admin', 'admin@campuscare.edu', 'admin123'], ['IT Dept', 'it@campuscare.edu', 'dept123']].map(([l, e, p]) => (
            <button key={l} type="button" onClick={() => demo(e, p)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200 transition hover:text-brand-600 hover:ring-brand-300">{l}</button>
          ))}
        </div>
      </div>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (f.name.trim().length < 2) return toast.error('Please enter your full name')
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) return toast.error('Password needs 8+ characters with a letter and a number')
    if (f.password !== f.confirm) return toast.error('Passwords do not match')
    setBusy(true)
    try {
      await register({ name: f.name, email: f.email, password: f.password })
      toast.success('Account created. Welcome to CampusCare AI!')
      nav('/app')
    } catch (err) { toast.error(errMsg(err)) } finally { setBusy(false) }
  }

  return (
    <Shell title="Create your account" subtitle="Register as a student to submit and track complaints." footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={User} label="Full name" value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Aarav Sharma" autoComplete="name" />
        <Field icon={Mail} label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="you@college.edu" autoComplete="email" />
        <Field icon={Lock} label="Password" type="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder="At least 8 characters" autoComplete="new-password" />
        <Strength pw={f.password} />
        <Field icon={Lock} label="Confirm password" type="password" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} placeholder="Repeat password" autoComplete="new-password" />
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Create account</button>
      </form>
    </Shell>
  )
}
