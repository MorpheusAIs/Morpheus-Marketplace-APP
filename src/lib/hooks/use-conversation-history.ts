'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getConversations, getConversation, type Conversation } from '@/lib/conversation-history';

// Module-level singleton to persist state across component remounts
let globalConversations: Conversation[] = [];
let globalIsLoading = false;
let globalError: string | null = null;
let hasInitialized = false;
let hasPreloaded = false;

/**
 * React hook for accessing conversation history
 * Automatically loads conversations from API and listens for update events
 * Preloads the 5 most recent conversations (up to 20) on first load
 */
export function useConversationHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(globalConversations);
  const [isLoading, setIsLoading] = useState(globalIsLoading);
  const [error, setError] = useState<string | null>(globalError);
  const hasPreloadedRef = useRef(hasPreloaded);
  const hasInitializedRef = useRef(hasInitialized);

  const refreshConversations = useCallback(async (force = false) => {
    // Check if API key exists before attempting to load conversations
    const apiKey = typeof window !== 'undefined' ? sessionStorage.getItem('verified_api_key') : null;
    if (!apiKey) {
      // No API key available - silently skip loading conversations
      // This is expected for new users who haven't created/verified an API key yet
      setIsLoading(false);
      globalIsLoading = false;
      setError(null);
      globalError = null;
      return;
    }

    // Don't show loading if we already have conversations and this isn't a forced refresh
    if (!force && globalConversations.length > 0) {
      setIsLoading(false);
      globalIsLoading = false;
    } else {
      setIsLoading(true);
      globalIsLoading = true;
    }
    setError(null);
    globalError = null;

    try {
      const loaded = await getConversations();
      // Merge with existing conversations to preserve preloaded messages
      const updated = [...loaded];
      // Preserve messages from preloaded conversations
      globalConversations.forEach(prevConv => {
        const index = updated.findIndex(c => c.id === prevConv.id);
        if (index >= 0 && prevConv.messages && prevConv.messages.length > 0) {
          // Keep the preloaded messages if they exist
          updated[index] = prevConv;
        }
      });
      globalConversations = updated;
      setConversations(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      globalError = errorMessage;
      console.error('Error loading conversations:', err);
      // Only clear conversations on error if we don't have any cached
      if (globalConversations.length === 0) {
        globalConversations = [];
        setConversations([]);
      }
    } finally {
      setIsLoading(false);
      globalIsLoading = false;
    }
  }, []);

  // Preload conversations on first mount
  const preloadConversations = useCallback(async () => {
    if (hasPreloaded) {
      return;
    }

    try {
      const apiKey = typeof window !== 'undefined' ? sessionStorage.getItem('verified_api_key') : null;
      if (!apiKey) {
        return;
      }

      // Get list of conversations
      const conversationList = await getConversations(apiKey);
      
      // Preload the 5 most recent conversations, up to 20 total
      // Start with 5, but allow up to 20 if available
      const conversationsToPreload = conversationList.slice(0, Math.min(20, conversationList.length));
      
      console.log(`Preloading ${conversationsToPreload.length} conversations...`);
      
      // Preload conversations with messages in parallel
      const preloadedPromises = conversationsToPreload.map(async (conv) => {
        try {
          const fullConversation = await getConversation(conv.id, apiKey);
          return fullConversation;
        } catch (err) {
          console.warn(`Failed to preload conversation ${conv.id}:`, err);
          // Return the conversation without messages if preload fails
          return conv;
        }
      });

      const preloaded = await Promise.all(preloadedPromises);
      
      // Update conversations with preloaded data
      const updated = [...globalConversations];
      preloaded.forEach(preloadedConv => {
        if (preloadedConv && preloadedConv.messages && preloadedConv.messages.length > 0) {
          const index = updated.findIndex(c => c.id === preloadedConv.id);
          if (index >= 0) {
            // Update existing conversation with preloaded messages
            updated[index] = preloadedConv;
          } else {
            // Add new conversation if not in list yet
            updated.push(preloadedConv);
          }
        }
      });
      // Sort by updatedAt descending
      globalConversations = updated.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(globalConversations);

      hasPreloadedRef.current = true;
      hasPreloaded = true;
      console.log(`Successfully preloaded ${preloaded.length} conversations`);
    } catch (err) {
      console.warn('Error preloading conversations:', err);
      // Don't set error state for preload failures, just log
    }
  }, []);

  // Optimized function to remove a conversation from local state without refetching
  const removeConversation = useCallback((conversationId: string) => {
    globalConversations = globalConversations.filter(conv => conv.id !== conversationId);
    setConversations(globalConversations);
  }, []);

  // Optimized function to add a new conversation to local state without refetching
  const addConversation = useCallback((conversation: Conversation) => {
    // Check if conversation already exists
    const exists = globalConversations.some(conv => conv.id === conversation.id);
    if (exists) {
      // Update existing conversation
      globalConversations = globalConversations.map(conv => conv.id === conversation.id ? conversation : conv);
    } else {
      // Add new conversation at the beginning
      globalConversations = [conversation, ...globalConversations].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    setConversations(globalConversations);
  }, []);

  useEffect(() => {
    // Sync local state with global state on mount
    setConversations(globalConversations);
    setIsLoading(globalIsLoading);
    setError(globalError);
    hasPreloadedRef.current = hasPreloaded;
    hasInitializedRef.current = hasInitialized;

    // Only load conversations once globally
    if (!hasInitialized) {
      hasInitialized = true;
      hasInitializedRef.current = true;
      // Load conversations on mount
      refreshConversations(true).then(() => {
        // After initial load, preload the most recent conversations
        preloadConversations();
      });
    } else {
      // Already initialized, don't show loading state
      setIsLoading(false);
      globalIsLoading = false;
    }

    // Listen for custom events (for same-tab updates)
    const handleCustomStorageChange = (e?: Event) => {
      // Check if this is a delete event
      const customEvent = e as CustomEvent;
      console.log('conversation-history-updated event received:', {
        type: customEvent?.detail?.type,
        id: customEvent?.detail?.id,
        hasConversation: !!customEvent?.detail?.conversation
      });
      
      if (customEvent?.detail?.type === 'deleted' && customEvent?.detail?.id) {
        // Optimize: remove from local state instead of refetching
        console.log(`Removing conversation ${customEvent.detail.id} from local state`);
        removeConversation(customEvent.detail.id);
      } else if (customEvent?.detail?.type === 'created' && customEvent?.detail?.conversation) {
        // Optimize: add to local state instead of refetching
        console.log(`Adding conversation ${customEvent.detail.conversation.id} to local state`);
        addConversation(customEvent.detail.conversation);
      } else if (customEvent?.detail?.type === 'updated' && customEvent?.detail?.conversation) {
        // Optimize: update in local state instead of refetching
        console.log(`Updating conversation ${customEvent.detail.conversation.id} in local state`);
        addConversation(customEvent.detail.conversation);
      } else {
        // Full refresh for other cases (including plain Event without detail)
        console.log('Performing full refresh of conversations');
        refreshConversations(true).then(() => {
          // Re-preload after refresh
          hasPreloaded = false;
          hasPreloadedRef.current = false;
          preloadConversations();
        });
      }
    };

    window.addEventListener('conversation-history-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('conversation-history-updated', handleCustomStorageChange);
    };
  }, [refreshConversations, removeConversation, addConversation, preloadConversations]);

  // Helper function to get a conversation by ID from state
  const getConversationById = useCallback((id: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === id);
  }, [conversations]);

  return {
    conversations,
    isLoading,
    error,
    refresh: refreshConversations,
    getConversationById,
  };
}

