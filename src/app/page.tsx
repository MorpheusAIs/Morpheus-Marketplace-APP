'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCognitoAuth();

  // Redirect users based on authentication status
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/api-keys');
      } else {
        router.push('/signin');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-[var(--platinum)]">Loading...</div>
      </div>
    );
  }

  // This should not render as users will be redirected, but included as fallback
  return null;
}
