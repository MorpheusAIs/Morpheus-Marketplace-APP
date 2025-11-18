'use client';

import { useState, useEffect, useCallback } from 'react';
import { getConversations, type Conversation } from '@/lib/conversation-history';

/**
 * React hook for accessing conversation history
 * Automatically loads conversations from API and listens for update events
 */
export function useConversationHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loaded = await getConversations();
      setConversations(loaded);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      console.error('Error loading conversations:', err);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Optimized function to remove a conversation from local state without refetching
  const removeConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
  }, []);

  // Optimized function to add a new conversation to local state without refetching
  const addConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      // Check if conversation already exists
      const exists = prev.some(conv => conv.id === conversation.id);
      if (exists) {
        // Update existing conversation
        return prev.map(conv => conv.id === conversation.id ? conversation : conv);
      } else {
        // Add new conversation at the beginning
        return [conversation, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
      }
    });
  }, []);

  useEffect(() => {
    // Load conversations on mount
    refreshConversations();

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
        refreshConversations();
      }
    };

    window.addEventListener('conversation-history-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('conversation-history-updated', handleCustomStorageChange);
    };
  }, [refreshConversations, removeConversation, addConversation]);

  return {
    conversations,
    isLoading,
    error,
    refresh: refreshConversations,
  };
}

