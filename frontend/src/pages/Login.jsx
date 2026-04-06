import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/context/AuthContext'
import VirtualKeyboard from '@/components/VirtualKeyboard'

export default function Login() {
    const [identifier, setIdentifier] = useState('')
    const [code, setCode] = useState('')
    const [totpCode, setTotpCode] = useState('')
    const [requiresTotp, setRequiresTotp] = useState(false)
    const [step, setStep] = useState(1)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { user, requestLoginOtp, login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (user) navigate('/profile', { replace: true })
    }, [user, navigate])

    useEffect(() => {
        if (location.state?.identifier) {
            setIdentifier(location.state.identifier)
            if (location.state.step === 2) {
                setStep(2)
                setMessage(location.state.message || 'OTP sent successfully.')
            }
        }
    }, [location.state])

    const handleRequestOtp = async (e) => {
        e.preventDefault()
        setLoading(true); setError(''); setMessage('')
        try {
            const res = await requestLoginOtp(identifier)
            setMessage(res.message)
            setRequiresTotp(res.requires_totp || false)
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        if (code.length < 6) { setError('Please enter the full 6-digit OTP.'); return }
        setLoading(true); setError('')
        try {
            await login(identifier, code, requiresTotp ? totpCode : undefined)
            navigate('/profile')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const resetStep = () => { setStep(1); setCode(''); setTotpCode(''); setError(''); setMessage('') }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Welcome Back</CardTitle>
                    <CardDescription>
                        {step === 1 ? 'Sign in to your SecureAJob account' : 'Enter your secure verification code'}
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

                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
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
                            <Button type="submit" className="w-full mt-2" disabled={loading}>
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                            {/* Virtual keyboard for OTP — defends against keyloggers */}
                            <VirtualKeyboard
                                value={code}
                                onChange={setCode}
                                maxLength={6}
                                label="OTP Code (use the secure keyboard below)"
                            />

                            {requiresTotp && (
                                <div className="space-y-2 mt-2">
                                    <Label>Authenticator App Code (6 digits)</Label>
                                    <Input
                                        type="text"
                                        placeholder="TOTP code from your app"
                                        value={totpCode}
                                        onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        maxLength={6}
                                        inputMode="numeric"
                                    />
                                </div>
                            )}

                            <div className="flex gap-2 mt-2">
                                <Button type="button" variant="neutral" className="w-1/3" onClick={resetStep} disabled={loading}>
                                    Back
                                </Button>
                                <Button type="submit" className="w-2/3" disabled={loading || code.length < 6}>
                                    {loading ? 'Verifying...' : 'Log In'}
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 1 && (
                        <p className="text-center text-sm mt-4">
                            <Link to="/forgot-password" className="underline underline-offset-4 hover:text-main">
                                Forgot password / Reset access
                            </Link>
                        </p>
                    )}
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-heading underline underline-offset-4 hover:text-main">
                            Register
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
