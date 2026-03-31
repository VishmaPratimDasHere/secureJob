import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
    const { token } = useAuth()
    const [stats, setStats] = useState(null)
    const [users, setUsers] = useState([])
    const [logs, setLogs] = useState([])
    const [tab, setTab] = useState('overview')
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, usersRes, logsRes] = await Promise.all([
                    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/admin/logs?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
                ])
                if (!statsRes.ok) throw new Error('Access denied. Admin role required.')
                setStats(await statsRes.json())
                if (usersRes.ok) setUsers(await usersRes.json())
                if (logsRes.ok) setLogs(await logsRes.json())
            } catch (err) {
                setError(err.message)
            }
        }
        fetchData()
    }, [token])

    if (error) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8 flex justify-center">
                <Card className="w-64 text-center"><CardContent className="py-8 font-heading text-lg animate-pulse">Loading...</CardContent></Card>
            </div>
        )
    }

    const formatRole = (role) => role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-3xl font-heading">Admin Dashboard</h1>
                <Badge>Admin</Badge>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {['overview', 'users', 'logs'].map(t => (
                    <Button key={t} variant={tab === t ? 'default' : 'neutral'} size="sm" onClick={() => setTab(t)}>
                        {t[0].toUpperCase() + t.slice(1)}
                    </Button>
                ))}
            </div>

            {/* ── Overview ── */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-main">
                        <CardHeader>
                            <CardTitle className="text-xl">Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-background rounded-base border-2 border-border p-4 text-center shadow-shadow">
                                    <span className="block text-4xl font-heading">{stats.users.total}</span>
                                    <span className="text-sm font-base">Total</span>
                                </div>
                                <div className="bg-background rounded-base border-2 border-border p-4 text-center shadow-shadow">
                                    <span className="block text-4xl font-heading">{stats.users.active}</span>
                                    <span className="text-sm font-base">Active</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Job Postings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-background rounded-base border-2 border-border p-4 text-center shadow-shadow">
                                    <span className="block text-4xl font-heading">{stats.jobs.total}</span>
                                    <span className="text-sm font-base">Total</span>
                                </div>
                                <div className="bg-background rounded-base border-2 border-border p-4 text-center shadow-shadow">
                                    <span className="block text-4xl font-heading">{stats.jobs.active}</span>
                                    <span className="text-sm font-base">Active</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Applications</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-background rounded-base border-2 border-border p-4 text-center shadow-shadow">
                                <span className="block text-4xl font-heading">{stats.applications.total}</span>
                                <span className="text-sm font-base">Total</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Users ── */}
            {tab === 'users' && (
                <Card>
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>{users.length} registered users</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b-2 border-border">
                                        <th className="text-left font-heading py-3 px-3">User</th>
                                        <th className="text-left font-heading py-3 px-3">Email</th>
                                        <th className="text-left font-heading py-3 px-3">Role</th>
                                        <th className="text-center font-heading py-3 px-3">Email ✓</th>
                                        <th className="text-center font-heading py-3 px-3">Phone ✓</th>
                                        <th className="text-left font-heading py-3 px-3">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id} className="border-b border-border/50 hover:bg-secondary-background transition-colors">
                                            <td className="py-3 px-3 font-heading">{u.username}</td>
                                            <td className="py-3 px-3">{u.email}</td>
                                            <td className="py-3 px-3">
                                                <Badge variant={u.role === 'admin' ? 'default' : 'neutral'}>{formatRole(u.role)}</Badge>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <Badge variant={u.is_email_verified ? 'default' : 'neutral'}>
                                                    {u.is_email_verified ? '✓' : '✗'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <Badge variant={u.is_phone_verified ? 'default' : 'neutral'}>
                                                    {u.is_phone_verified ? '✓' : '✗'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-3 text-foreground/60">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Audit Logs ── */}
            {tab === 'logs' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Audit Logs</CardTitle>
                        <CardDescription>Recent platform activity (last 100 events)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {logs.length === 0 ? (
                            <p className="text-foreground/60 text-sm">No logs recorded yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-border">
                                            <th className="text-left font-heading py-3 px-3">Time</th>
                                            <th className="text-left font-heading py-3 px-3">User</th>
                                            <th className="text-left font-heading py-3 px-3">Action</th>
                                            <th className="text-left font-heading py-3 px-3">Target</th>
                                            <th className="text-left font-heading py-3 px-3">Detail</th>
                                            <th className="text-left font-heading py-3 px-3">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id} className="border-b border-border/50 hover:bg-secondary-background transition-colors">
                                                <td className="py-3 px-3 text-foreground/60 whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-3 font-heading">{log.username}</td>
                                                <td className="py-3 px-3">
                                                    <Badge variant="neutral">{log.action}</Badge>
                                                </td>
                                                <td className="py-3 px-3 text-foreground/60">
                                                    {log.target_type}{log.target_id ? ` #${log.target_id}` : ''}
                                                </td>
                                                <td className="py-3 px-3 max-w-[200px] truncate">{log.detail || '—'}</td>
                                                <td className="py-3 px-3 text-foreground/60">{log.ip_address || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
