'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RedirectClient() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <p className="text-muted-foreground">
      Redirecting to home page in 3 seconds...
    </p>
  );
}

