/**
 * Cloudflare Turnstile on the signup form.
 *
 * The widget produces a short-lived, single-use token. It travels to Cognito
 * in the SignUp ValidationData, and the PreSignUp Lambda verifies it with
 * Cloudflare before the account is created (Morpheus-Infra, pre_signup.js).
 */

/** Public site key. Empty means the widget is not rendered and no token is sent. */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

/** Name of the ValidationData entry the PreSignUp Lambda reads the token from. */
export const TURNSTILE_VALIDATION_KEY = 'turnstileToken';
