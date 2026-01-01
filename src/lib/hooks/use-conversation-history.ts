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
      // Merge with existing conversations using Map for O(1) lookups
      // Preserve preloaded messages from existing conversations
      const existingWithMessages = new Map(
        globalConversations
          .filter(c => c.messages && c.messages.length > 0)
          .map(c => [c.id, c])
      );
      const updated = loaded.map(conv =>
        existingWithMessages.has(conv.id) ? existingWithMessages.get(conv.id)! : conv
      );
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

      // Preload only the 5 most recent conversations for better performance
      // This reduces startup API calls from 40+ to ~10
      const conversationsToPreload = conversationList.slice(0, Math.min(5, conversationList.length));
      
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

      // Update conversations with preloaded data using Map for O(1) lookups
      const conversationMap = new Map(globalConversations.map(c => [c.id, c]));
      preloaded.forEach(preloadedConv => {
        if (preloadedConv && preloadedConv.messages && preloadedConv.messages.length > 0) {
          conversationMap.set(preloadedConv.id, preloadedConv);
        }
      });
      // Convert back to sorted array
      globalConversations = Array.from(conversationMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
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
        // If we have very few conversations left (1 or 0), refresh from server to ensure accuracy
        // This handles edge cases where the list might be out of sync
        if (globalConversations.length <= 1) {
          console.log('Few conversations remaining, refreshing from server to ensure accuracy');
          refreshConversations(true).catch(err => {
            console.warn('Error refreshing conversations after deletion:', err);
          });
        }
      } else if (customEvent?.detail?.type === 'created' && customEvent?.detail?.conversation) {
        // Optimize: add to local state instead of refetching
        console.log(`Adding conversation ${customEvent.detail.conversation.id} to local state`);
        addConversation(customEvent.detail.conversation);
      } else if (customEvent?.detail?.type === 'updated' && customEvent?.detail?.conversation) {
        // Optimize: update in local state instead of refetching
        // Deduplicate messages in the updated conversation
        const updatedConv = customEvent.detail.conversation;
        if (updatedConv.messages && updatedConv.messages.length > 0) {
          const seenMessages = new Set<string>();
          const deduplicatedMessages = updatedConv.messages.filter((msg: { id?: string; role: string; content: string }) => {
            const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
            if (seenMessages.has(messageKey)) {
              return false;
            }
            seenMessages.add(messageKey);
            return true;
          });
          updatedConv.messages = deduplicatedMessages;
        }
        console.log(`Updating conversation ${updatedConv.id} in local state`);
        addConversation(updatedConv);
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

