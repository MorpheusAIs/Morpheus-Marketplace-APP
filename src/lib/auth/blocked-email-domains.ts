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

export function isBlockedEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain.length > 0 && BLOCKED.has(domain);
}

/** Strip Cognito's "PreSignUp failed with error …" wrapper when present. */
export function normalizeSignupErrorMessage(raw: string): string {
  const match = raw.match(/PreSignUp failed with error\s+(.+?)(?:\s*\.?$)/i);
  if (match?.[1]) {
    return match[1].replace(/\.$/, '').trim();
  }
  return raw;
}
