'use client';

import { useState, useEffect } from 'react';
import { getConversations, type Conversation } from '@/lib/conversation-history';

/**
 * React hook for accessing conversation history
 * Automatically loads conversations and listens for storage events
 */
export function useConversationHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConversations = () => {
    setIsLoading(true);
    try {
      const loaded = getConversations();
      setConversations(loaded);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load conversations on mount
    refreshConversations();

    // Listen for storage events (for cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'morpheus-conversation-history') {
        refreshConversations();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (for same-tab updates)
    const handleCustomStorageChange = () => {
      refreshConversations();
    };

    window.addEventListener('conversation-history-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('conversation-history-updated', handleCustomStorageChange);
    };
  }, []);

  return {
    conversations,
    isLoading,
    refresh: refreshConversations,
  };
}

