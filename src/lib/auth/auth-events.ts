/**
 * Auth event system for cross-cutting session invalidation.
 *
 * The API layer emits an 'unauthorized' event when it receives a 401 response.
 * The CognitoAuthProvider listens for this event and triggers logout + redirect,
 * preventing "ghost" sessions where the UI stays accessible after token expiry.
 */

type AuthEventListener = () => void;

const listeners = new Set<AuthEventListener>();
let lastEmitTime = 0;
const DEBOUNCE_MS = 2000; // Prevent rapid-fire logouts from multiple concurrent 401s

export const authEvents = {
  /** Subscribe to unauthorized events. Returns an unsubscribe function. */
  onUnauthorized(listener: AuthEventListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Emit an unauthorized event (called by the API layer on 401). */
  emitUnauthorized() {
    const now = Date.now();
    if (now - lastEmitTime < DEBOUNCE_MS) return;
    lastEmitTime = now;
    listeners.forEach((listener) => listener());
  },
};
