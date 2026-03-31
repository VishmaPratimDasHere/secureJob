import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Profile from '@/pages/Profile'
import AdminDashboard from '@/pages/AdminDashboard'
import Landing from '@/pages/Landing'
import OTPVerification from '@/pages/OTPVerification'
import Jobs from '@/pages/Jobs'
import JobDetail from '@/pages/JobDetail'
import Companies from '@/pages/Companies'
import CompanyDetail from '@/pages/CompanyDetail'
import MyApplications from '@/pages/MyApplications'
import RecruiterDashboard from '@/pages/RecruiterDashboard'
import Messages from '@/pages/Messages'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="border-b-2 border-border bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl tracking-tight" style={{ fontFamily: '"Pacifico", cursive', color: 'hsl(205, 100%, 72%)', textShadow: '2px 2px 0px #000' }}>
            SecureAJob
          </Link>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/jobs">
              <Button variant="neutral" size="sm">Jobs</Button>
            </Link>
            <Link to="/companies">
              <Button variant="neutral" size="sm">Companies</Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm font-heading hidden sm:inline">{user.username}</span>
              {user.role === 'job_seeker' && (
                <Link to="/applications">
                  <Button variant="neutral" size="sm">Applications</Button>
                </Link>
              )}
              {user.role === 'recruiter' && (
                <Link to="/recruiter">
                  <Button variant="neutral" size="sm">Dashboard</Button>
                </Link>
              )}
              <Link to="/messages">
                <Button variant="neutral" size="sm">Messages</Button>
              </Link>
              <Link to="/profile">
                <Button variant="neutral" size="sm">Profile</Button>
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="neutral" size="sm">Admin</Button>
                </Link>
              )}
              <Button variant="default" size="sm" onClick={logout}>Logout</Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="neutral" size="sm">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-secondary-background">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/verify" element={<ProtectedRoute><OTPVerification /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><MyApplications /></ProtectedRoute>} />
              <Route path="/recruiter" element={<ProtectedRoute requiredRole="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            </Routes>
          </main>
          <footer className="border-t-2 border-border bg-background py-6 text-center text-sm font-base mt-12">
            © 2026 SecureAJob. All rights reserved.
          </footer>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
