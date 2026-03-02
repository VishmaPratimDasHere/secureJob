import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
    const { token } = useAuth()
    const [stats, setStats] = useState(null)
    const [users, setUsers] = useState([])
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, usersRes] = await Promise.all([
                    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
                ])
                if (!statsRes.ok) throw new Error('Access denied. Admin role required.')
                setStats(await statsRes.json())
                if (usersRes.ok) setUsers(await usersRes.json())
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
            <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-heading">Admin Dashboard</h1>
                <Badge>Admin</Badge>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <Card className="bg-main">
                    <CardHeader>
                        <CardTitle className="text-xl">Users</CardTitle>
                        <CardDescription>Platform user statistics</CardDescription>
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
                        <CardDescription>Platform job statistics</CardDescription>
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
            </div>

            {/* Users Table */}
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
        </div>
    )
}
