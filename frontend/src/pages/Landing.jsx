import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
    { title: 'Privacy-First Profiles', desc: 'Control exactly who sees your information. Set visibility per field — public, connections only, or completely private.', color: 'bg-main' },
    { title: 'Encrypted Resume Storage', desc: 'Your resume is encrypted before it ever touches our servers. Only you decide who gets access.', color: 'bg-background' },
    { title: 'Verified Identity', desc: 'Every user is verified through email and mobile OTP, so you always know you\'re connecting with real people.', color: 'bg-main' },
    { title: 'Smart Job Matching', desc: 'Find opportunities that fit. Search by role, skill, or location and track every application from start to offer.', color: 'bg-background' },
    { title: 'Private Messaging', desc: 'Have confidential conversations with recruiters and hiring managers — fully encrypted, end to end.', color: 'bg-main' },
    { title: 'Employer Tools', desc: 'Post jobs, manage applicants, and access hiring analytics — all from a single, intuitive dashboard.', color: 'bg-background' },
]

export default function Landing() {
    return (
        <div>
            {/* Hero Section */}
            <section className="max-w-5xl mx-auto px-4 py-16 md:py-24">
                <div className="flex flex-col items-center text-center gap-6">
                    <Badge className="text-sm px-4 py-1">Now in Early Access</Badge>
                    <h1 className="text-4xl md:text-6xl font-heading leading-tight max-w-3xl">
                        Your career deserves<br />better security.
                    </h1>
                    <p className="text-lg md:text-xl font-base max-w-2xl text-foreground/70">
                        SecureAJob is the job platform built from the ground up to protect your data. Encrypted resumes, verified users, and private conversations — the way hiring should work.
                    </p>
                    <div className="flex gap-4 mt-4">
                        <Link to="/register">
                            <Button size="lg" className="text-base px-8">Get Started — It's Free</Button>
                        </Link>
                        <Link to="/login">
                            <Button size="lg" variant="neutral" className="text-base px-8">Sign In</Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="max-w-5xl mx-auto px-4 py-12">
                <h2 className="text-3xl font-heading text-center mb-3">Why SecureAJob?</h2>
                <p className="text-center text-foreground/60 font-base mb-10 max-w-xl mx-auto">Everything you need to find work or hire talent — without compromising on privacy.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((f) => (
                        <Card key={f.title} className={f.color}>
                            <CardHeader>
                                <CardTitle>{f.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{f.desc}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="max-w-5xl mx-auto px-4 py-16 text-center">
                <Card className="bg-main">
                    <CardContent className="py-10">
                        <h2 className="text-2xl md:text-3xl font-heading mb-4">Ready to take control of your career?</h2>
                        <p className="font-base text-foreground/70 mb-6 max-w-lg mx-auto">Join thousands of professionals who trust SecureAJob with their most sensitive career data.</p>
                        <Link to="/register">
                            <Button size="lg" variant="neutral" className="text-base px-8">Create Your Free Account</Button>
                        </Link>
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
