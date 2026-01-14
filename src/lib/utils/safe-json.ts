/**
 * Safe JSON parsing utilities to mitigate deep recursion vulnerabilities
 * 
 * These utilities protect against:
 * - Deeply nested JSON structures that can cause stack overflow
 * - Excessively large JSON payloads
 * - Circular references (though JSON.parse doesn't support these natively)
 */

export interface SafeJsonParseOptions {
  /** Maximum depth of nested objects/arrays (default: 100) */
  maxDepth?: number;
  /** Maximum size of JSON string in bytes (default: 10MB) */
  maxSize?: number;
  /** Whether to throw on violations (default: true) */
  throwOnViolation?: boolean;
}

const DEFAULT_OPTIONS: Required<SafeJsonParseOptions> = {
  maxDepth: 100,
  maxSize: 10 * 1024 * 1024, // 10MB
  throwOnViolation: true,
};

/**
 * Validates JSON string size before parsing
 */
function validateSize(jsonString: string, maxSize: number): void {
  const size = new Blob([jsonString]).size;
  if (size > maxSize) {
    throw new Error(
      `JSON payload exceeds maximum size: ${size} bytes (max: ${maxSize} bytes)`
    );
  }
}

/**
 * Recursively checks the depth of a parsed JSON object
 */
function checkDepth(obj: any, currentDepth: number, maxDepth: number): number {
  if (currentDepth > maxDepth) {
    throw new Error(
      `JSON structure exceeds maximum depth: ${currentDepth} (max: ${maxDepth})`
    );
  }

  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  if (Array.isArray(obj)) {
    let maxChildDepth = currentDepth;
    for (const item of obj) {
      const childDepth = checkDepth(item, currentDepth + 1, maxDepth);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    return maxChildDepth;
  }

  // Plain object
  let maxChildDepth = currentDepth;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const childDepth = checkDepth(obj[key], currentDepth + 1, maxDepth);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
  }
  return maxChildDepth;
}

/**
 * Safely parses a JSON string with depth and size validation
 * 
 * @param jsonString - The JSON string to parse
 * @param options - Validation options
 * @returns The parsed object
 * @throws Error if validation fails
 * 
 * @example
 * ```ts
 * const data = safeJsonParse('{"nested": {"deep": "value"}}');
 * ```
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  options: SafeJsonParseOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate size first (before parsing)
  validateSize(jsonString, opts.maxSize);

  // Parse JSON
  let parsed: T;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }

  // Validate depth
  try {
    checkDepth(parsed, 0, opts.maxDepth);
  } catch (error) {
    if (opts.throwOnViolation) {
      throw error;
    }
    // If not throwing, log warning but return parsed object
    console.warn('JSON depth validation failed:', error);
  }

  return parsed;
}

/**
 * Safely parses JSON with error handling (returns null on error instead of throwing)
 * 
 * @param jsonString - The JSON string to parse
 * @param options - Validation options
 * @returns The parsed object or null if parsing/validation fails
 * 
 * @example
 * ```ts
 * const data = safeJsonParseOrNull('{"key": "value"}');
 * if (data) {
 *   // Use data
 * }
 * ```
 */
export function safeJsonParseOrNull<T = any>(
  jsonString: string,
  options: SafeJsonParseOptions = {}
): T | null {
  try {
    return safeJsonParse<T>(jsonString, { ...options, throwOnViolation: true });
  } catch (error) {
    console.error('Safe JSON parse failed:', error);
    return null;
  }
}

/**
 * Validates an already-parsed object for depth violations
 * Useful for validating objects received from external APIs
 * 
 * @param obj - The object to validate
 * @param options - Validation options
 * @throws Error if validation fails
 */
export function validateJsonDepth(
  obj: any,
  options: SafeJsonParseOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  checkDepth(obj, 0, opts.maxDepth);
}
