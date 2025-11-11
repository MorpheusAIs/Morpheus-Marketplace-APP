export interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

