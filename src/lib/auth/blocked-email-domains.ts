import blockedConfig from './blocked-email-domains.json';

const BLOCKED = new Set(
  (blockedConfig.domains ?? []).map((d) => d.toLowerCase().trim()).filter(Boolean)
);

export const BLOCKED_EMAIL_DOMAIN_MESSAGE =
  blockedConfig.message ||
  'This email domain is not permitted for new accounts. Please sign up with a different email address.';

export function getEmailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * A blocklist entry matches the domain itself and any subdomain of it, so
 * "mailosaur.net" also blocks "yi4owfot.mailosaur.net". Mirrors the matching
 * rule in the Cognito PreSignUp Lambda, which is the enforcement source of
 * truth. The walk stops once only one label is left, so a bare TLD can never
 * match.
 */
export function isBlockedEmailDomain(email: string): boolean {
  let candidate = getEmailDomain(email);
  while (candidate.includes('.')) {
    if (BLOCKED.has(candidate)) return true;
    candidate = candidate.slice(candidate.indexOf('.') + 1);
  }
  return false;
}

/** Strip Cognito's "PreSignUp failed with error …" wrapper when present. */
export function normalizeSignupErrorMessage(raw: string): string {
  const match = raw.match(/PreSignUp failed with error\s+(.+?)(?:\s*\.?$)/i);
  if (match?.[1]) {
    return match[1].replace(/\.$/, '').trim();
  }
  return raw;
}
