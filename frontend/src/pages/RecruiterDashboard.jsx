import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const STATUS_OPTIONS = ['reviewed', 'interviewed', 'rejected', 'offer']

export default function RecruiterDashboard() {
    const { token } = useAuth()
    const [companies, setCompanies] = useState([])
    const [jobs, setJobs] = useState([])
    const [tab, setTab] = useState('jobs')
    const [status, setStatus] = useState(null)

    // Company form
    const [companyForm, setCompanyForm] = useState({ name: '', description: '', location: '', website: '' })
    // Job form
    const [jobForm, setJobForm] = useState({ title: '', description: '', required_skills: '', location: '', is_remote: false, salary_range: '', company_id: '' })
    // Application review
    const [selectedJobId, setSelectedJobId] = useState(null)
    const [applications, setApplications] = useState([])

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const fetchMyData = async () => {
        try {
            const [compRes, jobRes] = await Promise.all([
                fetch('/api/jobs/my-companies', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/jobs/my-postings', { headers: { Authorization: `Bearer ${token}` } }),
            ])
            if (compRes.ok) setCompanies(await compRes.json())
            if (jobRes.ok) setJobs(await jobRes.json())
        } catch {
            setStatus({ type: 'error', msg: 'Failed to load data.' })
        }
    }

    useEffect(() => { fetchMyData() }, [token])

    const createCompany = async (e) => {
        e.preventDefault()
        setStatus(null)
        try {
            const res = await fetch('/api/jobs/companies', { method: 'POST', headers, body: JSON.stringify(companyForm) })
            if (res.ok) {
                setStatus({ type: 'success', msg: 'Company created!' })
                setCompanyForm({ name: '', description: '', location: '', website: '' })
                fetchMyData()
            } else {
                const d = await res.json()
                setStatus({ type: 'error', msg: d.detail || 'Failed' })
            }
        } catch {
            setStatus({ type: 'error', msg: 'Network error.' })
        }
    }

    const createJob = async (e) => {
        e.preventDefault()
        setStatus(null)
        try {
            const payload = { ...jobForm, company_id: parseInt(jobForm.company_id) }
            const res = await fetch('/api/jobs/postings', { method: 'POST', headers, body: JSON.stringify(payload) })
            if (res.ok) {
                setStatus({ type: 'success', msg: 'Job posted!' })
                setJobForm({ title: '', description: '', required_skills: '', location: '', is_remote: false, salary_range: '', company_id: '' })
                fetchMyData()
            } else {
                const d = await res.json()
                setStatus({ type: 'error', msg: d.detail || 'Failed' })
            }
        } catch {
            setStatus({ type: 'error', msg: 'Network error.' })
        }
    }

    const viewApplications = async (jobId) => {
        setSelectedJobId(jobId)
        try {
            const res = await fetch(`/api/jobs/postings/${jobId}/applications`, { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) setApplications(await res.json())
        } catch {
            setStatus({ type: 'error', msg: 'Failed to load applications.' })
        }
    }

    const updateAppStatus = async (appId, newStatus) => {
        try {
            const res = await fetch(`/api/jobs/applications/${appId}/status`, {
                method: 'PUT', headers,
                body: JSON.stringify({ status: newStatus, reviewer_note: '' })
            })
            if (res.ok && selectedJobId) viewApplications(selectedJobId)
        } catch {
            setStatus({ type: 'error', msg: 'Failed to update status.' })
        }
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-2">Recruiter Dashboard</h1>
            <p className="text-foreground/60 mb-6">Manage companies, post jobs, and review applicants</p>

            {status && (
                <Alert variant={status.type === 'error' ? 'destructive' : 'default'} className="mb-4">
                    <AlertDescription>{status.msg}</AlertDescription>
                </Alert>
            )}

            {/* Tab Nav */}
            <div className="flex gap-2 mb-6">
                {['jobs', 'companies', 'applications'].map(t => (
                    <Button key={t} variant={tab === t ? 'default' : 'neutral'} size="sm" onClick={() => setTab(t)}>
                        {t[0].toUpperCase() + t.slice(1)}
                    </Button>
                ))}
            </div>

            {/* ── My Jobs ──────────────────── */}
            {tab === 'jobs' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Post a New Job</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createJob} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Title *</Label>
                                        <Input required value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Company *</Label>
                                        <select
                                            required
                                            value={jobForm.company_id}
                                            onChange={e => setJobForm({ ...jobForm, company_id: e.target.value })}
                                            className="flex h-10 w-full rounded-base border-2 border-border bg-background px-3 py-2 text-sm font-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                                        >
                                            <option value="">Select company...</option>
                                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description *</Label>
                                    <Textarea required rows={4} value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Required Skills</Label>
                                        <Input placeholder="Python, React, SQL" value={jobForm.required_skills} onChange={e => setJobForm({ ...jobForm, required_skills: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Salary Range</Label>
                                        <Input placeholder="e.g. $80k-$120k" value={jobForm.salary_range} onChange={e => setJobForm({ ...jobForm, salary_range: e.target.value })} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={jobForm.is_remote} onChange={e => setJobForm({ ...jobForm, is_remote: e.target.checked })} />
                                    Remote position
                                </label>
                                <Button type="submit">Post Job</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>My Job Postings ({jobs.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {jobs.length === 0 ? (
                                <p className="text-foreground/60 text-sm">No postings yet. Create a company first, then post jobs.</p>
                            ) : (
                                <div className="space-y-3">
                                    {jobs.map(j => (
                                        <div key={j.id} className="flex items-center justify-between border-b border-border/50 pb-3">
                                            <div>
                                                <span className="font-heading">{j.title}</span>
                                                <span className="text-foreground/60 text-sm ml-2">{j.company_name}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Badge variant={j.is_active ? 'default' : 'neutral'}>{j.is_active ? 'Active' : 'Closed'}</Badge>
                                                <Button size="sm" variant="neutral" onClick={() => { setTab('applications'); viewApplications(j.id) }}>
                                                    Applicants
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Companies ────────────────── */}
            {tab === 'companies' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Company</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createCompany} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Name *</Label>
                                        <Input required value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input value={companyForm.location} onChange={e => setCompanyForm({ ...companyForm, location: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Website</Label>
                                    <Input value={companyForm.website} onChange={e => setCompanyForm({ ...companyForm, website: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea value={companyForm.description} onChange={e => setCompanyForm({ ...companyForm, description: e.target.value })} />
                                </div>
                                <Button type="submit">Create Company</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>My Companies ({companies.length})</CardTitle></CardHeader>
                        <CardContent>
                            {companies.length === 0 ? (
                                <p className="text-foreground/60 text-sm">No companies yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {companies.map(c => (
                                        <div key={c.id} className="flex items-center justify-between border-b border-border/50 pb-3">
                                            <div>
                                                <span className="font-heading">{c.name}</span>
                                                <span className="text-foreground/60 text-sm ml-2">{c.location}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Applications Review ─────── */}
            {tab === 'applications' && (
                <div className="space-y-4">
                    {!selectedJobId ? (
                        <Card>
                            <CardHeader><CardTitle>Select a Job to Review</CardTitle></CardHeader>
                            <CardContent>
                                {jobs.length === 0 ? (
                                    <p className="text-foreground/60 text-sm">Post a job first to view applications.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {jobs.map(j => (
                                            <Button key={j.id} variant="neutral" className="w-full justify-start" onClick={() => viewApplications(j.id)}>
                                                {j.title} — {j.company_name}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <Button variant="neutral" size="sm" onClick={() => { setSelectedJobId(null); setApplications([]) }}>&larr; Back</Button>
                                <h2 className="font-heading text-xl">Applications ({applications.length})</h2>
                            </div>
                            {applications.length === 0 ? (
                                <Card className="text-center py-8"><CardContent><p className="text-foreground/60">No applications yet</p></CardContent></Card>
                            ) : (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b-2 border-border">
                                                        <th className="text-left font-heading py-3 px-3">Applicant</th>
                                                        <th className="text-left font-heading py-3 px-3">Cover Note</th>
                                                        <th className="text-center font-heading py-3 px-3">Status</th>
                                                        <th className="text-left font-heading py-3 px-3">Applied</th>
                                                        <th className="text-center font-heading py-3 px-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {applications.map(app => (
                                                        <tr key={app.id} className="border-b border-border/50 hover:bg-secondary-background transition-colors">
                                                            <td className="py-3 px-3 font-heading">{app.applicant_name}</td>
                                                            <td className="py-3 px-3 max-w-[200px] truncate">{app.cover_note || '—'}</td>
                                                            <td className="py-3 px-3 text-center"><Badge>{app.status}</Badge></td>
                                                            <td className="py-3 px-3 text-foreground/60">{new Date(app.created_at).toLocaleDateString()}</td>
                                                            <td className="py-3 px-3 text-center">
                                                                <div className="flex gap-1 justify-center flex-wrap">
                                                                    {STATUS_OPTIONS.map(s => (
                                                                        <Button
                                                                            key={s}
                                                                            size="sm"
                                                                            variant={app.status === s ? 'default' : 'neutral'}
                                                                            onClick={() => updateAppStatus(app.id, s)}
                                                                            className="text-xs"
                                                                        >
                                                                            {s[0].toUpperCase() + s.slice(1)}
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
