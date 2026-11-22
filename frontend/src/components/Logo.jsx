import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-500 text-white shadow-glow ring-1 ring-white/20">
        <ShieldCheck size={20} />
      </span>
      <span className={`font-display text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>
        Campus<span className={light ? 'gradient-text-light' : 'gradient-text'}>Care</span> AI
      </span>
    </Link>
  )
}
