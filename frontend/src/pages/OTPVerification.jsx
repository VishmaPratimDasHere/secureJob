import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function OTPVerification() {
    const { user, token } = useAuth()
    const [emailOtp, setEmailOtp] = useState('')
    const [emailStatus, setEmailStatus] = useState(null)
    const [emailSent, setEmailSent] = useState(false)
    const [loading, setLoading] = useState('')

    const sendOtp = async () => {
        setLoading('send')
        try {
            const res = await fetch('/api/accounts/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ method: 'email' })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Failed')
            setEmailStatus({ type: 'success', msg: data.message })
            setEmailSent(true)
        } catch (err) {
            setEmailStatus({ type: 'error', msg: err.message })
        } finally {
            setLoading('')
        }
    }

    const verifyOtp = async () => {
        setLoading('verify')
        try {
            const res = await fetch('/api/accounts/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ method: 'email', code: emailOtp })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Verification failed')
            setEmailStatus({ type: 'success', msg: data.message })
            setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
            setEmailStatus({ type: 'error', msg: err.message })
        } finally {
            setLoading('')
        }
    }

    return (
        <div className="max-w-md mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-2">Email Verification</h1>
            <p className="text-foreground/60 font-base mb-8">Verify your email to secure your account.</p>

            <Card className={user?.is_email_verified ? 'bg-main' : ''}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Email
                        {user?.is_email_verified
                            ? <Badge variant="neutral">✓ Verified</Badge>
                            : <Badge>Unverified</Badge>
                        }
                    </CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                </CardHeader>
                <CardContent>
                    {user?.is_email_verified ? (
                        <p className="text-sm font-base">Your email has been verified.</p>
                    ) : (
                        <div className="space-y-3">
                            {emailStatus && (
                                <Alert variant={emailStatus.type === 'error' ? 'destructive' : 'default'}>
                                    <AlertDescription>{emailStatus.msg}</AlertDescription>
                                </Alert>
                            )}
                            {!emailSent ? (
                                <Button onClick={sendOtp} className="w-full" disabled={loading === 'send'}>
                                    {loading === 'send' ? 'Sending...' : 'Send OTP to Email'}
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>Enter 6-digit code</Label>
                                        <Input
                                            placeholder="123456"
                                            maxLength={6}
                                            value={emailOtp}
                                            onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button onClick={verifyOtp} disabled={emailOtp.length !== 6 || loading === 'verify'}>
                                            {loading === 'verify' ? 'Verifying...' : 'Verify'}
                                        </Button>
                                        <Button variant="neutral" onClick={sendOtp} disabled={loading === 'send'}>
                                            Resend
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="mt-8 text-sm text-foreground/50 font-base space-y-1">
                <p>• OTP codes expire after 5 minutes</p>
                <p>• Maximum 5 verification attempts before account lockout</p>
                <p>• Maximum 5 OTP requests per hour</p>
            </div>
        </div>
    )
}
