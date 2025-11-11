'use client';

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
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
    } catch {
      // Refresh failed, clear tokens
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
}
