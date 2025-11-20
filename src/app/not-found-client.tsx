'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function RedirectClient() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="text-sm text-muted-foreground text-center">
      Redirecting to home page in {countdown} second{countdown !== 1 ? 's' : ''}...
    </p>
  );
}

