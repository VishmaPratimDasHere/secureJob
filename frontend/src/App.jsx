import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Profile from '@/pages/Profile'
import AdminDashboard from '@/pages/AdminDashboard'
import Landing from '@/pages/Landing'
import OTPVerification from '@/pages/OTPVerification'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="border-b-2 border-border bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl tracking-tight" style={{ fontFamily: '"Pacifico", cursive', color: 'hsl(205, 100%, 72%)', textShadow: '2px 2px 0px #000' }}>
          SecureAJob
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm font-heading">{user.username}</span>
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
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/verify" element={<ProtectedRoute><OTPVerification /></ProtectedRoute>} />
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
