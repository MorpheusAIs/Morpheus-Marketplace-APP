/**
 * Model name utilities
 * 
 * Provides helper functions for working with model names.
 * 
 * IMPORTANT: Model IDs are used exactly as returned from the /v1/models endpoint.
 * We do NOT modify model names (including :web suffixes) - they are passed
 * to the API in their entirety exactly as received.
 */

/**
 * Checks if a model name indicates web search capabilities
 * 
 * @param modelId - The model ID to check
 * @returns True if the model name suggests web search is enabled
 */
export function hasWebSearchSuffix(modelId: string): boolean {
  if (!modelId) {
    return false;
  }
  
  return modelId.includes(':web') || modelId.endsWith('-web');
}

/**
 * Logs model name information for debugging
 * 
 * @param context - Context where the logging occurs (e.g., "fetchModels", "sendRequest")
 * @param modelId - The model ID being processed
 */
export function logModelName(context: string, modelId: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Model Name Debug] ${context}: "${modelId}"`);
  }
}

