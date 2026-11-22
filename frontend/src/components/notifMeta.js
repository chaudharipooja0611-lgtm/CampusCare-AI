import { AlertOctagon, Clock, Hourglass, Inbox, Info, RefreshCw, Star, Wand2 } from 'lucide-react'

export const NOTIF_META = {
  escalation: { icon: AlertOctagon, label: 'Escalation' },
  sla_overdue: { icon: Hourglass, label: 'SLA overdue' },
  sla_warning: { icon: Clock, label: 'SLA warning' },
  new_complaint: { icon: Inbox, label: 'New complaint' },
  status: { icon: RefreshCw, label: 'Status update' },
  rating: { icon: Star, label: 'Feedback' },
  correction: { icon: Wand2, label: 'Reviewed' },
  info: { icon: Info, label: 'Info' },
}
export const SEVERITY_STYLE = {
  critical: { ring: 'bg-rose-50 text-rose-600 ring-rose-200', bar: 'bg-rose-500', label: 'Critical' },
  warning: { ring: 'bg-amber-50 text-amber-600 ring-amber-200', bar: 'bg-amber-400', label: 'Warning' },
  info: { ring: 'bg-brand-50 text-brand-700 ring-brand-200', bar: 'bg-brand-300', label: 'Info' },
}
