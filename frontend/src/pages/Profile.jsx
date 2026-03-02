import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function Profile() {
    const { user, token } = useAuth()
    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        headline: user?.headline || '',
        location: user?.location || '',
        bio: user?.bio || '',
        phone: user?.phone || ''
    })
    const [status, setStatus] = useState(null)
    const [resumeStatus, setResumeStatus] = useState(null)
    const fileInputRef = useRef(null)

    const handleProfileSubmit = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/accounts/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            })
            setStatus(res.ok ? { type: 'success', msg: 'Profile updated!' } : { type: 'error', msg: 'Update failed.' })
        } catch {
            setStatus({ type: 'error', msg: 'Network error.' })
        }
    }

    const handleUpload = async (e) => {
        e.preventDefault()
        const file = fileInputRef.current?.files[0]
        if (!file) return
        const data = new FormData()
        data.append('file', file)
        setResumeStatus({ type: 'info', msg: 'Uploading & encrypting...' })
        try {
            const res = await fetch('/api/resumes/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: data
            })
            setResumeStatus(res.ok
                ? { type: 'success', msg: 'Resume encrypted & stored securely!' }
                : { type: 'error', msg: 'Upload failed.' })
            if (res.ok) fileInputRef.current.value = ''
        } catch {
            setResumeStatus({ type: 'error', msg: 'Network error.' })
        }
    }

    const handleDownload = async () => {
        setResumeStatus({ type: 'info', msg: 'Downloading...' })
        try {
            const res = await fetch('/api/resumes/download', { headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) throw new Error()
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'resume'; document.body.appendChild(a); a.click(); a.remove()
            setResumeStatus({ type: 'success', msg: 'Downloaded!' })
        } catch {
            setResumeStatus({ type: 'error', msg: 'No resume found or download failed.' })
        }
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-8">My Profile</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Edit */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your profile details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {status && (
                                <Alert variant={status.type === 'error' ? 'destructive' : 'default'} className="mb-4">
                                    <AlertDescription>{status.msg}</AlertDescription>
                                </Alert>
                            )}
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input disabled value={user?.email || ''} className="opacity-60" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Headline</Label>
                                    <Input placeholder="e.g. Security Engineer" value={formData.headline} onChange={e => setFormData({ ...formData, headline: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Location</Label>
                                        <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Bio</Label>
                                    <Textarea placeholder="Tell us about yourself..." value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
                                </div>
                                <Button type="submit">Save Changes</Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Resume Sidebar */}
                <div className="space-y-6">
                    <Card className="bg-main">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Resume Vault
                                <Badge variant="neutral">Encrypted</Badge>
                            </CardTitle>
                            <CardDescription>AES-256 encrypted at rest</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {resumeStatus && (
                                <Alert variant={resumeStatus.type === 'error' ? 'destructive' : 'default'} className="mb-4">
                                    <AlertDescription>{resumeStatus.msg}</AlertDescription>
                                </Alert>
                            )}
                            <form onSubmit={handleUpload} className="space-y-3">
                                <Input type="file" ref={fileInputRef} required />
                                <div className="grid grid-cols-2 gap-3">
                                    <Button type="submit" variant="neutral" className="w-full">Upload</Button>
                                    <Button type="button" variant="default" className="w-full" onClick={handleDownload}>Download</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* User Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="font-heading">Username</span>
                                <span>{user?.username}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-heading">Role</span>
                                <Badge>{user?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-heading">Email</span>
                                <Badge variant={user?.is_email_verified ? 'default' : 'neutral'}>
                                    {user?.is_email_verified ? '✓ Verified' : '✗ Unverified'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-heading">Phone</span>
                                <Badge variant={user?.is_phone_verified ? 'default' : 'neutral'}>
                                    {user?.is_phone_verified ? '✓ Verified' : '✗ Unverified'}
                                </Badge>
                            </div>
                            {(!user?.is_email_verified || !user?.is_phone_verified) && (
                                <a href="/verify">
                                    <Button variant="default" className="w-full mt-2" size="sm">Verify Now</Button>
                                </a>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
