import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Jobs() {
    const { user, token } = useAuth()
    const [jobs, setJobs] = useState([])
    const [search, setSearch] = useState('')
    const [locationFilter, setLocationFilter] = useState('')
    const [remoteOnly, setRemoteOnly] = useState(false)
    const [loading, setLoading] = useState(true)

    const fetchJobs = async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.set('q', search)
        if (locationFilter) params.set('location', locationFilter)
        if (remoteOnly) params.set('remote', 'true')
        try {
            const res = await fetch(`/api/jobs/postings?${params}`)
            if (res.ok) setJobs(await res.json())
        } catch { /* ignore */ }
        setLoading(false)
    }

    useEffect(() => { fetchJobs() }, [])

    const handleSearch = (e) => {
        e.preventDefault()
        fetchJobs()
    }

    const handleApply = async (jobId) => {
        if (!token) { alert('Please log in to apply'); return }
        try {
            const res = await fetch('/api/jobs/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ job_id: jobId, cover_note: '' })
            })
            if (res.ok) {
                alert('Application submitted!')
            } else {
                const data = await res.json()
                alert(data.detail || 'Failed to apply')
            }
        } catch {
            alert('Network error')
        }
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-heading">Find Jobs</h1>
                {user?.role === 'recruiter' && (
                    <Link to="/recruiter">
                        <Button variant="neutral" size="sm">My Postings</Button>
                    </Link>
                )}
            </div>

            {/* Search Bar */}
            <Card className="mb-8">
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
                        <Input
                            placeholder="Search by title, skills, company..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="flex-1"
                        />
                        <Input
                            placeholder="Location"
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="md:w-48"
                        />
                        <label className="flex items-center gap-2 text-sm font-base whitespace-nowrap">
                            <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} />
                            Remote only
                        </label>
                        <Button type="submit">Search</Button>
                    </form>
                </CardContent>
            </Card>

            {/* Results */}
            {loading ? (
                <p className="text-center font-heading animate-pulse py-12">Loading jobs...</p>
            ) : jobs.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <p className="font-heading text-lg">No jobs found</p>
                        <p className="text-sm text-foreground/60 mt-1">Try adjusting your search filters</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {jobs.map(job => (
                        <Card key={job.id}>
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <Link to={`/jobs/${job.id}`} className="text-xl font-heading hover:underline">
                                            {job.title}
                                        </Link>
                                        <p className="text-sm text-foreground/60 mt-1">
                                            {job.company_name} {job.location && `• ${job.location}`}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {job.is_remote && <Badge>Remote</Badge>}
                                            {job.salary_range && <Badge variant="neutral">{job.salary_range}</Badge>}
                                            {job.required_skills && job.required_skills.split(',').slice(0, 3).map(s =>
                                                <Badge key={s} variant="neutral">{s.trim()}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm mt-3 line-clamp-2">{job.description}</p>
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <Link to={`/jobs/${job.id}`}>
                                            <Button variant="neutral" size="sm" className="w-full">Details</Button>
                                        </Link>
                                        {user?.role === 'job_seeker' && (
                                            <Button size="sm" className="w-full" onClick={() => handleApply(job.id)}>
                                                Quick Apply
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/40 mt-3">
                                    Posted {new Date(job.created_at).toLocaleDateString()}
                                    {job.deadline && ` • Deadline: ${new Date(job.deadline).toLocaleDateString()}`}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
