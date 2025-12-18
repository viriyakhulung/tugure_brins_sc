import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Home() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = createPageUrl('Dashboard');
    }
  }, [user, loading]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      window.location.href = createPageUrl('Dashboard');
    } else {
      setError(result.error || 'Invalid email or password');
      setIsLoading(false);
    }
  };

  const sampleUsers = [
    { email: 'admin@sample.com', password: 'admin', role: 'Administrator' },
    { email: 'brins@sample.com', password: 'brins', role: 'BRINS User' },
    { email: 'tugure@sample.com', password: 'tugure', role: 'Tugure User' }
  ];

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

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-slate-700/50 bg-white/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Credit Reinsurance Platform
            </CardTitle>
            <CardDescription className="text-base mt-2">
              BRINS - TUGURE System
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Sample Users */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium text-gray-700 mb-3 text-center">Demo Users</p>
              <div className="space-y-2">
                {sampleUsers.map((user, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(user.password);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.role}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-xs px-2 py-1 rounded bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 font-mono">
                        {user.password}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </form>

        <CardFooter className="flex flex-col space-y-2 text-center text-xs text-gray-500">
          <p>© 2025 Credit Reinsurance Platform</p>
          <p>BRINS & TUGURE - Secure Insurance System</p>
        </CardFooter>
      </Card>
    </div>
  );
}