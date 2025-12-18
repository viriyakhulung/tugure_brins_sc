import React, { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { createPageUrl } from '@/utils';

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect authenticated users to dashboard
        window.location.href = createPageUrl('Dashboard');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Will redirect to dashboard if logged in
  return null;
}