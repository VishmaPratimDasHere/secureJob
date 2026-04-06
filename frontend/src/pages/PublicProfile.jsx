import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function PublicProfile() {
    const { id } = useParams()
    const { token, user: currentUser } = useAuth()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [connStatus, setConnStatus] = useState(null) // 'connected' | 'pending' | null
    const [connMsg, setConnMsg] = useState('')

    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true); setError('')
            try {
                const res = await fetch(`/api/accounts/users/${id}`, { headers })
                if (res.ok) {
                    setProfile(await res.json())
                } else if (res.status === 404) {
                    setError('User not found.')
                } else {
                    setError('Failed to load profile.')
                }
            } catch {
                setError('Network error.')
            }
            setLoading(false)
        }
        fetchProfile()
    }, [id, token])

    const sendConnectionRequest = async () => {
        setConnMsg('')
        try {
            const res = await fetch(`/api/accounts/connections/request/${id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                setConnStatus('pending')
                setConnMsg('Connection request sent.')
            } else {
                const d = await res.json()
                setConnMsg(d.detail || 'Failed to send request')
            }
        } catch { setConnMsg('Network error') }
    }

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-16 text-center font-heading animate-pulse">
                Loading profile...
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    const isOwnProfile = currentUser?.id === parseInt(id)

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-heading">{profile.full_name || profile.username}</h1>
                            <p className="text-foreground/60 text-sm">@{profile.username}</p>
                            {profile.headline && (
                                <p className="mt-2 text-sm">{profile.headline}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Badge variant="neutral">{profile.role?.replace('_', ' ')}</Badge>
                                {profile.location && <Badge variant="neutral">{profile.location}</Badge>}
                                {profile.totp_enabled && <Badge>2FA Enabled</Badge>}
                            </div>
                        </div>
                        <div className="shrink-0 flex flex-col gap-2">
                            {isOwnProfile ? (
                                <Link to="/profile">
                                    <Button size="sm" variant="neutral">Edit Profile</Button>
                                </Link>
                            ) : token && (
                                <>
                                    {connStatus === 'connected' && <Badge>Connected</Badge>}
                                    {connStatus === 'pending' && <Badge variant="neutral">Request Sent</Badge>}
                                    {!connStatus && (
                                        <Button size="sm" onClick={sendConnectionRequest}>Connect</Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {connMsg && (
                        <p className="text-sm mt-3 text-foreground/60">{connMsg}</p>
                    )}
                </CardContent>
            </Card>

            {/* About */}
            {profile.bio && (
                <Card>
                    <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
                    </CardContent>
                </Card>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.map(s => (
                                <Badge key={s} variant="neutral">{s}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Education</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {profile.education.map((edu, i) => (
                            <div key={i} className="border-l-2 border-border pl-3">
                                <p className="font-heading text-sm">{edu.degree}{edu.field && ` in ${edu.field}`}</p>
                                <p className="text-sm text-foreground/70">{edu.institution}</p>
                                <p className="text-xs text-foreground/50">
                                    {edu.start_year}{edu.end_year ? ` – ${edu.end_year}` : ' – Present'}
                                </p>
                                {edu.description && <p className="text-xs mt-1">{edu.description}</p>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Experience */}
            {profile.experience && profile.experience.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Experience</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {profile.experience.map((exp, i) => (
                            <div key={i} className="border-l-2 border-border pl-3">
                                <p className="font-heading text-sm">{exp.title}</p>
                                <p className="text-sm text-foreground/70">{exp.company}{exp.location && ` · ${exp.location}`}</p>
                                <p className="text-xs text-foreground/50">
                                    {exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : ' – Present'}
                                </p>
                                {exp.description && <p className="text-xs mt-1">{exp.description}</p>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* RSA Public Key */}
            {profile.rsa_public_key && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Public Key</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-xs text-foreground/50 mb-2">
                            Use this key to verify messages signed by this user.
                        </p>
                        <pre className="text-xs bg-secondary-background border-2 border-border rounded-base p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                            {profile.rsa_public_key}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
