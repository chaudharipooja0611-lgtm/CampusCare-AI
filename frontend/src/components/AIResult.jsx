import { useState } from 'react'
import { Brain, ChevronDown, Copy, Route, Smile, Frown, Meh, Timer, AlertOctagon } from 'lucide-react'
import { CategoryBadge, ConfidenceBar, PriorityBadge, SentimentBadge } from './ui'
import Explainability from './Explainability'
import { CATEGORY_META } from '../constants'

const SentIcon = { Positive: Smile, Neutral: Meh, Negative: Frown }

export default function AIResult({ result, text }) {
  const { prediction: p, sentiment: s, duplicates = [], sla_hours: sla } = result
  const [why, setWhy] = useState(false)
  const SI = SentIcon[s.label]
  const sorted = Object.entries(p.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-2"><CategoryBadge category={p.category} /><PriorityBadge priority={p.priority} /><SentimentBadge sentiment={s.label} /></div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-ink-500"><span className="flex items-center gap-1"><Brain size={12} /> Model confidence</span>{p.confidence < 60 && <span className="text-amber-600">Low – needs admin review</span>}</div>
        <ConfidenceBar value={p.confidence} />
      </div>
      <div className="space-y-1.5">
        {sorted.map(([c, v]) => (
          <div key={c} className="flex items-center gap-2 text-xs">
            <span className="w-24 text-ink-500">{c}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${v}%`, background: CATEGORY_META[c].color }} /></div>
            <span className="w-10 text-right tabular-nums text-ink-500">{v}%</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1 font-semibold text-ink-500"><Route size={12} /> Routing</p><p className="mt-1 font-bold">{p.category}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1 font-semibold text-ink-500">{SI && <SI size={12} />} Sentiment</p><p className="mt-1 font-bold">{s.label}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1 font-semibold text-ink-500"><Timer size={12} /> SLA</p><p className="mt-1 font-bold">{sla}h</p></div>
      </div>
      {p.priority_reason === 'urgent-keyword' && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">Priority raised to High because urgent / safety keywords were detected.</p>}
      {p.priority === 'High' && p.explanation?.priority?.urgent_keywords?.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertOctagon size={14} /> Critical wording detected – this will be auto-escalated on submission.</p>
      )}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="mb-1 flex items-center gap-1 font-bold"><Copy size={12} /> Possible duplicate complaint</p>
          {duplicates.map((d) => <p key={d.id}>{d.ticket_id} · “{d.title}” — {d.similarity}% similar ({d.status})</p>)}
        </div>
      )}
      <button onClick={() => setWhy(!why)} className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50">
        Why did the AI predict this? <ChevronDown size={16} className={`transition ${why ? 'rotate-180' : ''}`} />
      </button>
      {why && <Explainability explanation={p.explanation} text={text} />}
    </div>
  )
}
