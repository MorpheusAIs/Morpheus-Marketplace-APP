/**
 * Data Isolation Validator
 * 
 * MOR-333: Defensive measures to detect and prevent cross-account data leaks.
 * 
 * This utility provides validation functions to ensure that API responses
 * contain data that belongs to the authenticated user. While the backend
 * should enforce this, these client-side checks serve as:
 * 
 * 1. Early detection of data isolation bugs
 * 2. Protection against accidental data exposure
 * 3. Diagnostic logging for investigating reported issues
 * 
 * IMPORTANT: These are defensive measures, not a replacement for proper
 * backend authorization. The backend MUST filter all queries by user_id.
 */

import type { LedgerEntryResponse, MonthlySpendingResponse } from '@/types/billing';

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Validate that ledger entries contain the expected user_id.
 * 
 * NOTE: We cannot directly validate the numeric user_id against the Cognito sub
 * because they are different ID systems. However, we can check for consistency
 * within a batch of entries and flag suspicious patterns.
 */
export function validateLedgerEntries(
  entries: LedgerEntryResponse[],
  context: {
    cognitoSub?: string;
    userEmail?: string;
  }
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    issues: [],
    warnings: [],
  };

  if (entries.length === 0) {
    return result;
  }

  // Check 1: All entries should have the same user_id
  const userIds = new Set(entries.map(e => e.user_id));
  if (userIds.size > 1) {
    result.isValid = false;
    result.issues.push(
      `Multiple user_ids found in response: ${Array.from(userIds).join(', ')}. ` +
      `This indicates a critical data isolation bug where data from multiple users ` +
      `is being mixed in a single API response.`
    );
  }

  // Check 2: Log the user_id for correlation with backend logs
  const userId = entries[0]?.user_id;
  if (process.env.NODE_ENV === 'development') {
    console.log('[DataIsolationValidator] Ledger entries validation:', {
      entryCount: entries.length,
      userId,
      cognitoSub: context.cognitoSub,
      userEmail: context.userEmail,
      timestamp: new Date().toISOString(),
    });
  }

  // Check 3: Look for suspicious patterns (e.g., test data)
  const hasTestPattern = entries.some(entry => {
    const email = context.userEmail?.toLowerCase() || '';
    const isTestEmail = email.includes('test') || email.includes('example');
    const isProductionData = entry.amount_total !== '0.00' && entry.tokens_total !== null;
    
    // Warn if test email is seeing production-like data
    return isTestEmail && isProductionData;
  });

  if (hasTestPattern) {
    result.warnings.push(
      'Test account detected with production-like usage data. ' +
      'Verify this is expected behavior.'
    );
  }

  return result;
}

/**
 * Validate monthly spending response for suspicious patterns.
 * 
 * Since MonthlySpendingResponse doesn't include a user_id field,
 * we can only check for anomalies like future dates or impossible values.
 */
export function validateMonthlySpending(
  response: MonthlySpendingResponse,
  context: {
    cognitoSub?: string;
    userEmail?: string;
  }
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    issues: [],
    warnings: [],
  };

  if (!response.months || response.months.length === 0) {
    return result;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JS months are 0-based

  // Check 1: Detect future dates
  const futureMonths = response.months.filter(m => {
    if (m.year > currentYear) return true;
    if (m.year === currentYear && m.month > currentMonth) return true;
    return false;
  });

  if (futureMonths.length > 0) {
    result.isValid = false;
    result.issues.push(
      `Future spending data detected: ${futureMonths.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`).join(', ')}. ` +
      `This may indicate test/mock data or a system clock issue.`
    );
  }

  // Check 2: Detect impossibly old data (e.g., before service launch)
  const SERVICE_LAUNCH_DATE = new Date('2024-01-01'); // Adjust to actual launch date
  const ancientMonths = response.months.filter(m => {
    const monthDate = new Date(m.year, m.month - 1, 1);
    return monthDate < SERVICE_LAUNCH_DATE;
  });

  if (ancientMonths.length > 0) {
    result.warnings.push(
      `Data from before service launch detected: ${ancientMonths.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`).join(', ')}. ` +
      `This may be test data.`
    );
  }

  // Check 3: Log for correlation
  if (process.env.NODE_ENV === 'development') {
    console.log('[DataIsolationValidator] Monthly spending validation:', {
      year: response.year,
      mode: response.mode,
      monthCount: response.months.length,
      cognitoSub: context.cognitoSub,
      userEmail: context.userEmail,
      dataRange: response.months.length > 0 
        ? `${response.months[0].year}-${response.months[0].month} to ${response.months[response.months.length - 1].year}-${response.months[response.months.length - 1].month}`
        : 'none',
      timestamp: new Date().toISOString(),
    });
  }

  // Check 4: Detect suspiciously high transaction counts
  const suspiciousMonths = response.months.filter(m => 
    (m.transaction_count ?? 0) > 100000 // More than 100k transactions in a month seems unusual
  );

  if (suspiciousMonths.length > 0) {
    result.warnings.push(
      `Unusually high transaction counts detected. This may indicate aggregated test data or a data isolation issue.`
    );
  }

  return result;
}

/**
 * Report validation issues to console and optionally to monitoring service.
 * 
 * In development: Log everything
 * In production: Only log errors, send to monitoring service
 */
export function reportValidationIssues(
  component: string,
  result: ValidationResult,
  context: {
    cognitoSub?: string;
    userEmail?: string;
  }
): void {
  if (result.issues.length === 0 && result.warnings.length === 0) {
    return;
  }

  const logData = {
    component,
    context,
    issues: result.issues,
    warnings: result.warnings,
    timestamp: new Date().toISOString(),
  };

  if (result.issues.length > 0) {
    console.error('[DataIsolationValidator] CRITICAL: Data isolation issues detected', logData);
    
    // In production, send to monitoring service (e.g., Sentry, DataDog)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with monitoring service
      // Example: Sentry.captureException(new Error('Data isolation violation'), { extra: logData });
    }
  }

  if (result.warnings.length > 0) {
    console.warn('[DataIsolationValidator] Potential data anomalies detected', logData);
  }
}

/**
 * Check if the current environment is safe for displaying potentially mixed data.
 * Returns true if we should show data, false if we should hide/block it.
 */
export function shouldDisplayData(validationResult: ValidationResult): boolean {
  // In production, be strict: don't show data if there are critical issues
  if (process.env.NODE_ENV === 'production' && validationResult.issues.length > 0) {
    return false;
  }

  // In development, show data but with warnings
  return true;
}
