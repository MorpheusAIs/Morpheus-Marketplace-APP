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

/**
 * Return a short fingerprint of a token for safe diagnostic logging.
 * Shows length + first/last 8 chars so we can compare tokens without
 * exposing the full value.
 */
function tokenFingerprint(token: string | null | undefined): string {
  if (!token) return '(empty)';
  if (token.length < 20) return `(${token.length} chars — suspiciously short)`;
  return `${token.length} chars [${token.slice(0, 8)}…${token.slice(-8)}]`;
}

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

      const tokens = {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
      };
      console.log('[Auth] Sign-in succeeded — refresh token fingerprint:', tokenFingerprint(tokens.refreshToken));
      return tokens;
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
   * Refresh access token using refresh token.
   *
   * Uses REFRESH_TOKEN_AUTH which is the standard auth flow for refreshing
   * tokens in a public client-side app without a client secret.
   * Requires ALLOW_REFRESH_TOKEN_AUTH in the Cognito App Client's ExplicitAuthFlows.
   *
   * IMPORTANT: When Cognito token rotation is enabled, each refresh response
   * includes a NEW refresh token and the old one is revoked.  We must persist
   * the new refresh token — reusing the old one will fail with
   * "NotAuthorizedException: Invalid Refresh Token."
   */
  static async refreshTokens(refreshToken: string): Promise<CognitoTokens> {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: cognitoConfig.userPoolClientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    try {
      const response = await getCognitoClient().send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Token refresh failed — no AuthenticationResult');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        // Use the rotated refresh token if Cognito returns one (token rotation
        // enabled), otherwise keep the original refresh token.
        refreshToken: response.AuthenticationResult.RefreshToken || refreshToken,
      };
    } catch (err) {
      console.error('Cognito refreshTokens error:', {
        name: err && typeof err === 'object' && 'name' in err ? (err as any).name : undefined,
        message: err instanceof Error ? err.message : String(err),
        code: err && typeof err === 'object' && '$metadata' in err
          ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined,
      });
      throw err;
    }
  }

  /**
   * Refresh tokens via the OAuth2 /oauth2/token endpoint.
   * Used as a fallback when InitiateAuth fails (e.g., for social login users
   * whose refresh tokens may only be valid through the hosted UI endpoint).
   */
  static async refreshTokensViaOAuth(refreshToken: string): Promise<CognitoTokens> {
    if (!cognitoConfig.domain) {
      throw new Error('Cognito domain not configured — cannot use OAuth token endpoint');
    }

    const tokenEndpoint = `https://${cognitoConfig.domain}/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cognitoConfig.userPoolClientId,
      refresh_token: refreshToken,
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
      console.error('OAuth token refresh failed:', errorText);
      throw new Error(`OAuth token refresh failed: ${response.status}`);
    }

    const responseText = await response.text();
    const data = safeJsonParseOrNull(responseText, { maxDepth: 100 });
    if (!data) {
      throw new Error('Failed to parse OAuth token refresh response');
    }

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      // OAuth endpoint returns a new refresh token when rotation is enabled
      refreshToken: data.refresh_token || refreshToken,
    };
  }

  /**
   * Store tokens in localStorage
   */
  static storeTokens(tokens: CognitoTokens, email?: string): void {
    if (typeof window === 'undefined') return;
    console.log('[Auth] Storing tokens — refresh token fingerprint:', tokenFingerprint(tokens.refreshToken));

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
   * Used for proactive refresh — by refreshing before the access token
   * expires we avoid a window where API calls fail with 401 before the
   * background monitor triggers a refresh.  The refresh token has a much
   * longer TTL (30 days) so it should always be valid when this fires.
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
   * - If the token will expire within 5 min → proactively refresh using the
   *   long-lived refresh token (30 days) so sessions survive seamlessly.
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
   * Internal: persist refreshed tokens to localStorage.
   */
  private static _persistTokens(newTokens: CognitoTokens): void {
    if (typeof window !== 'undefined') {
      console.log('[Auth] Persisting refreshed tokens — new refresh token fingerprint:', tokenFingerprint(newTokens.refreshToken));
      localStorage.setItem('cognito_access_token', newTokens.accessToken);
      localStorage.setItem('cognito_id_token', newTokens.idToken);
      localStorage.setItem('cognito_refresh_token', newTokens.refreshToken);
    }
  }

  /**
   * Internal: performs the actual token refresh with graceful fallback.
   *
   * Strategy:
   * 1. Try InitiateAuth (REFRESH_TOKEN_AUTH) — works for email/password users.
   * 2. If that fails with "Invalid Refresh Token", try the OAuth2 /oauth2/token
   *    endpoint — covers social-login users and tokens that were rotated/revoked.
   * 3. If both fail but the access token is still valid, return it as-is.
   * 4. If the access token is also expired, clear the session.
   */
  private static async _performTokenRefresh(tokens: CognitoTokens): Promise<string | null> {
    // Log the refresh token fingerprint so we can compare it to the one
    // stored at sign-in — if they differ, something is corrupting/replacing it.
    const storedRT = typeof window !== 'undefined' ? localStorage.getItem('cognito_refresh_token') : null;
    console.log('[Auth] Attempting token refresh:', {
      refreshTokenFromMemory: tokenFingerprint(tokens.refreshToken),
      refreshTokenFromStorage: tokenFingerprint(storedRT),
      match: tokens.refreshToken === storedRT,
    });

    // Attempt 1: InitiateAuth API
    try {
      const newTokens = await this.refreshTokens(tokens.refreshToken);
      this._persistTokens(newTokens);
      console.log('[Auth] Token refresh succeeded via InitiateAuth');
      return newTokens.accessToken;
    } catch (err) {
      const errorName = err && typeof err === 'object' && 'name' in err ? (err as any).name : '';
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.warn('InitiateAuth refresh failed:', {
        error: errorName || 'Unknown',
        message: errorMessage,
        accessTokenExpired: this.isTokenExpired(tokens.accessToken),
      });

      // Attempt 2: OAuth2 /oauth2/token endpoint (fallback for social login
      // users or when the refresh token was rotated/revoked).
      if (errorName === 'NotAuthorizedException' && cognitoConfig.domain) {
        try {
          console.log('Trying OAuth2 token endpoint fallback…');
          const oauthTokens = await this.refreshTokensViaOAuth(tokens.refreshToken);
          this._persistTokens(oauthTokens);
          console.log('Token refresh succeeded via OAuth2 token endpoint');
          return oauthTokens.accessToken;
        } catch (oauthErr) {
          console.warn('OAuth2 token endpoint fallback also failed:', {
            message: oauthErr instanceof Error ? oauthErr.message : String(oauthErr),
          });
        }
      }

      // If the access token hasn't actually expired yet (we were refreshing
      // proactively), return it so the user's session continues until it does.
      if (!this.isTokenExpired(tokens.accessToken)) {
        console.log('Proactive refresh failed but access token still valid — continuing session');
        return tokens.accessToken;
      }

      // Token is truly expired and refresh failed — session is dead
      console.warn('Access token expired and refresh failed — clearing session');
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
