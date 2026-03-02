import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token)
            fetchUser()
        } else {
            localStorage.removeItem('token')
            setUser(null)
            setLoading(false)
        }
    }, [token])

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/accounts/me', { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) {
                setUser(await res.json())
            } else {
                setToken(null)
            }
        } catch {
            setToken(null)
        } finally {
            setLoading(false)
        }
    }

    const requestLoginOtp = async (identifier) => {
        const res = await fetch('/api/accounts/login/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier })
        })
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Failed to request OTP')
        }
        return await res.json()
    }

    const login = async (identifier, code) => {
        const res = await fetch('/api/accounts/login/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, code })
        })
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Invalid OTP or credentials')
        }
        const data = await res.json()
        setToken(data.access_token)
    }

    const logout = () => setToken(null)

    return (
        <AuthContext.Provider value={{ user, token, loading, login, requestLoginOtp, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
