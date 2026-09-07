import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-4">Loading...</div>
  }
  if (!user) {
    // Not authenticated – send to login, remember where we came from
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (requiredRole && role !== requiredRole) {
    // Authenticated but lacks required role
    return <Navigate to="/not-authorized" replace />
  }
  return <>{children}</>
}
