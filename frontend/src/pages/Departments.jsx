import { useEffect, useState } from 'react'
import { Building2, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import { CategoryBadge, Modal, PageHeader, Spinner } from '../components/ui'
import { CATEGORIES } from '../constants'

export default function Departments() {
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/departments').then((r) => setList(r.data.departments))
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (edit.id) await api.put(`/departments/${edit.id}`, edit)
      else await api.post('/departments', edit)
      toast.success(edit.id ? 'Department updated' : 'Department created')
      setEdit(null); load()
    } catch (err) { toast.error(errMsg(err)) }
  }
  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return
    try { await api.delete(`/departments/${d.id}`); toast.success('Department deleted'); load() } catch (err) { toast.error(errMsg(err)) }
  }

  if (!list) return <Spinner />
  return (
    <>
      <PageHeader title="Departments" subtitle="Each AI category is routed to its department.">
        <button className="btn-primary" onClick={() => setEdit({ name: '', category: CATEGORIES[0], description: '', email: '' })}><Plus size={16} /> Add department</button>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((d) => (
          <div key={d.id} className="card card-hover p-5">
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Building2 size={20} /></span>
              <div className="flex gap-1"><button className="rounded-lg p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-600" onClick={() => setEdit(d)}><Pencil size={16} /></button>
                <button className="rounded-lg p-2 text-ink-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(d)}><Trash2 size={16} /></button></div>
            </div>
            <h3 className="mt-3 text-lg font-bold">{d.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-ink-500">{d.description || 'No description'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><CategoryBadge category={d.category} />{d.email && <span className="flex items-center gap-1 text-xs text-ink-500"><Mail size={12} />{d.email}</span>}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
              {[['Total', d.complaint_count], ['Open', d.open_count], ['Staff', d.staff_count]].map(([l, v]) => <div key={l}><p className="font-display text-xl font-extrabold">{v}</p><p className="text-xs text-ink-500">{l}</p></div>)}
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit department' : 'New department'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-4">
            <div><label className="label">Name</label><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="label">Routed AI category</label><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Description</label><input className="input" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div><label className="label">Contact email</label><input type="email" className="input" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <button className="btn-primary w-full">Save department</button>
          </form>
        </Modal>
      )}
    </>
  )
}
