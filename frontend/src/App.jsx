import { useState, useEffect } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState({
    main: { status: 'loading', label: 'API Server' },
    accounts: { status: 'loading', label: 'Accounts Service' },
    jobs: { status: 'loading', label: 'Jobs Service' },
    messaging: { status: 'loading', label: 'Messaging Service' },
  })

  useEffect(() => {
    const checkHealth = async (key, url) => {
      try {
        const res = await fetch(url)
        const data = await res.json()
        setApiStatus(prev => ({
          ...prev,
          [key]: { ...prev[key], status: data.status === 'healthy' || data.status === 'running' ? 'healthy' : 'error' }
        }))
      } catch {
        setApiStatus(prev => ({
          ...prev,
          [key]: { ...prev[key], status: 'error' }
        }))
      }
    }

    checkHealth('main', '/health')
    checkHealth('accounts', '/api/accounts/health')
    checkHealth('jobs', '/api/jobs/health')
    checkHealth('messaging', '/api/messages/health')
  }, [])

  return (
    <div className="app">
      {/* Navigation */}
      <header className="navbar">
        <h1>SecureJob</h1>
        <nav>
          <a href="#">Home</a>
          <a href="#">Jobs</a>
          <a href="#">Companies</a>
          <a href="#">Messages</a>
          <a href="#">Login</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero">
        <h2>Secure Job Search & Professional Networking</h2>
        <p>
          End-to-end encrypted platform for professional interactions,
          private messaging, resume sharing, and job applications.
        </p>
      </section>

      {/* Feature Cards */}
      <section className="features">
        <div className="feature-card">
          <h3>Secure Profiles</h3>
          <p>Create and manage your professional profile with field-level privacy controls (Public, Connections-only, Private).</p>
        </div>
        <div className="feature-card">
          <h3>Job Search & Apply</h3>
          <p>Search jobs by keywords, skills, and location. Track application status from Applied to Offer.</p>
        </div>
        <div className="feature-card">
          <h3>Encrypted Messaging</h3>
          <p>End-to-end encrypted conversations between recruiters and candidates. Server stores only ciphertext.</p>
        </div>
        <div className="feature-card">
          <h3>Secure Resume Storage</h3>
          <p>Upload resumes encrypted at rest. Strict access control ensures only authorized users can view.</p>
        </div>
        <div className="feature-card">
          <h3>PKI & OTP Security</h3>
          <p>HTTPS/TLS for all traffic, OTP verification with virtual keyboard for high-risk actions.</p>
        </div>
        <div className="feature-card">
          <h3>Tamper-Evident Audit</h3>
          <p>All critical actions logged with hash-chained audit trail for complete accountability.</p>
        </div>
      </section>

      {/* API Status */}
      <section className="api-status">
        <h3>System Status</h3>
        <div className="status-grid">
          {Object.entries(apiStatus).map(([key, { status, label }]) => (
            <div className="status-item" key={key}>
              <div className={`status-dot ${status}`} />
              <div>
                <div className="status-label">{label}</div>
                <div className="status-value">{status === 'healthy' ? 'Operational' : status === 'loading' ? 'Checking...' : 'Offline'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security Banner */}
      <section className="security-banner">
        <h3>Security-First Architecture</h3>
        <p>
          HTTPS (TLS 1.2/1.3) &bull; Argon2 Password Hashing &bull; JWT Authentication &bull;
          RBAC (Job Seeker / Recruiter / Admin) &bull; CSRF/XSS/SQLi Protection &bull;
          End-to-End Encryption &bull; Hash-Chained Audit Logs
        </p>
      </section>

      {/* Tech Stack */}
      <section className="tech-stack">
        <h3>Technology Stack</h3>
        <div className="tech-list">
          <span className="tech-badge">FastAPI (Python)</span>
          <span className="tech-badge">React 18</span>
          <span className="tech-badge">PostgreSQL</span>
          <span className="tech-badge">Nginx</span>
          <span className="tech-badge">SQLAlchemy</span>
          <span className="tech-badge">Vite</span>
          <span className="tech-badge">OpenSSL (TLS)</span>
          <span className="tech-badge">Argon2</span>
          <span className="tech-badge">JWT (jose)</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        SecureJob Platform &copy; 2026 | CSE 345/545 Foundations of Computer Security
      </footer>
    </div>
  )
}

export default App
