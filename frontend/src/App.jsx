import { Component } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Landing from './pages/Landing'
import { Login, Register } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import SubmitComplaint from './pages/SubmitComplaint'
import Complaints from './pages/Complaints'
import ComplaintDetail from './pages/ComplaintDetail'
import Track from './pages/Track'
import Departments from './pages/Departments'
import Users from './pages/Users'
import Analytics from './pages/Analytics'
import Notifications from './pages/Notifications'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div className="card max-w-md p-8">
          <p className="font-display text-xl font-extrabold">Something went wrong</p>
          <p className="mt-2 text-sm text-ink-500">This page hit an unexpected error. Your data is safe.</p>
          <button className="btn-primary mt-5" onClick={() => { this.setState({ error: null }); window.location.reload() }}>Reload page</button>
        </div>
      </div>
    )
  }
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />
  return children
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Navigate to="/app" replace /> : children
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-950 to-brand-800 p-6 text-center text-white">
      <div><p className="gradient-text-light font-display text-8xl font-extrabold">404</p><p className="mt-2 text-lg text-brand-200">We couldn't find that page.</p>
        <Link to="/" className="btn mt-6 bg-white text-brand-800 hover:bg-brand-50">Back to home</Link></div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/track/:ticket?" element={<Track standalone />} />
        <Route path="/app" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<SubmitComplaint />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="track/:ticket?" element={<Track />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="analytics" element={<Protected roles={['admin', 'department']}><Analytics /></Protected>} />
          <Route path="departments" element={<Protected roles={['admin']}><Departments /></Protected>} />
          <Route path="users" element={<Protected roles={['admin']}><Users /></Protected>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  )
}
