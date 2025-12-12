'use client';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    headers: Record<string, string>;
    body: any;
  };
}

// Configuration for resilient requests - tuned for high-latency connections
export const RESILIENCE_CONFIG = {
  // Default timeout for standard API calls (30 seconds)
  DEFAULT_TIMEOUT_MS: 30000,
  // Extended timeout for chat completions (90 seconds - accounts for session creation + response)
  CHAT_TIMEOUT_MS: 90000,
  // Maximum retry attempts for retryable errors
  MAX_RETRIES: 3,
  // Base delay between retries (exponential backoff applied)
  RETRY_DELAY_MS: 1000,
  // Retry delay multiplier for exponential backoff (1s, 2s, 4s)
  RETRY_BACKOFF_MULTIPLIER: 2,
};

/**
 * Creates a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number, controller: AbortController): Promise<never> {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timeout after ${ms}ms`));
    }, ms);
    
    // Clean up timeout if the controller is aborted externally
    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId));
  });
}

/**
 * Determines if an error is retryable (network issues, timeouts, server errors)
 */
function isRetryableError(error: unknown, status?: number): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  // Abort/timeout errors are retryable
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }
  // Server errors (5xx) are retryable
  if (status && status >= 500 && status < 600) {
    return true;
  }
  // Rate limiting (429) is retryable with backoff
  if (status === 429) {
    return true;
  }
  // Gateway timeout (504) is retryable
  if (status === 504) {
    return true;
  }
  return false;
}

/**
 * Configuration options for API requests
 */
export interface ApiRequestConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for retryable errors (0 = no retries) */
  retries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Performs an API request with timeout and optional retry logic.
 * 
 * Features:
 * - Configurable timeout (prevents hanging requests)
 * - Automatic retry with exponential backoff for network/server errors
 * - Detailed logging for debugging
 * 
 * @param url - The URL to request
 * @param options - Standard fetch options
 * @param config - Resilience configuration (timeout, retries)
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {},
  config?: ApiRequestConfig
): Promise<ApiResponse<T>> {
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.body;
  const timeout = config?.timeout ?? RESILIENCE_CONFIG.DEFAULT_TIMEOUT_MS;
  const maxRetries = config?.retries ?? 0; // Default: no retries for backward compatibility
  const baseRetryDelay = config?.retryDelay ?? RESILIENCE_CONFIG.RETRY_DELAY_MS;

  let lastError: Error | null = null;
  let lastStatus: number = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    
    // Merge abort signal with any existing signal from options
    const originalSignal = options.signal;
    if (originalSignal) {
      originalSignal.addEventListener('abort', () => controller.abort());
      // If already aborted, abort immediately
      if (originalSignal.aborted) {
        controller.abort();
      }
    }

    // Log the request (only on first attempt to reduce noise)
    if (attempt === 0) {
      console.group(`API Request: ${method} ${url}`);
      console.log('Request Headers:', headers);
      if (body) {
        try {
          console.log('Request Body:', typeof body === 'string' ? JSON.parse(body) : body);
        } catch {
          console.log('Request Body: [non-JSON data]');
        }
      }
      console.log('Timeout:', timeout, 'ms');
    } else {
      console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${method} ${url}`);
    }

    try {
      const fetchPromise = fetch(url, {
        ...options,
        signal: controller.signal,
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise(timeout, controller),
      ]) as Response;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseData: any = null;
      let responseText = '';
      let parseError = null;

      try {
        responseText = await response.text();
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            console.log('Raw response text:', responseText.substring(0, 500));
            parseError = e instanceof Error ? e.message : 'Unknown parse error';
          }
        }
      } catch (e) {
        console.error('Error reading response text:', e);
        parseError = e instanceof Error ? e.message : 'Unknown response error';
      }

      // Log the response
      console.log('Response Status:', response.status);
      console.log('Response Headers:', responseHeaders);
      console.log('Response Body:', responseData || responseText?.substring(0, 200) || '(empty response)');

      const result: ApiResponse<T> = {
        data: response.ok ? responseData : null,
        error: !response.ok
          ? responseData?.detail || responseData?.error?.message || `Error ${response.status}`
          : parseError
            ? `Invalid response format: ${parseError}`
            : null,
        status: response.status,
        request: {
          url,
          method,
          headers: headers as Record<string, string>,
          body: body ? (typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return body; } })() : body) : undefined,
        },
        response: {
          headers: responseHeaders,
          body: responseData || responseText || null,
        },
      };

      // Check if we should retry on server errors
      if (!response.ok && isRetryableError(null, response.status) && attempt < maxRetries) {
        lastStatus = response.status;
        const delay = baseRetryDelay * Math.pow(RESILIENCE_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt);
        console.log(`⚠️ Server error ${response.status}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.groupEnd();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if this was a user-initiated abort (not timeout)
      if (originalSignal?.aborted) {
        console.log('Request aborted by user');
        console.groupEnd();
        return {
          data: null,
          error: 'Request cancelled',
          status: 0,
          request: {
            url,
            method,
            headers: headers as Record<string, string>,
            body: body ? (typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return body; } })() : body) : undefined,
          },
          response: {
            headers: {},
            body: null,
          },
        };
      }

      console.error('Request Error:', lastError.message);

      // Check if we should retry
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = baseRetryDelay * Math.pow(RESILIENCE_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt);
        console.log(`⚠️ Retryable error (${lastError.message}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // No more retries, return error
      console.groupEnd();
      return {
        data: null,
        error: lastError.message,
        status: lastStatus || 0,
        request: {
          url,
          method,
          headers: headers as Record<string, string>,
          body: body ? (typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return body; } })() : body) : undefined,
        },
        response: {
          headers: {},
          body: null,
        },
      };
    }
  }

  // Should not reach here, but just in case
  console.groupEnd();
  return {
    data: null,
    error: lastError?.message || 'Unknown error after retries',
    status: lastStatus || 0,
    request: {
      url,
      method,
      headers: headers as Record<string, string>,
      body: body ? (typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return body; } })() : body) : undefined,
    },
    response: {
      headers: {},
      body: null,
    },
  };
}

// Convenience methods with timeout and retry support

export const apiGet = <T>(url: string, token?: string, config?: ApiRequestConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(url, { method: 'GET', headers }, config);
};

export const apiPost = <T>(url: string, data: any, token?: string, config?: ApiRequestConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    },
    config
  );
};

export const apiPut = <T>(url: string, data: any, token?: string, config?: ApiRequestConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(
    url,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    },
    config
  );
};

export const apiDelete = <T>(url: string, token?: string, config?: ApiRequestConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(url, { method: 'DELETE', headers }, config);
};
