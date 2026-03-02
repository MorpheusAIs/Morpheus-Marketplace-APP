'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CognitoDirectAuth } from './cognito-direct-auth';
import { authEvents } from './auth-events';
import { API_URLS } from '@/lib/api/config';
import { apiGet } from '@/lib/api/apiService';
import { useNotification } from '@/lib/NotificationContext';
import { safeJsonParseOrNull } from '@/lib/utils/safe-json';
import { CognitoUser } from '@/lib/types/cognito';

interface ApiKey {
  id: number;
  key_prefix: string;
  name: string;
  created_at: string;
  is_active: boolean;
  is_default: boolean;
}

interface CognitoAuthContextType {
  user: CognitoUser | null;
  accessToken: string | null;
  idToken: string | null;
  apiKeys: ApiKey[];
  defaultApiKey: ApiKey | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ requiresConfirmation: true; email: string }>;
  confirmSignUp: (email: string, confirmationCode: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, confirmationCode: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshApiKeys: () => Promise<void>;
  refreshUserAttributes: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
  socialLogin: (provider: 'Google' | 'GitHub' | 'X') => void;
}

const CognitoAuthContext = createContext<CognitoAuthContextType | undefined>(undefined);

export function CognitoAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [defaultApiKey, setDefaultApiKey] = useState<ApiKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();

  // Access the global notification system
  const { success, error, warning, info } = useNotification();

  // Check for stored tokens and initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  // Listen for 401 Unauthorized events from the API layer.
  // When a session expires mid-use, this clears auth state and redirects to sign-in
  // so users don't remain in a "ghost" session with broken data.
  useEffect(() => {
    const unsubscribe = authEvents.onUnauthorized(() => {
      console.warn('Session expired — logging out and redirecting to sign-in');
      logout();
      warning(
        'Session Expired',
        'Your session has expired. Please sign in again.',
        { duration: 6000 }
      );
      router.push('/signin');
    });
    return unsubscribe;
  }, [router]);

  // Proactive session health monitor.
  // Detects expired sessions while the user is idle (e.g., leaving the API keys
  // page open for >1 hour) so the UI redirects to sign-in immediately instead of
  // waiting until the user tries an action and gets an error (MOR-334 follow-up).
  const isAuthenticatedRef = useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = !!user || !!accessToken;
  }, [user, accessToken]);

  useEffect(() => {
    // Only run the monitor on the client
    if (typeof document === 'undefined') return;

    const checkSession = async () => {
      // Skip if user is not authenticated (nothing to monitor)
      if (!isAuthenticatedRef.current) return;

      const token = await CognitoDirectAuth.getValidAccessToken();
      if (!token && isAuthenticatedRef.current) {
        console.warn('Session monitor: token refresh failed — emitting unauthorized event');
        authEvents.emitUnauthorized();
      } else if (token) {
        // Keep React state in sync with the (possibly refreshed) token so that
        // components reading `accessToken` from context always get the latest
        // value instead of the stale original token from sign-in.
        setAccessToken(prev => prev !== token ? token : prev);
        const tokens = CognitoDirectAuth.getStoredTokens();
        if (tokens) {
          setIdToken(prev => prev !== tokens.idToken ? tokens.idToken : prev);
        }
      }
    };

    // Check when the tab becomes visible again (covers the "left browser open
    // for 61 min, then switched back" scenario)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    // Periodic check every 60 seconds as a fallback for users who stay on the
    // same tab without switching away
    const intervalId = setInterval(checkSession, 60_000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const initializeAuth = async () => {
    setIsLoading(true);
    
    try {
      // Try to get a valid access token (will refresh if needed)
      const validAccessToken = await CognitoDirectAuth.getValidAccessToken();
      
      if (validAccessToken) {
        const tokens = CognitoDirectAuth.getStoredTokens();
        if (tokens) {
          setAccessToken(validAccessToken);
          setIdToken(tokens.idToken);
          
          // Parse user info from ID token
          const userInfo = CognitoDirectAuth.parseIdToken(tokens.idToken);
          setUser(userInfo);
          
          // Fetch API keys
          await fetchApiKeys(validAccessToken);
        }
      }
    } catch (error) {
      // Check if this is an expected error (e.g., NotAuthorizedException after password reset)
      const errorName = error && typeof error === 'object' && 'name' in error ? (error as { name?: string }).name : '';
      // Only log unexpected errors - NotAuthorizedException is expected when tokens are invalid
      if (errorName !== 'NotAuthorizedException') {
        console.error('Error initializing auth:', error);
      }
      // Clear any invalid tokens
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApiKeys = async (token: string) => {
    try {
      const response = await apiGet<ApiKey[]>(API_URLS.keys(), token);
      if (response.data) {
        // Store ALL API keys (including deleted ones) so usage analytics can match them
        // The UI components will filter to show only active keys
        setApiKeys(response.data);

        const activeKeys = response.data.filter(key => key.is_active);

        // Determine default key from active keys only. If backend cache briefly
        // omits is_default after mutations, fall back to the user's selected key
        // (and finally to the only active key when there is exactly one).
        const defaultKeyFromApi = activeKeys.find(key => key.is_default);
        const selectedPrefix = localStorage.getItem('selected_api_key_prefix');
        const selectedActiveKey = selectedPrefix
          ? activeKeys.find(key => key.key_prefix === selectedPrefix)
          : null;
        const singleActiveKey = activeKeys.length === 1 ? activeKeys[0] : null;
        const resolvedDefaultKey = defaultKeyFromApi ?? selectedActiveKey ?? singleActiveKey ?? null;
        setDefaultApiKey(resolvedDefaultKey);

        if (activeKeys.length > 0) {
          // Auto-select first API key if no key is already selected
          await autoSelectFirstApiKey(token);
        } else {
          // No active keys — clear any cached credentials so the sidebar
          // correctly disables Test/Chat even if the backend cache is stale
          sessionStorage.removeItem('verified_api_key');
          sessionStorage.removeItem('verified_api_key_prefix');
          sessionStorage.removeItem('verified_api_key_timestamp');
          sessionStorage.removeItem('verified_api_key_name');
          localStorage.removeItem('selected_api_key_prefix');

          // Notify the user they need to create an API key to use Chat and Test
          info(
            'Welcome!',
            'To get started with Chat and Test, please create your first API key in the Api Keys page.',
            {
              actionLabel: 'Create API Key',
              actionUrl: '/api-keys',
              duration: 10000,
            }
          );
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const autoSelectFirstApiKey = async (token: string) => {
    try {
      // Check if we already have a valid API key selected
      const storedApiKey = sessionStorage.getItem('verified_api_key');
      const storedTimestamp = sessionStorage.getItem('verified_api_key_timestamp');
      
      if (storedApiKey && storedTimestamp) {
        const keyAge = Date.now() - parseInt(storedTimestamp);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        // If we have a valid stored key, don't auto-select
        if (keyAge < twentyFourHours) {
          return;
        }
      }

      // First try to get the decrypted default key for seamless experience
      const decryptedResponse = await fetch(API_URLS.defaultKeyDecrypted(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (decryptedResponse.ok) {
        // Safely parse response to prevent deep recursion attacks
        const responseText = await decryptedResponse.text();
        const decryptedData = safeJsonParseOrNull(responseText, { maxDepth: 100 });
        if (!decryptedData) {
          throw new Error('Failed to parse response or response exceeds maximum depth');
        }
        
        // Check if the response contains an error (even with 200 OK status)
        if (decryptedData.error || decryptedData.error_code) {
          console.warn('⚠️ Default API key auto-decryption failed:', decryptedData.error_code || decryptedData.error);
          console.log('User will need to manually select and verify their API key in the Admin page');
          
          // Show user-friendly notification using the global notification system
          warning(
            'API Key Verification Required',
            'A Default API key must be set and verified before using the "Test" features. Go to API Keys tab to set your Default API Key.',
            {
              actionLabel: 'Go to API Keys',
              actionUrl: '/api-keys',
              duration: 10000,
            }
          );
          
          // Don't store anything - let the user manually select/verify
          // This prevents the redirect loop where chat/test pages keep sending them back to admin
          return;
        }
        
        if (decryptedData && decryptedData.full_key) {
          // Store the decrypted key immediately for seamless Chat/Test access
          sessionStorage.setItem('verified_api_key', decryptedData.full_key);
          sessionStorage.setItem('verified_api_key_prefix', decryptedData.key_prefix);
          sessionStorage.setItem('verified_api_key_timestamp', Date.now().toString());
          localStorage.setItem('selected_api_key_prefix', decryptedData.key_prefix);
          
          // Set the default key metadata
          setDefaultApiKey({
            id: decryptedData.id,
            key_prefix: decryptedData.key_prefix,
            name: decryptedData.name,
            created_at: decryptedData.created_at,
            is_active: true,
            is_default: decryptedData.is_default
          });
          
          console.log('🔐 Auto-selected and decrypted default API key:', decryptedData.key_prefix);
          
          // Show success notification using the global notification system
          success(
            'API Key Ready',
            `Your default API key (${decryptedData.key_prefix}...) has been automatically verified. You can now use Chat and Test!`
          );
          
          return;
        }
      }

      // If we reach here, decryption failed or no default key exists
      // Fetch the default key metadata (without full key) just to show in UI
      const defaultKeyResponse = await apiGet<ApiKey>(API_URLS.defaultKey(), token);
      
      if (defaultKeyResponse.data) {
        const defaultKey = defaultKeyResponse.data;
        setDefaultApiKey(defaultKey);
        
        console.log(`ℹ️ Default API key found but not auto-decrypted: ${defaultKey.key_prefix}... (${defaultKey.name})`);
        console.log('User can manually verify it by clicking "Select" in the Admin page');
        
        // Show informational notification using the global notification system
        info(
          'API Key Available',
          'A Default API key must be set and verified before using the "Test" features. Go to API Keys tab to set your Default API Key.',
          {
            actionLabel: 'Go to API Keys',
            actionUrl: '/api-keys',
            duration: 8000,
          }
        );
        
        // IMPORTANT: Do NOT store the prefix in localStorage here
        // This prevents the redirect loop where chat/test pages detect an unverified key
        // and keep redirecting back to admin
      } else {
        // No API keys found - this is a first-time user
        console.log('No API keys found - user needs to create their first API key');
        
        // Show welcome notification for first-time users using the global notification system
        info(
          'Welcome!',
          'To get started with Chat and Test, please create your first API key in the Api Keys page.',
          {
            actionLabel: 'Create API Key',
            actionUrl: '/api-keys',
            duration: 10000,
          }
        );
      }
    } catch (err) {
      console.error('Error auto-selecting first API key:', err);
      
      // Show error notification using the global notification system
      error(
        'API Key Setup Error',
        'There was an issue setting up your API key. Please visit the Api Keys page to manually select one.',
        {
          actionLabel: 'Go to API Keys',
          actionUrl: '/api-keys',
          duration: 10000,
        }
      );
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Clear any existing tokens before signing in (important after password reset)
      // This prevents using stale refresh tokens that may have been invalidated
      CognitoDirectAuth.clearTokens();
      
      // Sign in with Cognito
      const tokens = await CognitoDirectAuth.signIn(email, password);
      
      // Store tokens
      CognitoDirectAuth.storeTokens(tokens, email);
      
      // Set tokens in state
      setAccessToken(tokens.accessToken);
      setIdToken(tokens.idToken);
      
      // Parse user info
      const userInfo = CognitoDirectAuth.parseIdToken(tokens.idToken);
      setUser(userInfo);
      
      // Fetch API keys
      await fetchApiKeys(tokens.accessToken);
      
    } catch (err) {
      // Check error type - AWS SDK errors have a 'name' property
      const errorName = err && typeof err === 'object' && 'name' in err 
        ? (err as { name?: string }).name 
        : '';
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      
      // Don't show generic error notifications for specific error types
      // These will be handled in the UI with custom messages
      if (errorName === 'NotAuthorizedException') {
        // Don't show error notification for NotAuthorizedException during sign-in
        // as it might be from a background refresh attempt
        console.warn('Sign in error (may be from background operation):', errorMessage);
      } else if (errorName === 'UserNotFoundException') {
        // Don't show generic error - let the UI handle it with custom message and signup link
        console.log('User not found:', errorMessage);
      } else {
        // Show error notification for other unexpected errors
        console.error('Error signing in:', err);
        error('Sign In Failed', errorMessage);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<{ requiresConfirmation: true; email: string }> => {
    try {
      setIsLoading(true);
      
      // Sign up with Cognito
      await CognitoDirectAuth.signUp(email, password);
      
      // Store email and password temporarily for confirmation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_signup_email', email);
        sessionStorage.setItem('pending_signup_password', password);
      }
      
      // Return email for confirmation page
      return { requiresConfirmation: true as const, email };
    } catch (err) {
      console.error('Error signing up:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      error('Sign Up Failed', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignUp = async (email: string, confirmationCode: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Confirm signup with Cognito
      await CognitoDirectAuth.confirmSignUp(email, confirmationCode);
      
      // Clear pending signup data
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_signup_email');
        sessionStorage.removeItem('pending_signup_password');
      }
      
      // Automatically sign in after confirmation
      await signIn(email, password);
      
      success('Account Confirmed', 'Your account has been confirmed and you are now signed in!');
    } catch (err) {
      console.error('Error confirming signup:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm account';
      error('Confirmation Failed', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Fire-and-forget server-side token revocation so the refresh token is
    // invalidated immediately across all sessions/devices.  Read before
    // clearTokens() so the token is still in localStorage.
    const storedTokens = CognitoDirectAuth.getStoredTokens();
    if (storedTokens?.refreshToken) {
      CognitoDirectAuth.revokeRefreshToken(storedTokens.refreshToken).catch(err => {
        console.warn('Failed to revoke refresh token on logout (non-fatal):', err);
      });
    }

    setUser(null);
    setAccessToken(null);
    setIdToken(null);
    setApiKeys([]);
    setDefaultApiKey(null);

    // Clear API key storage
    sessionStorage.removeItem('verified_api_key');
    sessionStorage.removeItem('verified_api_key_prefix');
    sessionStorage.removeItem('verified_api_key_timestamp');
    localStorage.removeItem('selected_api_key_prefix');

    // Clear Cognito tokens
    CognitoDirectAuth.clearTokens();
  };

  const refreshApiKeys = async () => {
    const validToken = await CognitoDirectAuth.getValidAccessToken();
    if (validToken) {
      await fetchApiKeys(validToken);
    }
  };

  const refreshUserAttributes = async () => {
    try {
      const validToken = await CognitoDirectAuth.getValidAccessToken();
      if (!validToken) {
        throw new Error('No valid access token available');
      }

      // Import GetUserCommand dynamically to avoid build-time issues
      const { GetUserCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const { CognitoIdentityProviderClient } = await import('@aws-sdk/client-cognito-identity-provider');
      const { cognitoConfig } = await import('@/lib/auth/cognito-config');
      
      // Create Cognito client
      const cognitoClient = new CognitoIdentityProviderClient({
        region: cognitoConfig.region,
      });

      // Fetch fresh user attributes from Cognito
      const getUserCommand = new GetUserCommand({
        AccessToken: validToken,
      });
      
      const userResponse = await cognitoClient.send(getUserCommand);
      
      // Extract user attributes
      const attributes = userResponse.UserAttributes || [];
      const emailAttribute = attributes.find(attr => attr.Name === 'email');
      const emailVerifiedAttribute = attributes.find(attr => attr.Name === 'email_verified');
      
      // Update user object with fresh attributes
      if (user) {
        const updatedUser: CognitoUser = {
          ...user,
          email: emailAttribute?.Value || user.email,
          email_verified: emailVerifiedAttribute?.Value === 'true',
        };
        setUser(updatedUser);
        console.log('✅ User attributes refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing user attributes:', error);
      throw error;
    }
  };

  const getValidToken = async () => {
    const token = await CognitoDirectAuth.getValidAccessToken();
    if (token && token !== accessToken) {
      setAccessToken(token);
    }
    // If token refresh failed while the user appeared authenticated, the
    // Cognito refresh token has also expired (hours-long idle session).
    // Emit the unauthorized event so the auth listener triggers logout +
    // redirect to sign-in — preventing a ghost session where the UI stays
    // accessible but all API calls fail silently.
    if (!token && (user !== null || accessToken !== null)) {
      console.warn('getValidToken: refresh token expired — emitting unauthorized event');
      authEvents.emitUnauthorized();
    }
    return token;
  };

  const socialLogin = (provider: 'Google' | 'GitHub' | 'X') => {
    if (typeof window === 'undefined') return;
    
    const redirectUri = `${window.location.origin}/auth/callback`;
    CognitoDirectAuth.initiateSocialLogin(provider, redirectUri);
  };

  const forgotPassword = async (email: string) => {
    try {
      setIsLoading(true);
      await CognitoDirectAuth.forgotPassword(email);
      success('Reset Code Sent', 'A password reset code has been sent to your email address.');
    } catch (err) {
      console.error('Error requesting password reset:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset code';
      error('Password Reset Failed', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmForgotPassword = async (email: string, confirmationCode: string, newPassword: string) => {
    try {
      setIsLoading(true);
      
      // Clear any existing tokens before confirming password reset
      // Old tokens become invalid after password reset, so we should clear them
      CognitoDirectAuth.clearTokens();
      logout(); // Also clear auth state
      
      await CognitoDirectAuth.confirmForgotPassword(email, confirmationCode, newPassword);
      success('Password Reset', 'Your password has been reset successfully. You can now sign in with your new password.');
    } catch (err) {
      console.error('Error confirming password reset:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
      error('Password Reset Failed', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    accessToken,
    idToken,
    apiKeys,
    defaultApiKey,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    signIn,
    signUp,
    confirmSignUp,
    forgotPassword,
    confirmForgotPassword,
    logout,
    refreshApiKeys,
    refreshUserAttributes,
    getValidToken,
    socialLogin,
  };

  return (
    <CognitoAuthContext.Provider value={value}>
      {children}
    </CognitoAuthContext.Provider>
  );
}

export function useCognitoAuth() {
  const context = useContext(CognitoAuthContext);
  if (context === undefined) {
    throw new Error('useCognitoAuth must be used within a CognitoAuthProvider');
  }
  return context;
}
