import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function Companies() {
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/jobs/companies')
            .then(r => r.ok ? r.json() : [])
            .then(setCompanies)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center font-heading animate-pulse">Loading companies...</div>

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-heading mb-8">Companies</h1>

            {companies.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <p className="font-heading text-lg">No companies yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map(c => (
                        <Card key={c.id}>
                            <CardHeader>
                                <CardTitle>
                                    <Link to={`/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                                </CardTitle>
                                {c.location && <CardDescription>{c.location}</CardDescription>}
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm line-clamp-3">{c.description || 'No description'}</p>
                                {c.website && (
                                    <p className="text-xs text-foreground/50 mt-2 truncate">{c.website}</p>
                                )}
                                <Link to={`/companies/${c.id}`}>
                                    <Button variant="neutral" size="sm" className="mt-3 w-full">View Jobs</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
