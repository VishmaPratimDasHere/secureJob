import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const statusColors = {
    applied: 'neutral',
    reviewed: 'default',
    interviewed: 'default',
    rejected: 'neutral',
    offer: 'default',
}

const statusLabels = {
    applied: 'Applied',
    reviewed: 'Reviewed',
    interviewed: 'Interviewed',
    rejected: 'Rejected',
    offer: 'Offer',
}

export default function MyApplications() {
    const { token } = useAuth()
    const [apps, setApps] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        fetch('/api/jobs/applications/mine', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : [])
            .then(setApps)
            .finally(() => setLoading(false))
    }, [token])

    if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center font-heading animate-pulse">Loading applications...</div>

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-2">My Applications</h1>
            <p className="text-foreground/60 mb-8">Track the status of all your job applications</p>

            {apps.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <p className="font-heading text-lg mb-2">No applications yet</p>
                        <p className="text-sm text-foreground/60">
                            <Link to="/jobs" className="underline">Browse jobs</Link> and start applying!
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        {Object.entries(statusLabels).map(([key, label]) => {
                            const count = apps.filter(a => a.status === key).length
                            return (
                                <Card key={key} className="text-center">
                                    <CardContent className="py-4">
                                        <span className="block text-2xl font-heading">{count}</span>
                                        <span className="text-xs">{label}</span>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    {/* Application List */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-border">
                                            <th className="text-left font-heading py-3 px-3">Job</th>
                                            <th className="text-left font-heading py-3 px-3">Company</th>
                                            <th className="text-center font-heading py-3 px-3">Status</th>
                                            <th className="text-left font-heading py-3 px-3">Applied</th>
                                            <th className="text-left font-heading py-3 px-3">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apps.map(app => (
                                            <tr key={app.id} className="border-b border-border/50 hover:bg-secondary-background transition-colors">
                                                <td className="py-3 px-3">
                                                    <Link to={`/jobs/${app.job_id}`} className="font-heading hover:underline">
                                                        {app.job_title || `Job #${app.job_id}`}
                                                    </Link>
                                                </td>
                                                <td className="py-3 px-3">{app.company_name}</td>
                                                <td className="py-3 px-3 text-center">
                                                    <Badge variant={statusColors[app.status] || 'neutral'}>
                                                        {statusLabels[app.status] || app.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-3 text-foreground/60">
                                                    {new Date(app.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-3 text-foreground/60 max-w-[200px] truncate">
                                                    {app.reviewer_note || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
