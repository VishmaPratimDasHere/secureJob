import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export default function CompanyDetail() {
    const { id } = useParams()
    const { user, token } = useAuth()
    const [company, setCompany] = useState(null)
    const [jobs, setJobs] = useState([])

    useEffect(() => {
        fetch(`/api/jobs/companies/${id}`).then(r => r.ok ? r.json() : null).then(setCompany)
        fetch(`/api/jobs/companies/${id}/jobs`).then(r => r.ok ? r.json() : []).then(setJobs)
    }, [id])

    if (!company) return <div className="max-w-5xl mx-auto px-4 py-12 text-center font-heading animate-pulse">Loading...</div>

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <Link to="/companies" className="text-sm font-heading hover:underline mb-4 inline-block">&larr; All Companies</Link>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-2xl">{company.name}</CardTitle>
                    <CardDescription>
                        {company.location && `${company.location} • `}
                        {company.website && (() => {
                            const url = company.website.startsWith('http') ? company.website : `https://${company.website}`
                            return <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{company.website}</a>
                        })()}
                    </CardDescription>
                </CardHeader>
                {company.description && (
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{company.description}</p>
                    </CardContent>
                )}
            </Card>

            <h2 className="text-xl font-heading mb-4">Open Positions ({jobs.length})</h2>

            {jobs.length === 0 ? (
                <Card className="text-center py-8">
                    <CardContent><p className="text-foreground/60">No open positions</p></CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {jobs.map(job => (
                        <Card key={job.id}>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <Link to={`/jobs/${job.id}`} className="font-heading text-lg hover:underline">{job.title}</Link>
                                        <p className="text-sm text-foreground/60 mt-1">
                                            {job.location}{job.is_remote && ' • Remote'}
                                            {job.salary_range && ` • ${job.salary_range}`}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {job.required_skills && job.required_skills.split(',').slice(0, 4).map(s =>
                                                <Badge key={s} variant="neutral" className="text-xs">{s.trim()}</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Link to={`/jobs/${job.id}`}>
                                        <Button size="sm">View & Apply</Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
