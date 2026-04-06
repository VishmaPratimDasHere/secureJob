import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import VirtualKeyboard from '@/components/VirtualKeyboard'

const api = (path, opts, token) => fetch(path, {
    ...opts,
    headers: { ...(opts?.headers || {}), Authorization: `Bearer ${token}`, ...(opts?.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }
})

const PRIVACY_LEVELS = ['public', 'connections', 'private']

export default function Profile() {
    const { user, token } = useAuth()

    // ─── Profile form ─────────────────────────────────────────────
    const [form, setForm] = useState({
        full_name: user?.full_name || '', headline: user?.headline || '',
        location: user?.location || '', bio: user?.bio || '',
        phone: user?.phone || '', skills: (user?.skills || []).join(', '),
        profile_views_opt_out: user?.profile_views_opt_out || false,
    })
    const [profileStatus, setProfileStatus] = useState(null)

    // ─── Education ────────────────────────────────────────────────
    const [educations, setEducations] = useState([])
    const [newEdu, setNewEdu] = useState({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '' })
    const [eduStatus, setEduStatus] = useState(null)

    // ─── Experience ───────────────────────────────────────────────
    const [experiences, setExperiences] = useState([])
    const [newExp, setNewExp] = useState({ company: '', title: '', location: '', start_date: '', end_date: '', is_current: false, description: '' })
    const [expStatus, setExpStatus] = useState(null)

    // ─── Privacy ──────────────────────────────────────────────────
    const [privacy, setPrivacy] = useState({})
    const [privacyStatus, setPrivacyStatus] = useState(null)

    // ─── Viewers ──────────────────────────────────────────────────
    const [viewers, setViewers] = useState(null)

    // ─── Resume ───────────────────────────────────────────────────
    const fileInputRef = useRef(null)
    const [resumeStatus, setResumeStatus] = useState(null)
    const [resumeOtpStep, setResumeOtpStep] = useState(false)
    const [resumeOtp, setResumeOtp] = useState('')

    // ─── 2FA ──────────────────────────────────────────────────────
    const [totpSetup, setTotpSetup] = useState(null)
    const [totpCode, setTotpCode] = useState('')
    const [totpStatus, setTotpStatus] = useState(null)
    const [disableOtp, setDisableOtp] = useState('')
    const [showDisable2FA, setShowDisable2FA] = useState(false)

    // ─── Active tab ───────────────────────────────────────────────
    const [tab, setTab] = useState('profile')

    // Load profile data
    useEffect(() => {
        if (!token) return
        api('/api/accounts/me/privacy', {}, token).then(r => r.json()).then(d => { if (!d.detail) setPrivacy(d) })
        api('/api/accounts/me', {}, token).then(r => r.json()).then(u => {
            if (u.id) {
                setForm({ full_name: u.full_name || '', headline: u.headline || '', location: u.location || '', bio: u.bio || '', phone: u.phone || '', skills: (u.skills || []).join(', '), profile_views_opt_out: u.profile_views_opt_out || false })
            }
        })
        api('/api/accounts/users/' + (user?.id), {}, token).then(r => r.json()).then(u => {
            setEducations(u.educations || [])
            setExperiences(u.experiences || [])
        })
    }, [token, user?.id])

    // ─── Profile save ─────────────────────────────────────────────
    const handleProfileSave = async (e) => {
        e.preventDefault()
        const skillsArr = form.skills.split(',').map(s => s.trim()).filter(Boolean)
        const res = await api('/api/accounts/me', { method: 'PUT', body: JSON.stringify({ ...form, skills: skillsArr }) }, token)
        setProfileStatus(res.ok ? { type: 'success', msg: 'Profile updated!' } : { type: 'error', msg: 'Update failed.' })
    }

    // ─── Education ────────────────────────────────────────────────
    const addEducation = async () => {
        const res = await api('/api/accounts/me/education', { method: 'POST', body: JSON.stringify(newEdu) }, token)
        if (res.ok) {
            const edu = await res.json()
            setEducations([...educations, edu])
            setNewEdu({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '' })
            setEduStatus({ type: 'success', msg: 'Education added!' })
        } else { setEduStatus({ type: 'error', msg: 'Failed to add.' }) }
    }

    const deleteEducation = async (id) => {
        await api(`/api/accounts/me/education/${id}`, { method: 'DELETE' }, token)
        setEducations(educations.filter(e => e.id !== id))
    }

    // ─── Experience ───────────────────────────────────────────────
    const addExperience = async () => {
        const res = await api('/api/accounts/me/experience', { method: 'POST', body: JSON.stringify(newExp) }, token)
        if (res.ok) {
            const exp = await res.json()
            setExperiences([...experiences, exp])
            setNewExp({ company: '', title: '', location: '', start_date: '', end_date: '', is_current: false, description: '' })
            setExpStatus({ type: 'success', msg: 'Experience added!' })
        } else { setExpStatus({ type: 'error', msg: 'Failed to add.' }) }
    }

    const deleteExperience = async (id) => {
        await api(`/api/accounts/me/experience/${id}`, { method: 'DELETE' }, token)
        setExperiences(experiences.filter(e => e.id !== id))
    }

    // ─── Privacy ──────────────────────────────────────────────────
    const savePrivacy = async () => {
        const res = await api('/api/accounts/me/privacy', { method: 'PUT', body: JSON.stringify(privacy) }, token)
        setPrivacyStatus(res.ok ? { type: 'success', msg: 'Privacy settings saved.' } : { type: 'error', msg: 'Failed.' })
    }

    // ─── Profile viewers ─────────────────────────────────────────
    const loadViewers = async () => {
        const res = await api('/api/accounts/me/viewers', {}, token)
        if (res.ok) setViewers(await res.json())
    }

    // ─── Resume ───────────────────────────────────────────────────
    const handleUpload = async (e) => {
        e.preventDefault()
        const file = fileInputRef.current?.files[0]
        if (!file) return
        const data = new FormData()
        data.append('file', file)
        setResumeStatus({ type: 'info', msg: 'Uploading & encrypting...' })
        const res = await api('/api/resumes/upload', { method: 'POST', body: data }, token)
        const json = await res.json()
        setResumeStatus(res.ok ? { type: 'success', msg: `Encrypted & stored. Integrity signed: ${json.integrity_signed}` } : { type: 'error', msg: json.detail || 'Upload failed.' })
        if (res.ok) fileInputRef.current.value = ''
    }

    const requestDownloadOtp = async () => {
        const res = await api('/api/accounts/action-otp/request?purpose=resume_download', { method: 'POST' }, token)
        if (res.ok) { setResumeOtpStep(true); setResumeStatus({ type: 'info', msg: 'OTP sent to your email. Enter it below.' }) }
        else { const j = await res.json(); setResumeStatus({ type: 'error', msg: j.detail }) }
    }

    const handleDownload = async () => {
        if (!resumeOtpStep) { requestDownloadOtp(); return }
        if (resumeOtp.length < 6) { setResumeStatus({ type: 'error', msg: 'Enter the full 6-digit OTP.' }); return }
        // Verify OTP, get action token
        const verifyRes = await api(`/api/accounts/action-otp/verify?purpose=resume_download&code=${resumeOtp}`, { method: 'POST' }, token)
        if (!verifyRes.ok) { const j = await verifyRes.json(); setResumeStatus({ type: 'error', msg: j.detail }); return }
        setResumeStatus({ type: 'info', msg: 'Downloading...' })
        const res = await api('/api/resumes/download', {}, token)
        if (!res.ok) { setResumeStatus({ type: 'error', msg: 'Download failed.' }); return }
        const blob = await res.blob()
        const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'resume.pdf'
        const integrity = res.headers.get('X-Integrity-Verified')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); a.remove()
        setResumeStatus({ type: 'success', msg: `Downloaded! Integrity verified: ${integrity}` })
        setResumeOtpStep(false); setResumeOtp('')
    }

    // ─── 2FA ──────────────────────────────────────────────────────
    const setup2FA = async () => {
        const res = await api('/api/accounts/2fa/setup', { method: 'POST' }, token)
        if (res.ok) { setTotpSetup(await res.json()); setTotpStatus(null) }
    }

    const enable2FA = async () => {
        const res = await api(`/api/accounts/2fa/enable?totp_code=${totpCode}`, { method: 'POST' }, token)
        const j = await res.json()
        setTotpStatus(res.ok ? { type: 'success', msg: '2FA enabled!' } : { type: 'error', msg: j.detail })
        if (res.ok) setTotpSetup(null)
    }

    const disable2FA = async () => {
        const res = await api(`/api/accounts/2fa/disable?otp_code=${disableOtp}`, { method: 'POST' }, token)
        const j = await res.json()
        setTotpStatus(res.ok ? { type: 'success', msg: '2FA disabled.' } : { type: 'error', msg: j.detail })
        if (res.ok) setShowDisable2FA(false)
    }

    const TABS = [
        { id: 'profile', label: 'Profile' },
        { id: 'education', label: 'Education' },
        { id: 'experience', label: 'Experience' },
        { id: 'privacy', label: 'Privacy' },
        { id: 'resume', label: 'Resume' },
        { id: 'security', label: 'Security' },
    ]

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-6">My Profile</h1>

            {/* Tab bar */}
            <div className="flex flex-wrap gap-2 mb-6 border-b-2 border-border pb-3">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded font-heading text-sm border-2 transition-colors
                            ${tab === t.id ? 'bg-main border-black text-main-foreground' : 'border-transparent hover:border-border'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Profile Tab ── */}
            {tab === 'profile' && (
                <Card>
                    <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                    <CardContent>
                        {profileStatus && <Alert variant={profileStatus.type === 'error' ? 'destructive' : 'default'} className="mb-4"><AlertDescription>{profileStatus.msg}</AlertDescription></Alert>}
                        <form onSubmit={handleProfileSave} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Email (read-only)</Label><Input disabled value={user?.email || ''} className="opacity-60" /></div>
                            </div>
                            <div className="space-y-1"><Label>Headline</Label><Input placeholder="e.g. Security Engineer at IIIT" value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                            </div>
                            <div className="space-y-1"><Label>Skills (comma-separated)</Label><Input placeholder="Python, Security, FastAPI" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} /></div>
                            <div className="space-y-1"><Label>Bio</Label><Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.profile_views_opt_out} onChange={e => setForm({ ...form, profile_views_opt_out: e.target.checked })} />
                                Opt out of profile view tracking (your name won't appear in others' viewer lists)
                            </label>
                            <Button type="submit">Save Changes</Button>
                        </form>

                        {/* Viewers */}
                        <div className="mt-6 border-t-2 border-border pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-heading">Profile Viewers</h3>
                                <Button size="sm" variant="neutral" onClick={loadViewers}>Load Viewers</Button>
                            </div>
                            {viewers && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Total views: {viewers.total_views}</p>
                                    {viewers.recent_viewers.length === 0
                                        ? <p className="text-sm">No viewers yet (or all opted out).</p>
                                        : viewers.recent_viewers.map(v => (
                                            <div key={v.viewer_id} className="flex items-center justify-between py-1 text-sm border-b border-border">
                                                <span>{v.viewer_name} (@{v.viewer_username})</span>
                                                <span className="text-muted-foreground text-xs">{new Date(v.viewed_at).toLocaleDateString()}</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Education Tab ── */}
            {tab === 'education' && (
                <div className="space-y-4">
                    {eduStatus && <Alert variant={eduStatus.type === 'error' ? 'destructive' : 'default'}><AlertDescription>{eduStatus.msg}</AlertDescription></Alert>}
                    {educations.map(edu => (
                        <Card key={edu.id}>
                            <CardContent className="pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-heading">{edu.institution}</p>
                                        <p className="text-sm">{edu.degree} {edu.field_of_study && `in ${edu.field_of_study}`}</p>
                                        <p className="text-xs text-muted-foreground">{edu.start_year} – {edu.end_year || 'Present'}</p>
                                        {edu.description && <p className="text-sm mt-1">{edu.description}</p>}
                                    </div>
                                    <Button size="sm" variant="neutral" onClick={() => deleteEducation(edu.id)}>Remove</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    <Card>
                        <CardHeader><CardTitle>Add Education</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <Input placeholder="Institution *" value={newEdu.institution} onChange={e => setNewEdu({ ...newEdu, institution: e.target.value })} />
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Degree (e.g. B.Tech)" value={newEdu.degree} onChange={e => setNewEdu({ ...newEdu, degree: e.target.value })} />
                                <Input placeholder="Field of Study" value={newEdu.field_of_study} onChange={e => setNewEdu({ ...newEdu, field_of_study: e.target.value })} />
                                <Input placeholder="Start Year" type="number" value={newEdu.start_year} onChange={e => setNewEdu({ ...newEdu, start_year: e.target.value })} />
                                <Input placeholder="End Year (blank = current)" type="number" value={newEdu.end_year} onChange={e => setNewEdu({ ...newEdu, end_year: e.target.value })} />
                            </div>
                            <Textarea placeholder="Description (optional)" value={newEdu.description} onChange={e => setNewEdu({ ...newEdu, description: e.target.value })} />
                            <Button onClick={addEducation}>Add Education</Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Experience Tab ── */}
            {tab === 'experience' && (
                <div className="space-y-4">
                    {expStatus && <Alert variant={expStatus.type === 'error' ? 'destructive' : 'default'}><AlertDescription>{expStatus.msg}</AlertDescription></Alert>}
                    {experiences.map(exp => (
                        <Card key={exp.id}>
                            <CardContent className="pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-heading">{exp.title} at {exp.company}</p>
                                        <p className="text-sm text-muted-foreground">{exp.location}</p>
                                        <p className="text-xs">{exp.start_date} – {exp.is_current ? 'Present' : (exp.end_date || '')}</p>
                                        {exp.description && <p className="text-sm mt-1">{exp.description}</p>}
                                    </div>
                                    <Button size="sm" variant="neutral" onClick={() => deleteExperience(exp.id)}>Remove</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    <Card>
                        <CardHeader><CardTitle>Add Experience</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Company *" value={newExp.company} onChange={e => setNewExp({ ...newExp, company: e.target.value })} />
                                <Input placeholder="Title *" value={newExp.title} onChange={e => setNewExp({ ...newExp, title: e.target.value })} />
                                <Input placeholder="Location" value={newExp.location} onChange={e => setNewExp({ ...newExp, location: e.target.value })} />
                                <Input placeholder="Start Date (YYYY-MM)" value={newExp.start_date} onChange={e => setNewExp({ ...newExp, start_date: e.target.value })} />
                                <Input placeholder="End Date (leave blank if current)" value={newExp.end_date} onChange={e => setNewExp({ ...newExp, end_date: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={newExp.is_current} onChange={e => setNewExp({ ...newExp, is_current: e.target.checked })} />
                                Currently working here
                            </label>
                            <Textarea placeholder="Description" value={newExp.description} onChange={e => setNewExp({ ...newExp, description: e.target.value })} />
                            <Button onClick={addExperience}>Add Experience</Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Privacy Tab ── */}
            {tab === 'privacy' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Field-Level Privacy Controls</CardTitle>
                        <CardDescription>Choose who can see each field: public, connections only, or private (only you)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {privacyStatus && <Alert variant={privacyStatus.type === 'error' ? 'destructive' : 'default'}><AlertDescription>{privacyStatus.msg}</AlertDescription></Alert>}
                        {[
                            ['email_visibility', 'Email'],
                            ['phone_visibility', 'Phone'],
                            ['location_visibility', 'Location'],
                            ['bio_visibility', 'Bio'],
                            ['education_visibility', 'Education'],
                            ['experience_visibility', 'Experience'],
                            ['skills_visibility', 'Skills'],
                            ['connections_visibility', 'Connections Count'],
                        ].map(([key, label]) => (
                            <div key={key} className="flex items-center justify-between">
                                <Label>{label}</Label>
                                <div className="flex gap-2">
                                    {PRIVACY_LEVELS.map(lvl => (
                                        <button key={lvl} type="button"
                                            onClick={() => setPrivacy({ ...privacy, [key]: lvl })}
                                            className={`px-3 py-1 text-xs border-2 rounded font-heading transition-colors
                                                ${privacy[key] === lvl ? 'bg-main border-black text-main-foreground' : 'border-border hover:border-black'}`}>
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <Button onClick={savePrivacy}>Save Privacy Settings</Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Resume Tab ── */}
            {tab === 'resume' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Resume Vault <Badge variant="neutral">AES-256 + PKI signed</Badge></CardTitle>
                        <CardDescription>Encrypted at rest. Download requires OTP verification.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {resumeStatus && <Alert variant={resumeStatus.type === 'error' ? 'destructive' : resumeStatus.type === 'info' ? 'default' : 'default'}><AlertDescription>{resumeStatus.msg}</AlertDescription></Alert>}
                        <form onSubmit={handleUpload} className="space-y-3">
                            <Label>Upload Resume (PDF or DOCX, max 5MB)</Label>
                            <Input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx" required />
                            <Button type="submit">Upload & Encrypt</Button>
                        </form>
                        <div className="border-t-2 border-border pt-4">
                            <h3 className="font-heading mb-2">Download Resume</h3>
                            <p className="text-sm text-muted-foreground mb-3">Downloading requires OTP verification (virtual keyboard) for security.</p>
                            {resumeOtpStep && (
                                <div className="mb-4">
                                    <VirtualKeyboard value={resumeOtp} onChange={setResumeOtp} maxLength={6} label="Enter Download OTP" />
                                </div>
                            )}
                            <Button onClick={handleDownload} variant="neutral">
                                {resumeOtpStep ? 'Confirm Download with OTP' : 'Request Download OTP'}
                            </Button>
                            {resumeOtpStep && <Button variant="neutral" className="ml-2" onClick={() => { setResumeOtpStep(false); setResumeOtp('') }}>Cancel</Button>}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Security Tab ── */}
            {tab === 'security' && (
                <div className="space-y-6">
                    {/* Account Info */}
                    <Card>
                        <CardHeader><CardTitle>Account Info</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {[['Username', user?.username], ['Role', user?.role?.replace(/_/g, ' ')], ['Email verified', user?.is_email_verified ? '✓ Yes' : '✗ No'], ['2FA enabled', user?.totp_enabled ? '✓ Yes' : '✗ No']].map(([k, v]) => (
                                <div key={k} className="flex justify-between"><span className="font-heading">{k}</span><span>{v}</span></div>
                            ))}
                            {!user?.is_email_verified && <Link to="/verify"><Button size="sm" className="mt-2 w-full">Verify Email</Button></Link>}
                        </CardContent>
                    </Card>

                    {/* 2FA */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Two-Factor Authentication (TOTP)</CardTitle>
                            <CardDescription>Use an authenticator app (Google Authenticator, Authy) for extra login security.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {totpStatus && <Alert variant={totpStatus.type === 'error' ? 'destructive' : 'default'}><AlertDescription>{totpStatus.msg}</AlertDescription></Alert>}
                            {!user?.totp_enabled && !totpSetup && (
                                <Button onClick={setup2FA}>Set Up 2FA</Button>
                            )}
                            {totpSetup && (
                                <div className="space-y-3">
                                    <p className="text-sm">Scan this QR code with your authenticator app, then enter the 6-digit code below to confirm.</p>
                                    <div className="p-3 bg-secondary-background border-2 border-border rounded font-mono text-xs break-all">{totpSetup.provisioning_uri}</div>
                                    <Input placeholder="6-digit TOTP code" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} inputMode="numeric" />
                                    <Button onClick={enable2FA}>Enable 2FA</Button>
                                </div>
                            )}
                            {user?.totp_enabled && (
                                <div>
                                    <Badge className="mb-3">2FA Active</Badge>
                                    {!showDisable2FA
                                        ? <Button variant="neutral" size="sm" onClick={() => setShowDisable2FA(true)}>Disable 2FA</Button>
                                        : <div className="space-y-2">
                                            <p className="text-sm">Request an action OTP first, then enter it here.</p>
                                            <Button size="sm" variant="neutral" onClick={() => api('/api/accounts/action-otp/request?purpose=totp_disable', { method: 'POST' }, token)}>Send Disable OTP</Button>
                                            <Input placeholder="Enter OTP" value={disableOtp} onChange={e => setDisableOtp(e.target.value)} maxLength={6} />
                                            <Button size="sm" onClick={disable2FA}>Confirm Disable</Button>
                                        </div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Connections link */}
                    <Card>
                        <CardContent className="pt-4">
                            <Link to="/connections"><Button variant="neutral" className="w-full">Manage Connections</Button></Link>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
