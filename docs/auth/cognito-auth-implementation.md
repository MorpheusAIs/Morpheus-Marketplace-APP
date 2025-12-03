Thought for 3s### Comprehensive Amazon Cognito Integration Guide

## Environment Variables

All environment variables are already configured in your v0 workspace:

```shellscript
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=gllbg66ej476tsaf2ibfjc7g8
NEXT_PUBLIC_COGNITO_DOMAIN=auth.mor.org
NEXT_PUBLIC_API_BASE_URL=https://api.mor.org
```

**Note**: All variables are prefixed with `NEXT_PUBLIC_` because they're used in client-side code.

---

## NPM Packages & Dependencies

### Required SDK

```json
{
  "@aws-sdk/client-cognito-identity-provider": "^3.x.x"
}
```

This is the official AWS SDK for Cognito, providing direct API access without the overhead of AWS Amplify.

---

## File Structure & Architecture

### 1. **`lib/auth/cognito-config.ts`**

**Purpose**: Centralized Cognito configuration

```typescript
export const cognitoConfig = {
  region: process.env.NEXT_PUBLIC_COGNITO_REGION!,
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
}
```

### 2. **`lib/auth/cognito-auth-context.tsx`**

**Purpose**: React Context for authentication state management

**Key Components**:

- `CognitoAuthProvider` - Wraps the app to provide auth state
- `useCognitoAuth` - Hook to access auth functions and user state


**State Management**:

```typescript
interface AuthContextType {
  user: CognitoUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
```

**Token Storage**:

- Tokens stored in `localStorage`:

- `cognito_access_token`
- `cognito_id_token`
- `cognito_refresh_token`
- `cognito_user_email`





### 3. **`lib/types.ts`**

**Purpose**: TypeScript interfaces for type safety

```typescript
export interface CognitoUser {
  email: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
}
```

---

## Authentication Flows

### Flow 1: Direct Authentication (Implemented)

**Sign In Process**:

```plaintext
1. User enters email/password
2. Call CognitoIdentityProviderClient.send(InitiateAuthCommand)
3. Cognito validates credentials
4. Returns: AccessToken, IdToken, RefreshToken
5. Store tokens in localStorage
6. Update React context state
7. Redirect to /api-keys
```

**API Call**:

```typescript
const command = new InitiateAuthCommand({
  AuthFlow: 'USER_PASSWORD_AUTH',
  ClientId: cognitoConfig.userPoolClientId,
  AuthParameters: {
    USERNAME: email,
    PASSWORD: password,
  },
});
```

**Sign Up Process**:

```plaintext
1. User enters email/password
2. Call CognitoIdentityProviderClient.send(SignUpCommand)
3. Cognito creates user account
4. Automatically sign in the user
5. Store tokens and redirect
```

---

## Authentication Usage in Components

### Protected Routes

**Dashboard Layout** (`components/dashboard-layout.tsx`):

```typescript
const { user, loading } = useCognitoAuth();

useEffect(() => {
  if (!loading && !user) {
    router.push('/signin');
  }
}, [user, loading, router]);
```

### Sign In Page (`app/signin/page.tsx`)

```typescript
const { signIn } = useCognitoAuth();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await signIn(email, password);
  router.push('/api-keys');
};
```

### Sign Out

```typescript
const { signOut } = useCognitoAuth();

const handleSignOut = async () => {
  await signOut();
  router.push('/signin');
};
```

---

## API Integration

### Making Authenticated API Calls

```typescript
const { user } = useCognitoAuth();

const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/keys`, {
  headers: {
    'Authorization': `Bearer ${user.accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

The backend API validates the JWT token against the Cognito User Pool.

---

## Token Management

### Token Refresh Flow

```typescript
const refreshSession = async () => {
  const refreshToken = localStorage.getItem('cognito_refresh_token');
  
  const command = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: cognitoConfig.userPoolClientId,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });
  
  const response = await client.send(command);
  // Update tokens in localStorage
};
```

**Token Expiration**:

- Access Token: 1 hour (default)
- ID Token: 1 hour (default)
- Refresh Token: 30 days (default)


---

## Security Considerations

### Current Implementation

✅ **Implemented**:

- Tokens stored in localStorage (accessible only to same origin)
- HTTPS required for production
- Client-side validation before API calls
- Automatic token refresh


⚠️ **Considerations**:

- localStorage is vulnerable to XSS attacks
- For production, consider using httpOnly cookies
- Implement CSRF protection for cookie-based auth
- Add rate limiting on sign-in attempts


### Recommended Enhancements

1. **Add MFA Support**:


```typescript
// After initial auth, if MFA required:
const mfaCommand = new RespondToAuthChallengeCommand({
  ChallengeName: 'SOFTWARE_TOKEN_MFA',
  ClientId: cognitoConfig.userPoolClientId,
  ChallengeResponses: {
    USERNAME: email,
    SOFTWARE_TOKEN_MFA_CODE: mfaCode,
  },
});
```

2. **Implement Password Reset**:


```typescript
const resetCommand = new ForgotPasswordCommand({
  ClientId: cognitoConfig.userPoolClientId,
  Username: email,
});
```

---

## Complete Integration Checklist

- Install `@aws-sdk/client-cognito-identity-provider`
- Configure environment variables
- Create Cognito configuration file
- Implement authentication context
- Create sign-in page
- Create sign-up page
- Protect dashboard routes
- Add sign-out functionality
- Store tokens in localStorage
- Update to use httpOnly cookies
- Implement token refresh
- Add password reset flow
- Add social login (optional)


---

## Testing the Integration

### Manual Testing Steps

1. **Sign Up**: Navigate to `/signup`, create account
2. **Sign In**: Use credentials at `/signin`
3. **Access Protected Route**: Should redirect to `/api-keys`
4. **Token Persistence**: Refresh page, should stay logged in
5. **Sign Out**: Click logout, should redirect to `/signin`
6. **Protected Route Access**: Try accessing `/api-keys` while logged out


### Debug Mode

Add console logs to track auth flow:

```typescript
console.log('[v0] Auth state:', { user, loading });
console.log('[v0] Tokens:', { 
  hasAccessToken: !!localStorage.getItem('cognito_access_token') 
});
```

---

This implementation provides a production-ready Cognito integration with direct authentication flow, automatic token management, and protected routes. The architecture is modular and can be extended with additional features like MFA, password reset, and social login as needed.