import { useMemo } from 'react'
import { Lightbulb, ShieldAlert } from 'lucide-react'

/** word -> signed weight (largest magnitude wins) built from the model's supporting / opposing terms */
function wordWeights(cat) {
  const m = {}
  const add = (terms) => terms.forEach((t) => t.term.split(' ').forEach((w) => { if (Math.abs(m[w] || 0) < Math.abs(t.weight)) m[w] = t.weight }))
  add(cat.supporting_terms)
  add(cat.opposing_terms)
  return m
}

function Highlighted({ text, cat }) {
  const weights = useMemo(() => wordWeights(cat), [cat])
  const parts = text.split(/([A-Za-z0-9']+)/g)
  return (
    <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-ink-700">
      {parts.map((p, i) => {
        const w = weights[p.toLowerCase()]
        if (w === undefined || !/^[A-Za-z0-9']+$/.test(p)) return <span key={i}>{p}</span>
        const cls = w > 0 ? (w >= 8 ? 'bg-violet-300/70 text-brand-950' : 'bg-violet-100 text-violet-900') : 'bg-rose-100 text-rose-800'
        return <mark key={i} title={`${w > 0 ? '+' : ''}${w}% of the evidence`} className={`rounded px-0.5 font-semibold ${cls}`}>{p}</mark>
      })}
    </p>
  )
}

const Bar = ({ term, weight, tone }) => {
  const w = Math.min(100, Math.abs(weight) * 4)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 truncate font-medium text-ink-700" title={term}>{term}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full animate-grow rounded-full ${tone === 'for' ? 'bg-gradient-to-r from-brand-600 to-violet-500' : 'bg-gradient-to-r from-rose-300 to-rose-500'}`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums text-ink-500">{weight > 0 ? '+' : ''}{weight}%</span>
    </div>
  )
}

/**
 * Explains a prediction using the trained Naive Bayes model itself:
 * each bar is a term's share of the log-likelihood evidence for the predicted class vs the runner-up.
 */
export default function Explainability({ explanation, text }) {
  if (!explanation?.category) return null
  const c = explanation.category, p = explanation.priority
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 p-3.5">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-violet-600" />
        <p className="text-ink-700">
          Predicted <b>{c.predicted}</b> over <b>{c.runner_up}</b> ({c.runner_up_confidence}% for the runner-up).
          Decision margin <b>{c.margin}</b> log-odds — the larger, the more decisive the model was.
        </p>
      </div>

      {text && <div><p className="label">Words that drove the decision</p><Highlighted text={text} cat={c} /></div>}

      <div>
        <p className="label">Evidence for {c.predicted}</p>
        <div className="space-y-1.5">{c.supporting_terms.length ? c.supporting_terms.map((t) => <Bar key={t.term} {...t} tone="for" />) : <p className="text-xs text-ink-500">No known words matched the model vocabulary.</p>}</div>
      </div>
      {c.opposing_terms.length > 0 && (
        <div>
          <p className="label">Pulled towards {c.runner_up}</p>
          <div className="space-y-1.5">{c.opposing_terms.map((t) => <Bar key={t.term} {...t} tone="against" />)}</div>
        </div>
      )}

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-ink-700">
        <b>Vocabulary coverage {c.vocabulary_coverage}%</b> — share of your words the model has seen in training.
        {c.vocabulary_coverage < 60 && <span className="text-amber-700"> Low coverage means less reliable confidence; consider adding more detail.</span>}
      </div>

      {p && (
        <div>
          <p className="label flex items-center gap-1"><ShieldAlert size={12} /> Why {p.final_priority} priority?</p>
          <p className="text-xs text-ink-700">
            The priority model chose <b>{p.model_priority}</b>
            {p.supporting_terms.length > 0 && <> mainly from <span className="font-semibold">{p.supporting_terms.slice(0, 3).map((t) => `“${t.term}”`).join(', ')}</span></>}.
            {p.urgent_keywords.length > 0 && <> Hazard keywords detected: {p.urgent_keywords.map((k) => <span key={k} className="badge ml-1 bg-rose-50 text-rose-700 ring-rose-200">{k}</span>)}</>}
            {p.final_priority !== p.model_priority && <> The safety net raised it to <b>High</b>.</>}
          </p>
        </div>
      )}
    </div>
  )
}
