/**
 * Store for the toast ID shown when user lands on payment success page.
 * Used to coordinate between billing page and useCoinbaseNotifications:
 * - Billing page shows loading toast and stores ID here
 * - Hook dismisses this toast when charge:confirmed or charge:failed arrives
 */

const TOAST_ACTIVE_KEY = 'payment_success_toast_active';
const PAYMENT_CONFIRMED_KEY = 'payment_confirmed';

let successPageToastId: string | number | null = null;

export function setSuccessPageToastId(id: string | number): void {
  successPageToastId = id;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(TOAST_ACTIVE_KEY, '1');
  }
}

export function hasSuccessPageToast(): boolean {
  return successPageToastId !== null;
}

export function getAndClearSuccessPageToastId(): string | number | null {
  const id = successPageToastId;
  successPageToastId = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(TOAST_ACTIVE_KEY);
    sessionStorage.setItem(PAYMENT_CONFIRMED_KEY, '1');
  }
  return id;
}

/** True if payment was already confirmed (don't show loading toast on success page revisit) */
export function wasPaymentAlreadyConfirmed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(PAYMENT_CONFIRMED_KEY) === '1';
}

/** Clear payment confirmed flag (call when dismissing success overlay so next payment can show toast) */
export function clearPaymentConfirmed(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(PAYMENT_CONFIRMED_KEY);
  }
}
