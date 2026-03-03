'use client';

import { useEffect, useState } from 'react';
import { CognitoDirectAuth } from '@/lib/auth/cognito-direct-auth';
import type { CognitoTokens, CognitoUser } from '@/lib/types/cognito';
import { checkRegistrationAllowed, getFingerprint } from '@/lib/fingerprint';
import type { FingerprintData } from '@/lib/fingerprint/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokens: CognitoTokens, userInfo: CognitoUser) => void;
}

type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageConsent, setAgeConsent] = useState(false);
  const [fingerprintData, setFingerprintData] = useState<FingerprintData | null>(null);

  useEffect(() => {
    if (mode === 'signup') {
      getFingerprint()
        .then(setFingerprintData)
        .catch((err) => console.warn('Fingerprint collection failed:', err));
    }
  }, [mode]);

  // Prevent SSR issues
  if (typeof window === 'undefined') return null;
  if (!isOpen) return null;

  const isValidEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validatePassword = (value: string): string | null => {
    if (value.length < 15) return 'Password must be at least 15 characters long';
    if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
    return null;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      const tokens = await CognitoDirectAuth.signIn(email, password);
      const userInfo = CognitoDirectAuth.parseIdToken(tokens.idToken);
      onSuccess(tokens, userInfo);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!ageConsent) {
      setError('You must certify that you are at least 18 years old to create an account');
      setIsLoading(false);
      return;
    }

    try {
      if (fingerprintData) {
        try {
          const checkResult = await checkRegistrationAllowed(email, fingerprintData);
          if (!checkResult.allowed) {
            setError(checkResult.reason || 'Account creation limit reached. Please contact support.');
            setIsLoading(false);
            return;
          }
        } catch (checkError) {
          console.warn('Fingerprint check failed, allowing registration:', checkError);
        }
      }

      await CognitoDirectAuth.signUp(email, password);
      if (fingerprintData) {
        sessionStorage.setItem('pending_signup_fingerprint', JSON.stringify({
          fingerprintHash: fingerprintData.fingerprintHash,
          deviceToken: fingerprintData.deviceToken,
        }));
      }
      setMode('confirm');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await CognitoDirectAuth.confirmSignUp(email, confirmationCode);

      try {
        const tokens = await CognitoDirectAuth.signIn(email, password);
        const userInfo = CognitoDirectAuth.parseIdToken(tokens.idToken);
        onSuccess(tokens, userInfo);
        onClose();
        resetForm();
      } catch {
        setMode('signin');
        setError('Account confirmed! Please sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      await CognitoDirectAuth.forgotPassword(email);
      setMode('reset');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await CognitoDirectAuth.confirmForgotPassword(email, confirmationCode, newPassword);
      setMode('signin');
      setError('');
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setConfirmationCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setConfirmationCode('');
    setNewPassword('');
    setError('');
    setAgeConsent(false);
    setMode('signin');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#106F48] via-[#022C33] to-[#88018B] p-6 rounded-lg max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          {/* Morpheus Logo */}
          <div className="w-4/5 mx-auto mb-6 flex items-center justify-center" style={{height: '80px'}}>
            <img
              src="/images/mor_mark_white.png"
              alt="Morpheus AI"
              className="w-full h-full object-contain"
            />
          </div>
          {/* Title */}
          <h2 className="text-white text-lg font-normal mb-6">
            {mode === 'signin' && 'Sign in with your email and password'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'confirm' && 'Confirm your email'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Enter reset code and new password'}
          </h2>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-xl"
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="block text-white text-sm mb-1">Email</label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="name@host.com"
              />
            </div>

            <div>
              <label htmlFor="signin-password" className="block text-white text-sm mb-1">Password</label>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="Password"
              />
            </div>

            <div className="text-left pt-2">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#106F48] hover:bg-[#0e5a3c] text-white p-3 rounded font-medium transition-colors disabled:opacity-50 mt-4"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="text-center text-white text-sm pt-4">
              Need an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Sign up
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="block text-white text-sm mb-1">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="name@host.com"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-white text-sm mb-1">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={15}
                autoComplete="new-password"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="Min 15 chars, upper/lower/number"
              />
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="block text-white text-sm mb-1">Confirm Password</label>
              <input
                id="signup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="Confirm Password"
              />
            </div>

            <label htmlFor="age-consent" className="flex items-start gap-3 cursor-pointer">
              <input
                id="age-consent"
                type="checkbox"
                checked={ageConsent}
                onChange={(e) => {
                  setAgeConsent(e.target.checked);
                  if (e.target.checked) setError('');
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-green-500 cursor-pointer"
              />
              <span className="text-xs text-white leading-relaxed opacity-80">
                <em>I certify that I am at least 18 years old and the minimum age required in my country to consent to use the Services.</em>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#106F48] hover:bg-[#0e5a3c] text-white p-3 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>

            <div className="text-center text-white text-sm">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* Confirmation Form */}
        {mode === 'confirm' && (
          <form onSubmit={handleConfirmSignUp} className="space-y-4">
            <div className="text-white text-sm mb-4">
              We&apos;ve sent a confirmation code to <strong>{email}</strong>. Please enter it below.
            </div>

            <div>
              <label htmlFor="confirm-code" className="block text-white text-sm mb-1">Confirmation Code</label>
              <input
                id="confirm-code"
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold text-center text-lg tracking-widest focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="123456"
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#106F48] hover:bg-[#0e5a3c] text-white p-3 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Confirming...' : 'Confirm Account'}
            </button>

            <div className="text-center text-white text-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-white text-sm mb-4">
              Enter your email address and we&apos;ll send you a password reset code.
            </div>

            <div>
              <label htmlFor="forgot-email" className="block text-white text-sm mb-1">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="name@host.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#106F48] hover:bg-[#0e5a3c] text-white p-3 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <div className="text-center text-white text-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* Password Reset Confirmation Form */}
        {mode === 'reset' && (
          <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
            <div className="text-white text-sm mb-4">
              We&apos;ve sent a password reset code to <strong>{email}</strong>. Enter it below with your new password.
            </div>

            <div>
              <label htmlFor="reset-code" className="block text-white text-sm mb-1">Reset Code</label>
              <input
                id="reset-code"
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold text-center text-lg tracking-widest focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="123456"
                maxLength={6}
              />
            </div>

            <div>
              <label htmlFor="reset-new-password" className="block text-white text-sm mb-1">New Password</label>
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={15}
                autoComplete="new-password"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="Min 15 chars, upper/lower/number"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-white text-sm mb-1">Confirm New Password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full p-3 bg-gray-100 border-0 rounded font-semibold focus:outline-none focus:ring-0 focus:bg-white"
                placeholder="Confirm New Password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#106F48] hover:bg-[#0e5a3c] text-white p-3 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Resetting password...' : 'Reset Password'}
            </button>

            <div className="text-center text-white text-sm">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Resend reset code
              </button>
              {' | '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
