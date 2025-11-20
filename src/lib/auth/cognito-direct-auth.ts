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

    const response = await getCognitoClient().send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed - no tokens received');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
    };
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
  static storeTokens(tokens: CognitoTokens, email: string): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('cognito_access_token', tokens.accessToken);
    localStorage.setItem('cognito_id_token', tokens.idToken);
    localStorage.setItem('cognito_refresh_token', tokens.refreshToken);
    localStorage.setItem('cognito_user_email', email);
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
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      const exp = decoded.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch {
      return true; // Assume expired if we can't parse
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();
    if (!tokens) return null;

    if (!this.isTokenExpired(tokens.accessToken)) {
      return tokens.accessToken;
    }

    // Token is expired, try to refresh
    try {
      const newTokens = await this.refreshTokens(tokens.refreshToken);
      const email = this.getStoredEmail();
      if (email) {
        this.storeTokens(newTokens, email);
      }
      return newTokens.accessToken;
    } catch (err) {
      // Refresh failed (e.g., refresh token invalidated after password reset)
      // Silently clear tokens and return null - this is expected behavior
      // Don't log NotAuthorizedException as it's expected after password reset
      const errorName = err && typeof err === 'object' && 'name' in err ? (err as any).name : '';
      if (errorName !== 'NotAuthorizedException') {
        console.error('Error refreshing token:', err);
      }
      this.clearTokens();
      return null;
    }
  }

  /**
   * Parse user info from ID token
   */
  static parseIdToken(idToken: string): {
    sub: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  } {
    try {
      const payload = idToken.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      return {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        given_name: decoded.given_name,
        family_name: decoded.family_name,
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

    const data = await response.json();

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
