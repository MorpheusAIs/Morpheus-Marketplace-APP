export const cognitoConfig = {
  region: process.env.NEXT_PUBLIC_COGNITO_REGION || '',
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
};

// Validate configuration
if (!cognitoConfig.region || !cognitoConfig.userPoolClientId) {
  console.warn('Cognito configuration is incomplete. Please check your environment variables.');
}

