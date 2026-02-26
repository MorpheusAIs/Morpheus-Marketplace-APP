'use client';

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoConfig } from './cognito-config';
import { CognitoTokens } from '@/lib/types/cognito';
import { safeJsonParseOrNull } from '@/lib/utils/safe-json';

// Lazy initialization of Cognito client to avoid build-time errors
let cognitoClient: CognitoIdentityProviderClient | null = null;

function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    });
  }
  return cognitoClient;
}

// Mutex to prevent concurrent token refresh attempts from racing each other.
// When multiple callers (session monitor, API interceptor, user action) all
// detect an expiring token at the same time, only one refresh request is sent.
let refreshPromise: Promise<string | null> | null = null;

export class CognitoDirectAuth {
  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string): Promise<CognitoTokens> {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: cognitoConfig.userPoolClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    try {
      const response = await getCognitoClient().send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed - no tokens received');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
      };
    } catch (err) {
      // Log full error details for debugging
      console.error('Cognito signIn error details:', {
        error: err,
        name: err && typeof err === 'object' && 'name' in err ? (err as { name?: string }).name : undefined,
        message: err instanceof Error ? err.message : String(err),
        code: err && typeof err === 'object' && '$metadata' in err ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined,
        fullError: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
      });
      throw err;
    }
  }

  /**
   * Sign up with email and password
   */
  static async signUp(email: string, password: string): Promise<void> {
    const command = new SignUpCommand({
      ClientId: cognitoConfig.userPoolClientId,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
      ],
    });

    await getCognitoClient().send(command);
  }

  /**
   * Confirm sign up with confirmation code
   */
  static async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    const command = new ConfirmSignUpCommand({
      ClientId: cognitoConfig.userPoolClientId,
      Username: email,
      ConfirmationCode: confirmationCode,
    });

    await getCognitoClient().send(command);
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshTokens(refreshToken: string): Promise<CognitoTokens> {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: cognitoConfig.userPoolClientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await getCognitoClient().send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Token refresh failed');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: refreshToken, // Keep the same refresh token
    };
  }

  /**
   * Store tokens in localStorage
   */
  static storeTokens(tokens: CognitoTokens, email?: string): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('cognito_access_token', tokens.accessToken);
    localStorage.setItem('cognito_id_token', tokens.idToken);
    localStorage.setItem('cognito_refresh_token', tokens.refreshToken);
    
    // Only store email if provided (may not be available for some auth methods)
    if (email) {
      localStorage.setItem('cognito_user_email', email);
    } else {
      localStorage.removeItem('cognito_user_email');
    }
  }

  /**
   * Get stored tokens from localStorage
   */
  static getStoredTokens(): CognitoTokens | null {
    if (typeof window === 'undefined') return null;
    
    const accessToken = localStorage.getItem('cognito_access_token');
    const idToken = localStorage.getItem('cognito_id_token');
    const refreshToken = localStorage.getItem('cognito_refresh_token');
    
    if (!accessToken || !idToken || !refreshToken) {
      return null;
    }
    
    return {
      accessToken,
      idToken,
      refreshToken,
    };
  }

  /**
   * Get stored email
   */
  static getStoredEmail(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('cognito_user_email');
  }

  /**
   * Clear all stored tokens
   */
  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('cognito_access_token');
    localStorage.removeItem('cognito_id_token');
    localStorage.removeItem('cognito_refresh_token');
    localStorage.removeItem('cognito_user_email');
  }

  /**
   * Check if access token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const payload = token.split('.')[1];
      const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      // JWT tokens are small and controlled, but use safe parser for defense-in-depth
      const decoded = safeJsonParseOrNull(decodedPayload, { maxDepth: 10, maxSize: 8192 }); // 8KB max for JWT
      if (!decoded) {
        return true; // Assume expired if we can't parse
      }
      const exp = decoded.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch {
      return true; // Assume expired if we can't parse
    }
  }

  /**
   * Check if access token will expire within the given buffer period.
   * Used for proactive refresh — when both access and refresh tokens share
   * a similar TTL (~1 hour), waiting until the access token is fully expired
   * means the refresh token is ALSO expired and the refresh call fails.
   * By refreshing early we get a fresh access token while the refresh token
   * is still valid.
   */
  static isTokenExpiringSoon(token: string, bufferMs: number = 5 * 60 * 1000): boolean {
    try {
      const payload = token.split('.')[1];
      const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = safeJsonParseOrNull(decodedPayload, { maxDepth: 10, maxSize: 8192 });
      if (!decoded) {
        return true; // Assume expiring if we can't parse
      }
      const exp = decoded.exp * 1000; // Convert to milliseconds
      return Date.now() >= (exp - bufferMs);
    } catch {
      return true; // Assume expiring if we can't parse
    }
  }

  /**
   * Get valid access token, refreshing proactively if it will expire soon.
   *
   * Key behaviour:
   * - If the token is fresh (>5 min remaining) → return it immediately.
   * - If the token will expire within 5 min → proactively refresh so the
   *   session survives even when the Cognito refresh-token TTL is short (~1h).
   * - Concurrent callers share a single in-flight refresh (mutex) to avoid
   *   race conditions where parallel refreshes invalidate each other.
   * - If proactive refresh fails but the access token hasn't expired yet,
   *   the current token is returned instead of logging the user out.
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();
    if (!tokens) return null;

    // Token is fresh — no refresh needed
    if (!this.isTokenExpiringSoon(tokens.accessToken)) {
      return tokens.accessToken;
    }

    // Token is expiring soon (or already expired) — need to refresh.
    // Deduplicate concurrent refresh requests via a shared promise.
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = this._performTokenRefresh(tokens).finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  /**
   * Internal: performs the actual token refresh with graceful fallback.
   */
  private static async _performTokenRefresh(tokens: CognitoTokens): Promise<string | null> {
    try {
      const newTokens = await this.refreshTokens(tokens.refreshToken);
      const email = this.getStoredEmail();
      if (email) {
        this.storeTokens(newTokens, email);
      }
      return newTokens.accessToken;
    } catch (err) {
      const errorName = err && typeof err === 'object' && 'name' in err ? (err as any).name : '';
      if (errorName !== 'NotAuthorizedException') {
        console.error('Error refreshing token:', err);
      }

      // If the access token hasn't actually expired yet (we were refreshing
      // proactively), return it so the user's session continues until it does.
      if (!this.isTokenExpired(tokens.accessToken)) {
        console.log('Proactive refresh failed but access token still valid — continuing session');
        return tokens.accessToken;
      }

      // Token is truly expired and refresh failed — session is dead
      this.clearTokens();
      return null;
    }
  }

  /**
   * Parse user info from ID token
   */
  static parseIdToken(idToken: string): {
    sub: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  } {
    try {
      const payload = idToken.split('.')[1];
      const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      // JWT tokens are small and controlled, but use safe parser for defense-in-depth
      const decoded = safeJsonParseOrNull(decodedPayload, { maxDepth: 10, maxSize: 8192 }); // 8KB max for JWT
      if (!decoded) {
        throw new Error('Failed to parse JWT token');
      }
      
      return {
        sub: decoded.sub,
        email: decoded.email || undefined,  // May not be present in some auth flows
        name: decoded.name || undefined,
        given_name: decoded.given_name || undefined,
        family_name: decoded.family_name || undefined,
      };
    } catch (error) {
      throw new Error('Failed to parse ID token');
    }
  }

  /**
   * Exchange authorization code for tokens (OAuth flow)
   */
  static async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CognitoTokens> {
    const tokenEndpoint = `https://${cognitoConfig.domain}/oauth2/token`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognitoConfig.userPoolClientId,
      code: code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    // Safely parse response to prevent deep recursion attacks
    const responseText = await response.text();
    const data = safeJsonParseOrNull(responseText, { maxDepth: 100 });
    if (!data) {
      throw new Error('Failed to parse response or response exceeds maximum depth');
    }

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Generate state parameter for OAuth flow (CSRF protection)
   */
  static generateState(): string {
    if (typeof window === 'undefined') {
      // Server-side: generate random string
      return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    } else {
      // Client-side: use Web Crypto API
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
  }

  /**
   * Initiate social login redirect
   */
  static initiateSocialLogin(provider: 'Google' | 'GitHub' | 'X', redirectUri: string): void {
    if (typeof window === 'undefined') return;

    const state = this.generateState();
    sessionStorage.setItem('oauth_state', state);

    // Map provider names to Cognito identity provider names
    const providerMap: Record<string, string> = {
      'Google': 'Google',
      'GitHub': 'GitHub',
      'X': 'Twitter', // Cognito uses 'Twitter' for X/Twitter
    };

    const cognitoProviderName = providerMap[provider] || provider;
    
    const authUrl = new URL(`https://${cognitoConfig.domain}/oauth2/authorize`);
    authUrl.searchParams.set('client_id', cognitoConfig.userPoolClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('identity_provider', cognitoProviderName);

    window.location.href = authUrl.toString();
  }

  /**
   * Request password reset code
   */
  static async forgotPassword(email: string): Promise<void> {
    const command = new ForgotPasswordCommand({
      ClientId: cognitoConfig.userPoolClientId,
      Username: email,
    });

    await getCognitoClient().send(command);
  }

  /**
   * Confirm password reset with code and new password
   */
  static async confirmForgotPassword(
    email: string,
    confirmationCode: string,
    newPassword: string
  ): Promise<void> {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: cognitoConfig.userPoolClientId,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    });

    await getCognitoClient().send(command);
  }
}
