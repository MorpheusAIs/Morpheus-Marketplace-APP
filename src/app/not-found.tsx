import React from 'react';
import Link from 'next/link';
import { RedirectClient } from './not-found-client';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl font-bold text-purple-400">404</div>
        
        <h1 className="text-3xl font-bold text-foreground">
          Page Not Found
        </h1>
        
        <p className="text-muted-foreground text-lg">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="space-y-4">
          <RedirectClient />
          
          <Link 
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Go to Home Now
          </Link>
        </div>
        
        <div className="pt-8 space-y-2">
          <p className="text-sm text-gray-500">Quick Links:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/api-keys" className="text-purple-400 hover:text-purple-300 underline">
              API Keys
            </Link>
            <Link href="/chat" className="text-purple-400 hover:text-purple-300 underline">
              Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

