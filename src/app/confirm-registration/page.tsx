"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight } from "lucide-react";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";

function ConfirmRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmSignUp, isAuthenticated, isLoading: authLoading } = useCognitoAuth();
  
  const [email, setEmail] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Get email from query params or sessionStorage
  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    const emailFromStorage = typeof window !== 'undefined' 
      ? sessionStorage.getItem('pending_signup_email') 
      : null;
    const passwordFromStorage = typeof window !== 'undefined'
      ? sessionStorage.getItem('pending_signup_password')
      : null;
    
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    } else if (emailFromStorage) {
      setEmail(emailFromStorage);
    }
    
    if (passwordFromStorage) {
      setPassword(passwordFromStorage);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/api-keys');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !confirmationCode.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (confirmationCode.length !== 6) {
      setError("Confirmation code must be 6 digits");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get password from sessionStorage if not already set
      const passwordToUse = password || (typeof window !== 'undefined' 
        ? sessionStorage.getItem('pending_signup_password') || ''
        : '');
      
      if (!passwordToUse) {
        setError("Password not found. Please sign up again.");
        router.push("/signup");
        return;
      }

      await confirmSignUp(email, confirmationCode, passwordToUse);
      router.push("/api-keys");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-foreground">
              Confirm Your Account
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the confirmation code sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@mor.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-input text-input-foreground border-border"
                    required
                    disabled={!!searchParams.get("email")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmation-code">Confirmation Code</Label>
                <Input
                  id="confirmation-code"
                  type="text"
                  placeholder="123456"
                  value={confirmationCode}
                  onChange={(e) => {
                    // Only allow digits and limit to 6 characters
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setConfirmationCode(value);
                  }}
                  className="text-center text-lg tracking-widest bg-input text-input-foreground border-border"
                  required
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Check your email for the 6-digit confirmation code
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center space-x-2"
                disabled={isSubmitting}
              >
                <span>Confirm Account</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center justify-center text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <Link href="/signup" className="text-green-500 hover:underline ml-1">
              Sign up again
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function ConfirmRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ConfirmRegistrationContent />
    </Suspense>
  );
}

