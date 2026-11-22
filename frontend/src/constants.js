import { Cpu, Zap, Wrench, Wallet, ShieldAlert, BookOpen } from 'lucide-react'

export const CATEGORIES = ['Technical', 'Electrical', 'Maintenance', 'Accounts', 'Safety', 'Library']
export const STATUSES = ['Assigned', 'In Progress', 'Resolved', 'Rejected']
export const PRIORITIES = ['High', 'Medium', 'Low']
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative']

export const CATEGORY_META = {
  Technical: { icon: Cpu, color: '#3b6fd8', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  Electrical: { icon: Zap, color: '#8b5cf6', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  Maintenance: { icon: Wrench, color: '#0ea5b7', cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  Accounts: { icon: Wallet, color: '#4f46e5', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  Safety: { icon: ShieldAlert, color: '#e11d48', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  Library: { icon: BookOpen, color: '#0d9488', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
}
export const CATEGORY_COLORS = Object.fromEntries(Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color]))
export const PRIORITY_COLORS = { High: '#e11d48', Medium: '#f59e0b', Low: '#10b981' }
export const STATUS_COLORS = { Assigned: '#3b6fd8', 'In Progress': '#8b5cf6', Resolved: '#10b981', Rejected: '#e11d48' }
export const SENTIMENT_COLORS = { Positive: '#10b981', Neutral: '#94a3b8', Negative: '#e11d48' }

const LOCALE = 'en-IN'
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
export const timeAgo = (d) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** 93784 -> "1d 2h" ; detailed + under 48h -> "26:03:04" */
export function fmtDuration(totalSeconds, detailed = false) {
  const s = Math.abs(Math.floor(totalSeconds))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (detailed && s < 48 * 3600) return [Math.floor(s / 3600), m, sec].map((n) => String(n).padStart(2, '0')).join(':')
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 0)}m`
}
export const isOpen = (status) => status === 'Assigned' || status === 'In Progress'
