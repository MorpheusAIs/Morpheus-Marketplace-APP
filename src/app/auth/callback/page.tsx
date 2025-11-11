'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @deprecated This OAuth callback page is deprecated.
 * The application now uses direct authentication via AuthModal component.
 * This page redirects users to the login page.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // This OAuth callback flow is deprecated
    // Redirect users to the direct login page
    setIsProcessing(false);
    router.push('/login-direct');
  }, [router]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--matrix-green)]">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-mint)]"></div>
          </div>
          <h1 className="text-xl font-semibold text-[var(--neon-mint)] mb-2">
            Redirecting...
          </h1>
          <p className="text-[var(--platinum)]/70">
            Please wait while we redirect you to the login page.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--matrix-green)]">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-mint)]"></div>
          </div>
          <h1 className="text-xl font-semibold text-[var(--neon-mint)] mb-2">
            Loading...
          </h1>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
