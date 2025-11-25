'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function RedirectClient() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Separate effect to handle navigation when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0) {
      // Use setTimeout to ensure this runs after the current render cycle
      const timeoutId = setTimeout(() => {
        router.push('/');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [countdown, router]);

  return (
    <p className="text-sm text-muted-foreground text-center">
      Redirecting to home page in {countdown} second{countdown !== 1 ? 's' : ''}...
    </p>
  );
}

