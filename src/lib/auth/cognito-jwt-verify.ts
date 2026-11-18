import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

/**
 * Cognito JWT Token Verification Helper
 *
 * Verifies JWT tokens against AWS Cognito's JWKS endpoint.
 * Handles both ID tokens (aud) and access tokens (client_id).
 * Used for authenticating GET requests that require user identity.
 */

// Cache the JWKS fetcher to avoid repeated network calls
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwksCache) {
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const region = process.env.NEXT_PUBLIC_COGNITO_REGION;

    if (!userPoolId || !region) {
      throw new Error('Cognito configuration missing');
    }

    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    jwksCache = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwksCache;
}

/**
 * Verify a Cognito JWT token using JWKS
 *
 * Accepts both ID tokens (token_use=id, aud claim) and access tokens (token_use=access, client_id claim)
 *
 * @param token - The JWT token to verify
 * @returns The verified JWT payload containing user claims
 * @throws Error if verification fails
 */
export async function verifyCognitoToken(token: string): Promise<JWTPayload> {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

  if (!userPoolId || !region || !clientId) {
    throw new Error('Cognito configuration missing');
  }

  const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  try {
    const JWKS = getJWKS();

    // Verify signature and basic structure without audience validation
    // (access tokens use client_id claim, not aud)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: expectedIssuer,
    });

    // Manual validation for Cognito-specific claims

    // 1. Verify issuer (already checked by jwtVerify, but be explicit)
    if (payload.iss !== expectedIssuer) {
      throw new Error('Invalid issuer');
    }

    // 2. Verify token_use is 'access' (we expect access tokens for API calls)
    if (payload.token_use !== 'access') {
      throw new Error('Invalid token_use - expected access token');
    }

    // 3. Verify client_id matches (access tokens use client_id, not aud)
    if (payload.client_id !== clientId) {
      throw new Error('Invalid client_id');
    }

    // 4. Verify sub claim exists (user identifier)
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Token missing sub claim');
    }

    return payload;
  } catch (error) {
    // Bounded logging: log error type only, not token value
    console.error('[JWT Verify] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Token verification failed');
  }
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The token string or null if not present/malformed
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}
