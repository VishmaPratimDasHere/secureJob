import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function JobDetail() {
    const { id } = useParams()
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const [job, setJob] = useState(null)
    const [coverNote, setCoverNote] = useState('')
    const [status, setStatus] = useState(null)
    const [applying, setApplying] = useState(false)

    useEffect(() => {
        fetch(`/api/jobs/postings/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(setJob)
            .catch(() => navigate('/jobs'))
    }, [id])

    const handleApply = async (e) => {
        e.preventDefault()
        if (!token) { navigate('/login'); return }
        setApplying(true)
        setStatus(null)
        try {
            const res = await fetch('/api/jobs/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ job_id: parseInt(id), cover_note: coverNote })
            })
            if (res.ok) {
                setStatus({ type: 'success', msg: 'Application submitted successfully!' })
                setCoverNote('')
            } else {
                const data = await res.json()
                setStatus({ type: 'error', msg: data.detail || 'Failed to apply' })
            }
        } catch {
            setStatus({ type: 'error', msg: 'Network error' })
        }
        setApplying(false)
    }

    if (!job) return <div className="max-w-5xl mx-auto px-4 py-8 text-center font-heading animate-pulse">Loading...</div>

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <Link to="/jobs" className="text-sm font-heading hover:underline mb-4 inline-block">&larr; Back to Jobs</Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {job.is_remote && <Badge>Remote</Badge>}
                                {job.salary_range && <Badge variant="neutral">{job.salary_range}</Badge>}
                            </div>
                            <CardTitle className="text-2xl">{job.title}</CardTitle>
                            <CardDescription>
                                {job.company_name} {job.location && `• ${job.location}`}
                                {' '}• Posted {new Date(job.created_at).toLocaleDateString()}
                                {job.deadline && ` • Deadline: ${new Date(job.deadline).toLocaleDateString()}`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="prose max-w-none">
                                <h3 className="font-heading text-base mb-2">Description</h3>
                                <p className="whitespace-pre-wrap text-sm">{job.description}</p>
                            </div>
                            {job.required_skills && (
                                <div className="mt-6">
                                    <h3 className="font-heading text-base mb-2">Required Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {job.required_skills.split(',').map(s =>
                                            <Badge key={s} variant="neutral">{s.trim()}</Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Apply Sidebar */}
                <div>
                    {user?.role === 'job_seeker' ? (
                        <Card className="bg-main">
                            <CardHeader>
                                <CardTitle>Apply Now</CardTitle>
                                <CardDescription>Submit your application</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {status && (
                                    <Alert variant={status.type === 'error' ? 'destructive' : 'default'} className="mb-4">
                                        <AlertDescription>{status.msg}</AlertDescription>
                                    </Alert>
                                )}
                                <form onSubmit={handleApply} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Cover Note (optional)</Label>
                                        <Textarea
                                            placeholder="Why are you a good fit?"
                                            value={coverNote}
                                            onChange={e => setCoverNote(e.target.value)}
                                            rows={5}
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={applying}>
                                        {applying ? 'Submitting...' : 'Submit Application'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ) : !user ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="font-heading mb-3">Want to apply?</p>
                                <Link to="/login"><Button className="w-full">Sign In</Button></Link>
                            </CardContent>
                        </Card>
                    ) : null}

                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle className="text-base">Company</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Link to={`/companies/${job.company_id}`} className="font-heading hover:underline">
                                {job.company_name}
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
