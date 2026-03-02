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
    const [phoneOtp, setPhoneOtp] = useState('')
    const [emailStatus, setEmailStatus] = useState(null)
    const [phoneStatus, setPhoneStatus] = useState(null)
    const [emailSent, setEmailSent] = useState(false)
    const [phoneSent, setPhoneSent] = useState(false)
    const [loading, setLoading] = useState('')

    const sendOtp = async (method) => {
        setLoading(method + '-send')
        const setter = method === 'email' ? setEmailStatus : setPhoneStatus
        try {
            const res = await fetch('/api/accounts/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ method })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Failed')
            setter({ type: 'success', msg: data.message })
            if (method === 'email') setEmailSent(true)
            else setPhoneSent(true)
        } catch (err) {
            setter({ type: 'error', msg: err.message })
        } finally {
            setLoading('')
        }
    }

    const verifyOtp = async (method) => {
        setLoading(method + '-verify')
        const code = method === 'email' ? emailOtp : phoneOtp
        const setter = method === 'email' ? setEmailStatus : setPhoneStatus
        try {
            const res = await fetch('/api/accounts/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ method, code })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Verification failed')
            setter({ type: 'success', msg: data.message })
            // Reload to update user state
            setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
            setter({ type: 'error', msg: err.message })
        } finally {
            setLoading('')
        }
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-2">Identity Verification</h1>
            <p className="text-foreground/60 font-base mb-8">Verify your email and phone to secure your account.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Verification */}
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
                                    <Button onClick={() => sendOtp('email')} className="w-full" disabled={loading === 'email-send'}>
                                        {loading === 'email-send' ? 'Sending...' : 'Send OTP to Email'}
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
                                            <Button onClick={() => verifyOtp('email')} disabled={emailOtp.length !== 6 || loading === 'email-verify'}>
                                                {loading === 'email-verify' ? 'Verifying...' : 'Verify'}
                                            </Button>
                                            <Button variant="neutral" onClick={() => sendOtp('email')} disabled={loading === 'email-send'}>
                                                Resend
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Phone Verification */}
                <Card className={user?.is_phone_verified ? 'bg-main' : ''}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Phone
                            {user?.is_phone_verified
                                ? <Badge variant="neutral">✓ Verified</Badge>
                                : <Badge>Unverified</Badge>
                            }
                        </CardTitle>
                        <CardDescription>{user?.phone || 'No phone number added'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {user?.is_phone_verified ? (
                            <p className="text-sm font-base">Your phone number has been verified.</p>
                        ) : !user?.phone ? (
                            <p className="text-sm font-base text-foreground/60">Add a phone number in your profile first.</p>
                        ) : (
                            <div className="space-y-3">
                                {phoneStatus && (
                                    <Alert variant={phoneStatus.type === 'error' ? 'destructive' : 'default'}>
                                        <AlertDescription>{phoneStatus.msg}</AlertDescription>
                                    </Alert>
                                )}
                                {!phoneSent ? (
                                    <Button onClick={() => sendOtp('phone')} className="w-full" disabled={loading === 'phone-send'}>
                                        {loading === 'phone-send' ? 'Sending...' : 'Send OTP to Phone'}
                                    </Button>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Enter 6-digit code</Label>
                                            <Input
                                                placeholder="123456"
                                                maxLength={6}
                                                value={phoneOtp}
                                                onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button onClick={() => verifyOtp('phone')} disabled={phoneOtp.length !== 6 || loading === 'phone-verify'}>
                                                {loading === 'phone-verify' ? 'Verifying...' : 'Verify'}
                                            </Button>
                                            <Button variant="neutral" onClick={() => sendOtp('phone')} disabled={loading === 'phone-send'}>
                                                Resend
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Security Info */}
            <div className="mt-8 text-sm text-foreground/50 font-base space-y-1">
                <p>• OTP codes expire after 5 minutes</p>
                <p>• Maximum 5 verification attempts before account lockout</p>
                <p>• Maximum 5 OTP requests per hour</p>
            </div>
        </div>
    )
}
