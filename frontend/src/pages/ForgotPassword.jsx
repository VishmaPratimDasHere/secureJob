import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import VirtualKeyboard from '@/components/VirtualKeyboard'

export default function ForgotPassword() {
    const [step, setStep] = useState(1)
    const [identifier, setIdentifier] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleRequestReset = async (e) => {
        e.preventDefault()
        setLoading(true); setError(''); setMessage('')
        try {
            const res = await fetch('/api/accounts/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Failed to send reset OTP')
            setMessage(data.message || 'Reset OTP sent to your email.')
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyReset = async (e) => {
        e.preventDefault()
        if (otpCode.length < 6) { setError('Please enter the full 6-digit OTP.'); return }
        if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/accounts/password-reset/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, code: otpCode, new_password: newPassword })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Failed to reset password')
            setMessage('Password reset successfully. You can now log in.')
            setStep(3)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Reset Access</CardTitle>
                    <CardDescription>
                        {step === 1 && 'Enter your email or username to receive a reset OTP'}
                        {step === 2 && 'Enter the OTP and your new password'}
                        {step === 3 && 'Password reset complete'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {message && !error && (
                        <Alert className="mb-4 border-green-400 bg-green-50 text-green-800">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Email or Username</Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    placeholder="e.g. user@example.com or johndoe"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset OTP'}
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyReset} className="flex flex-col gap-4">
                            <VirtualKeyboard
                                value={otpCode}
                                onChange={setOtpCode}
                                maxLength={6}
                                label="Reset OTP (use the secure keyboard)"
                            />
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Repeat new password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="neutral" className="w-1/3" onClick={() => { setStep(1); setOtpCode(''); setError('') }} disabled={loading}>
                                    Back
                                </Button>
                                <Button type="submit" className="w-2/3" disabled={loading || otpCode.length < 6}>
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <Button className="w-full" onClick={() => navigate('/login')}>
                            Go to Login
                        </Button>
                    )}
                </CardContent>

                <CardFooter className="justify-center">
                    <p className="text-sm">
                        Remember your password?{' '}
                        <Link to="/login" className="font-heading underline underline-offset-4 hover:text-main">
                            Log In
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
