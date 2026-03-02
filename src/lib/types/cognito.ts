export interface CognitoUser {
  sub: string;
  email?: string;  // Optional: may not be provided by some auth methods (social, magic link, phone)
  email_verified?: boolean;  // Optional: email verification status
  name?: string;
  given_name?: string;
  family_name?: string;
}

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

