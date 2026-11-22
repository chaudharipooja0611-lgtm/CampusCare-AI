import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertOctagon, Clock } from 'lucide-react'
import api from '../api'

const Ctx = createContext({ unread: 0, alertsUnread: 0, criticalUnread: 0, refresh: () => {} })
export const useNotifications = () => useContext(Ctx)

export function NotificationProvider({ children }) {
  const [counts, setCounts] = useState({ unread: 0, alertsUnread: 0, criticalUnread: 0 })
  const [latest, setLatest] = useState([])
  const lastId = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } })
      setCounts({ unread: data.unread, alertsUnread: data.alerts_unread, criticalUnread: data.critical_unread })
      setLatest(data.notifications)
      const maxId = Math.max(0, ...data.notifications.map((n) => n.id))
      if (lastId.current !== null) {
        // pop a toast for alerts that arrived since the last poll
        data.notifications.filter((n) => n.id > lastId.current && !n.is_read && n.severity !== 'info').slice(0, 2).forEach((n) =>
          toast(n.message, { icon: n.severity === 'critical' ? <AlertOctagon size={18} className="text-rose-600" /> : <Clock size={18} className="text-amber-600" />, duration: 6000 }))
      }
      lastId.current = Math.max(lastId.current ?? 0, maxId)
    } catch { /* silent: polling must never disturb the UI */ }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 20000)
    return () => clearInterval(t)
  }, [refresh])

  return <Ctx.Provider value={{ ...counts, latest, refresh }}>{children}</Ctx.Provider>
}
