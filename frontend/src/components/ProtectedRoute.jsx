import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <Card className="w-48 text-center">
                    <CardContent className="py-8 font-heading animate-pulse">Loading...</CardContent>
                </Card>
            </div>
        )
    }

    if (!user) return <Navigate to="/login" replace />

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/" replace />
    }

    return children
}
