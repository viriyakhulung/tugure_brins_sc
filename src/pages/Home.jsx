import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowRight } from "lucide-react";
import { base44 } from '@/api/base44Client';

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await base44.auth.me();
      if (user) {
        // Already logged in, redirect to Dashboard
        window.location.href = createPageUrl('Dashboard');
      } else {
        setLoading(false);
      }
    } catch (error) {
      // Not logged in
      setLoading(false);
    }
  };

  const handleLogin = () => {
    // Redirect to Base44 login
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  };

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

        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <p className="text-gray-600">
              Welcome to the Credit Reinsurance Platform prototype.
            </p>
            <p className="text-sm text-gray-500">
              This is a comprehensive system for managing reinsurance processes between BRINS and TUGURE.
            </p>
          </div>

          <Button 
            onClick={handleLogin}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
          >
            <span className="mr-2">Sign In to Continue</span>
            <ArrowRight className="w-5 h-5" />
          </Button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Key Features:</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Debtor submission and review workflow</li>
              <li>Document eligibility management</li>
              <li>Payment intent and reconciliation</li>
              <li>Claims submission and review</li>
              <li>Bordero and subrogation tracking</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}