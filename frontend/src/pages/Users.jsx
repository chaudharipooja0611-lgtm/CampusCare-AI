import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'
import { Modal, PageHeader, Spinner } from '../components/ui'
import { fmtDate } from '../constants'
import { useAuth } from '../context/AuthContext'

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [depts, setDepts] = useState([])
  const [form, setForm] = useState(null)
  const load = () => api.get('/users').then((r) => setUsers(r.data.users))
  useEffect(() => { load(); api.get('/departments').then((r) => setDepts(r.data.departments)) }, [])

  const patch = async (u, changes) => {
    try { await api.patch(`/users/${u.id}`, changes); toast.success('User updated'); load() } catch (e) { toast.error(errMsg(e)) }
  }
  const create = async (e) => {
    e.preventDefault()
    try { await api.post('/users', form); toast.success('User created'); setForm(null); load() } catch (err) { toast.error(errMsg(err)) }
  }

  if (!users) return <Spinner />
  return (
    <>
      <PageHeader title="Users" subtitle="Manage roles and department staff.">
        <button className="btn-primary" onClick={() => setForm({ name: '', email: '', password: '', role: 'department', department_id: depts[0]?.id || '' })}><Plus size={16} /> Add user</button>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-ink-500">{['User', 'Role', 'Department', 'Joined'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} className="border-b border-slate-50">
              <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white">{u.name[0]}</span><div><p className="font-semibold">{u.name}</p><p className="text-xs text-ink-500">{u.email}</p></div></div></td>
              <td className="px-4 py-3"><select className="input !w-auto !py-1.5" value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value, department_id: e.target.value === 'department' ? depts[0]?.id : null })}>{['student', 'department', 'admin'].map((r) => <option key={r}>{r}</option>)}</select></td>
              <td className="px-4 py-3">{u.role === 'department' ? <select className="input !w-auto !py-1.5" value={u.department_id || ''} onChange={(e) => patch(u, { department_id: Number(e.target.value) })}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select> : <span className="text-ink-500">—</span>}</td>
              <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(u.created_at)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      {form && (
        <Modal title="Add user" onClose={() => setForm(null)}>
          <form onSubmit={create} className="space-y-4">
            <div><label className="label">Full name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Password</label><input type="password" className="input" required minLength={8} placeholder="8+ chars, letter and number" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Role</label><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{['student', 'department', 'admin'].map((r) => <option key={r}>{r}</option>)}</select></div>
              {form.role === 'department' && <div><label className="label">Department</label><select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
            </div>
            <button className="btn-primary w-full">Create user</button>
          </form>
        </Modal>
      )}
    </>
  )
}
