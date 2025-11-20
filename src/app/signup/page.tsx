"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldSeparator, FieldDescription } from "@/components/ui/field";
import { Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading, socialLogin } = useCognitoAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/api-keys');
    }
  }, [isAuthenticated, isLoading, router]);

  // Password validation function to match Cognito password policy
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password against Cognito requirements
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp(email, password);
      // If confirmation is required, redirect to confirmation page
      if (result?.requiresConfirmation) {
        // Redirect to confirmation page with email in query params
        router.push(`/confirm-registration?email=${encodeURIComponent(result.email)}`);
      } else {
        router.push("/api-keys");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/images/mor_mark_white.png"
            alt="Morpheus Logo"
            className="h-8 w-auto"
          />
          <span className="text-2xl font-semibold text-foreground">API Gateway</span>
        </div>
        <Card className="w-full max-w-[400px] mx-auto p-6 bg-card text-card-foreground rounded-lg shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-foreground">Sign up</CardTitle>
            <CardDescription className="text-muted-foreground">
              Create a Morpheus account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6 mt-6" onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
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
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 bg-input text-input-foreground border-border"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {password && (
                    <div className="text-xs text-muted-foreground space-y-1 mt-2">
                      <div className={`flex items-center gap-2 ${password.length >= 8 ? 'text-green-500' : ''}`}>
                        <span>{password.length >= 8 ? '✓' : '○'}</span>
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-500' : ''}`}>
                        <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span>
                        <span>One uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-500' : ''}`}>
                        <span>{/[a-z]/.test(password) ? '✓' : '○'}</span>
                        <span>One lowercase letter</span>
                      </div>
                      <div className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-green-500' : ''}`}>
                        <span>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                        <span>One number</span>
                      </div>
                      <div className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : ''}`}>
                        <span>{/[^A-Za-z0-9]/.test(password) ? '✓' : '○'}</span>
                        <span>One special character</span>
                      </div>
                    </div>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10 bg-input text-input-foreground border-border"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Field>
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                <Field>
                  <Button
                    type="submit"
                    className="w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center space-x-2"
                    disabled={isSubmitting}
                  >
                    <span>Continue</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Field>
                {/* <Field>
                  <FieldSeparator className="w-full *:data-[slot=field-separator-content]:bg-card">
                    Or continue with
                  </FieldSeparator>
                </Field>
                <Field className="grid grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => socialLogin('X')}
                    className="flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path
                        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with X</span>
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => socialLogin('GitHub')}
                    className="flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path
                        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with GitHub</span>
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => socialLogin('Google')}
                    className="flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with Google</span>
                  </Button>
                </Field> */}
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link href="/signin" className="text-green-500 hover:underline">
                    Sign in
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

