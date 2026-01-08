"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Mail, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";

function ForgotPasswordContent() {
  const router = useRouter();
  const { forgotPassword, confirmForgotPassword, isAuthenticated, isLoading } = useCognitoAuth();
  
  // Check if we're in the reset confirmation step (code in URL or email in sessionStorage)
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/api-keys');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check if we have email in sessionStorage (from previous step)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = sessionStorage.getItem('password_reset_email');
      if (storedEmail) {
        setEmail(storedEmail);
        setStep("confirm");
      }
    }
  }, []);

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

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      // Store email in sessionStorage for the confirmation step
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('password_reset_email', email);
      }
      setStep("confirm");
      setSuccessMessage("A password reset code has been sent to your email address.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!confirmationCode.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields");
      return;
    }

    // Validate password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmForgotPassword(email, confirmationCode, newPassword);
      // Clear stored email
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('password_reset_email');
      }
      setSuccessMessage("Your password has been reset successfully!");
      // Redirect to sign in after a short delay
      setTimeout(() => {
        router.push("/signin");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToRequest = () => {
    setStep("request");
    setConfirmationCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
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
            <CardTitle className="text-3xl font-bold text-foreground">
              {step === "request" ? "Reset Password" : "Enter Reset Code"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === "request"
                ? "Enter your email address and we'll send you a password reset code."
                : `We've sent a password reset code to ${email}. Enter it below with your new password.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "request" ? (
              <form className="space-y-6 mt-6" onSubmit={handleRequestReset}>
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
                        autoComplete="email"
                        required
                      />
                    </div>
                  </Field>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  {successMessage && (
                    <p className="text-sm text-green-500">{successMessage}</p>
                  )}
                  <Field>
                    <Button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      disabled={isSubmitting}
                    >
                      <span>Send Reset Code</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    Remember your password?{" "}
                    <Link href="/signin" className="text-green-500 hover:underline">
                      Sign in
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            ) : (
              <form className="space-y-6 mt-6" onSubmit={handleConfirmReset}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="code">Reset Code</FieldLabel>
                    <Input
                      id="code"
                      type="text"
                      placeholder="123456"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-lg tracking-widest bg-input text-input-foreground border-border"
                      required
                      maxLength={6}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 chars, upper/lower/number/symbol"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10 bg-input text-input-foreground border-border"
                        autoComplete="new-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10 bg-input text-input-foreground border-border"
                        autoComplete="new-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </Field>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  {successMessage && (
                    <p className="text-sm text-green-500">{successMessage}</p>
                  )}
                  <Field>
                    <Button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      disabled={isSubmitting}
                    >
                      <span>Reset Password</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Field>
                  <Field>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleBackToRequest}
                      className="w-full text-muted-foreground"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      <span>Back to request code</span>
                    </Button>
                  </Field>
                  <FieldDescription className="text-center">
                    Remember your password?{" "}
                    <Link href="/signin" className="text-green-500 hover:underline">
                      Sign in
                    </Link>
                  </FieldDescription>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
