import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RedirectClient } from './not-found-client';
import { Home, Key, MessageSquare } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <img
          src="/images/mor_mark_white.png"
          alt="Morpheus Logo"
          className="h-8 w-auto"
        />
        <span className="text-2xl font-semibold text-foreground">API Gateway</span>
      </div>
      
      <Card className="w-full max-w-[500px] mx-auto bg-card text-card-foreground rounded-lg shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="text-7xl font-bold text-green-500">404</div>
          <CardTitle className="text-3xl font-bold text-card-foreground">
            Page Not Found
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <RedirectClient />
          
          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="w-full bg-green-500 hover:bg-green-600 text-white"
            >
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </Link>
            </Button>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3 text-center">Quick Links:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                asChild
                className="border-border hover:bg-accent hover:text-accent-foreground"
              >
                <Link href="/api-keys">
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-border hover:bg-accent hover:text-accent-foreground"
              >
                <Link href="/chat">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

