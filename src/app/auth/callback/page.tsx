'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CognitoDirectAuth } from '@/lib/auth/cognito-direct-auth';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        // Check for OAuth errors
        if (errorParam) {
          const errorDescription = searchParams.get('error_description') || 'Authentication failed';
          setError(errorDescription);
          setIsProcessing(false);
          setTimeout(() => {
            router.push('/signin');
          }, 3000);
          return;
        }

        // Validate state parameter (CSRF protection)
        if (typeof window !== 'undefined') {
          const storedState = sessionStorage.getItem('oauth_state');
          if (state && storedState && state !== storedState) {
            throw new Error('Invalid state parameter. Possible CSRF attack.');
          }
          sessionStorage.removeItem('oauth_state');
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Exchange code for tokens
        const redirectUri = `${window.location.origin}/auth/callback`;
        const tokens = await CognitoDirectAuth.exchangeCodeForTokens(code, redirectUri);

        // Parse user info from ID token
        const userInfo = CognitoDirectAuth.parseIdToken(tokens.idToken);

        // Store tokens (email may be undefined for some auth methods)
        CognitoDirectAuth.storeTokens(tokens, userInfo.email);

        // Redirect to API keys page
        router.push('/api-keys');
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Completing sign in...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="mb-4 text-red-500 text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Authentication Error
          </h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Redirecting to sign in page...
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
