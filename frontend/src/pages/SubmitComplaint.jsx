import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, Loader2, MapPin, Send, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import AIResult from '../components/AIResult'
import { PageHeader } from '../components/ui'

const PLACES = ['Hostel Block A', 'Hostel Block B', 'Computer Lab', 'Main Library', 'Cafeteria', 'Engineering Block', 'Admin Building', 'Seminar Hall', 'Main Gate', 'Parking Area']

export default function SubmitComplaint() {
  const nav = useNavigate()
  const [f, setF] = useState({ title: '', description: '', location: '' })
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [ai, setAi] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const fileRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if ((f.title + f.description).trim().length < 20) { setAi(null); return }
    setAnalysing(true)
    const t = setTimeout(() => {
      api.post('/complaints/predict', { title: f.title, description: f.description })
        .then((r) => setAi(r.data)).catch(() => {}).finally(() => setAnalysing(false))
    }, 700)
    return () => clearTimeout(t)
  }, [f.title, f.description])

  const pick = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file')
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be smaller than 5 MB')
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const e = {}
    if (f.title.trim().length < 5) e.title = 'Title must be at least 5 characters'
    if (f.description.trim().length < 15) e.description = 'Please describe the problem in at least 15 characters'
    if (f.location.trim().length < 2) e.location = 'Location is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return toast.error('Please fix the highlighted fields')
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.append(k, v.trim()))
    if (image) fd.append('image', image)
    setBusy(true)
    try {
      const { data } = await api.post('/complaints', fd)
      toast.success(`Ticket ${data.ticket_id} created and routed to ${data.department || 'admin'}. Target resolution: ${data.sla_hours}h`, { duration: 5000 })
      if (data.escalated) toast(`Escalated automatically: ${data.escalation_reason}`, { icon: '🚨', duration: 6000 })
      if (data.duplicates?.length) toast(`Similar to ${data.duplicates[0].ticket_id} – linked as possible duplicate`, { icon: '🔁' })
      nav(`/app/complaints/${data.id}`, { state: { fresh: true } })
    } catch (err) { toast.error(errMsg(err)) } finally { setBusy(false) }
  }

  const Err = ({ k }) => (errors[k] ? <p className="mt-1 text-xs text-rose-600">{errors[k]}</p> : null)

  return (
    <>
      <PageHeader title="Submit a complaint" subtitle="Describe the issue — our AI will classify and route it automatically." />
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-5 p-6 lg:col-span-3" noValidate>
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={set('title')} placeholder="Short summary, e.g. Wi-Fi not working in Block A" maxLength={150} /><Err k="title" /></div>
          <div><label className="label">Description</label><textarea className="input h-36 resize-none" value={f.description} onChange={set('description')} placeholder="Explain what is wrong, since when, and who is affected…" maxLength={3000} /><div className="flex justify-between"><Err k="description" /><span className="ml-auto text-xs text-ink-500">{f.description.length}/3000</span></div></div>
          <div>
            <label className="label">Location</label>
            <div className="relative"><MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input list="places" className="input !pl-10" value={f.location} onChange={set('location')} placeholder="Where is the problem?" maxLength={120} /></div>
            <datalist id="places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist><Err k="location" />
          </div>
          <div>
            <label className="label">Photo (optional)</label>
            {preview ? (
              <div className="relative inline-block"><img src={preview} alt="preview" className="h-40 rounded-xl object-cover ring-1 ring-slate-200" />
                <button type="button" onClick={() => { setImage(null); setPreview(null); fileRef.current.value = '' }} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-rose-500 text-white shadow"><X size={14} /></button></div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
                className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-sm text-ink-500 transition hover:border-violet-300 hover:bg-violet-50/50">
                <ImagePlus className="mb-2 text-violet-500" /> Click or drag an image here<span className="text-xs">PNG, JPG, GIF, WEBP · max 5 MB</span></button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
          </div>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit complaint</button>
        </form>

        <aside className="lg:col-span-2">
          <div className="card sticky top-24 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold"><Sparkles size={18} className="text-violet-600" /> Live AI analysis {analysing && <Loader2 size={14} className="animate-spin text-brand-600" />}</h3>
            {ai ? <AIResult result={ai} text={`${f.title}. ${f.description}`} /> : <p className="py-10 text-center text-sm text-ink-500">Start typing your complaint and the model will predict its category, priority and sentiment — and warn you about duplicates.</p>}
          </div>
        </aside>
      </div>
    </>
  )
}
