import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
    const [identifier, setIdentifier] = useState('')
    const [code, setCode] = useState('')
    const [step, setStep] = useState(1)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { user, requestLoginOtp, login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (user) {
            navigate('/profile', { replace: true })
        }
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
        setLoading(true)
        setError('')
        setMessage('')
        try {
            const res = await requestLoginOtp(identifier)
            setMessage(res.message)
            setStep(2)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            await login(identifier, code)
            navigate('/profile')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const resetStep = () => {
        setStep(1)
        setCode('')
        setError('')
        setMessage('')
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Welcome Back</CardTitle>
                    <CardDescription>
                        {step === 1 ? 'Sign in to your SecureAJob account' : 'Enter the verification code sent to you'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {message && !error && (
                        <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
                            <AlertTitle>Success</AlertTitle>
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Email, Phone, or Username</Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    placeholder="e.g. user@example.com or +1234567890"
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
                            <div className="space-y-2">
                                <Label htmlFor="code">6-Digit Code</Label>
                                <Input
                                    id="code"
                                    type="text"
                                    placeholder="Enter your OTP"
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    required
                                    maxLength={6}
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button type="button" variant="outline" className="w-1/3" onClick={resetStep} disabled={loading}>
                                    Back
                                </Button>
                                <Button type="submit" className="w-2/3" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Log In'}
                                </Button>
                            </div>
                        </form>
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
