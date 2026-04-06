import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Connections() {
    const { token } = useAuth()
    const [tab, setTab] = useState('connections')
    const [connections, setConnections] = useState([])
    const [pending, setPending] = useState([])
    const [searchQ, setSearchQ] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    const headers = { Authorization: `Bearer ${token}` }
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

    const fetchConnections = async () => {
        try {
            const [connRes, pendRes] = await Promise.all([
                fetch('/api/accounts/connections', { headers }),
                fetch('/api/accounts/connections/pending', { headers }),
            ])
            if (connRes.ok) setConnections(await connRes.json())
            if (pendRes.ok) setPending(await pendRes.json())
        } catch { /* ignore */ }
        setLoading(false)
    }

    useEffect(() => { fetchConnections() }, [token])

    const searchUsers = async (e) => {
        e.preventDefault()
        if (!searchQ.trim()) return
        setSearching(true)
        setError('')
        try {
            const res = await fetch(`/api/messages/users?q=${encodeURIComponent(searchQ)}`, { headers })
            if (res.ok) setSearchResults(await res.json())
        } catch { setError('Search failed') }
        setSearching(false)
    }

    const sendRequest = async (userId) => {
        setError(''); setMessage('')
        try {
            const res = await fetch(`/api/accounts/connections/request/${userId}`, {
                method: 'POST', headers
            })
            if (res.ok) {
                setMessage('Connection request sent.')
                setSearchResults(sr => sr.filter(u => u.id !== userId))
            } else {
                const d = await res.json()
                setError(d.detail || 'Failed to send request')
            }
        } catch { setError('Network error') }
    }

    const acceptRequest = async (connId) => {
        try {
            const res = await fetch(`/api/accounts/connections/${connId}/accept`, {
                method: 'PUT', headers
            })
            if (res.ok) {
                setMessage('Connection accepted.')
                await fetchConnections()
            }
        } catch { /* ignore */ }
    }

    const removeConnection = async (connId) => {
        try {
            const res = await fetch(`/api/accounts/connections/${connId}`, {
                method: 'DELETE', headers
            })
            if (res.ok) {
                setMessage('Connection removed.')
                await fetchConnections()
            }
        } catch { /* ignore */ }
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-6">Connections</h1>

            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {message && !error && (
                <Alert className="mb-4 border-green-400 bg-green-50 text-green-800">
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {[
                    { key: 'connections', label: `My Network (${connections.length})` },
                    { key: 'pending', label: `Pending (${pending.length})` },
                    { key: 'search', label: 'Find People' },
                ].map(t => (
                    <Button key={t.key} variant={tab === t.key ? 'default' : 'neutral'} size="sm" onClick={() => setTab(t.key)}>
                        {t.label}
                    </Button>
                ))}
            </div>

            {/* ── My Connections ── */}
            {tab === 'connections' && (
                <Card>
                    <CardHeader>
                        <CardTitle>My Network</CardTitle>
                        <CardDescription>{connections.length} connection{connections.length !== 1 ? 's' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-foreground/60 text-sm animate-pulse">Loading...</p>
                        ) : connections.length === 0 ? (
                            <p className="text-foreground/60 text-sm">No connections yet. Use "Find People" to connect.</p>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {connections.map(c => {
                                    const other = c.requester_id !== c.addressee_id
                                        ? (c.requester_username === c.current_user_username ? { id: c.addressee_id, username: c.addressee_username, name: c.addressee_name } : { id: c.requester_id, username: c.requester_username, name: c.requester_name })
                                        : { id: c.addressee_id, username: c.addressee_username, name: c.addressee_name }
                                    return (
                                        <div key={c.id} className="flex items-center justify-between py-3">
                                            <div>
                                                <Link to={`/profile/${c.other_user_id}`} className="font-heading hover:underline">
                                                    {c.other_user_name || c.other_user_username}
                                                </Link>
                                                <p className="text-xs text-foreground/50">@{c.other_user_username}</p>
                                            </div>
                                            <Button
                                                variant="neutral"
                                                size="sm"
                                                onClick={() => removeConnection(c.id)}
                                                className="text-xs"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Pending Requests ── */}
            {tab === 'pending' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Requests</CardTitle>
                        <CardDescription>Incoming connection requests awaiting your response</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pending.length === 0 ? (
                            <p className="text-foreground/60 text-sm">No pending requests.</p>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {pending.map(c => (
                                    <div key={c.id} className="flex items-center justify-between py-3">
                                        <div>
                                            <Link to={`/profile/${c.requester_id}`} className="font-heading hover:underline">
                                                {c.requester_name || c.requester_username}
                                            </Link>
                                            <p className="text-xs text-foreground/50">@{c.requester_username}</p>
                                            <p className="text-xs text-foreground/40 mt-0.5">
                                                {new Date(c.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => acceptRequest(c.id)}>Accept</Button>
                                            <Button size="sm" variant="neutral" onClick={() => removeConnection(c.id)}>Decline</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Find People ── */}
            {tab === 'search' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Find People</CardTitle>
                        <CardDescription>Search by name or username to connect</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={searchUsers} className="flex gap-2 mb-4">
                            <Input
                                placeholder="Search by name or username..."
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                                className="flex-1"
                            />
                            <Button type="submit" disabled={searching}>
                                {searching ? 'Searching...' : 'Search'}
                            </Button>
                        </form>
                        {searchResults.length > 0 && (
                            <div className="divide-y divide-border/50">
                                {searchResults.map(u => (
                                    <div key={u.id} className="flex items-center justify-between py-3">
                                        <div>
                                            <Link to={`/profile/${u.id}`} className="font-heading hover:underline">
                                                {u.full_name || u.username}
                                            </Link>
                                            <p className="text-xs text-foreground/50">@{u.username}</p>
                                            {u.role && <Badge variant="neutral" className="text-xs mt-1">{u.role.replace('_', ' ')}</Badge>}
                                        </div>
                                        <Button size="sm" onClick={() => sendRequest(u.id)}>Connect</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {searchResults.length === 0 && searchQ && !searching && (
                            <p className="text-foreground/60 text-sm">No results for "{searchQ}"</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
