import React, { useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import { createPageUrl } from '@/utils';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login if not authenticated
      window.location.href = '/'; // Platform will show login
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check role access
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">You don't have permission to access this page</p>
          <a 
            href={createPageUrl('Dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}