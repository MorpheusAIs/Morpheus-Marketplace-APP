'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  getConversation,
  saveConversation,
  updateConversation,
  deleteConversation,
  type ConversationMessage,
  type Conversation,
} from './conversation-history';

interface ConversationContextType {
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  startNewConversation: () => void;
  loadConversation: (id: string, apiKey?: string) => Promise<Conversation | null>;
  saveCurrentConversation: (messages: ConversationMessage[], apiKey?: string) => Promise<string>;
  updateCurrentConversation: (messages: ConversationMessage[], apiKey?: string) => Promise<void>;
  deleteConversationById: (id: string, apiKey?: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setError(null);
    // Only dispatch new-conversation-started event, not conversation-history-updated
    // We don't need to refresh the list when starting a new conversation
    window.dispatchEvent(new CustomEvent('new-conversation-started'));
  }, []);

  const loadConversation = useCallback(async (id: string, apiKey?: string): Promise<Conversation | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const conversation = await getConversation(id, apiKey);
      if (conversation) {
        setCurrentConversationId(id);
      }
      return conversation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      setError(errorMessage);
      console.error('Error loading conversation:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCurrentConversation = useCallback(async (messages: ConversationMessage[], apiKey?: string): Promise<string> => {
    // Filter out messages with empty content
    const messagesWithContent = messages.filter(msg => msg.content && msg.content.trim().length > 0);
    
    // Check if we have at least one user message with content
    const hasUserMessage = messagesWithContent.some(msg => msg.role === 'user');
    
    if (messagesWithContent.length === 0 || !hasUserMessage) {
      throw new Error('Cannot save empty conversation');
    }

    setIsLoading(true);
    setError(null);

    try {
      const id = await saveConversation(messages, apiKey);
      setCurrentConversationId(id);
      
      // Fetch the newly created conversation to get full details
      const newConversation = await getConversation(id, apiKey);
      
      // Dispatch custom event with conversation details for optimized state update
      if (newConversation) {
        window.dispatchEvent(new CustomEvent('conversation-history-updated', {
          detail: { type: 'created', conversation: newConversation }
        }));
      } else {
        // Fallback to full refresh if we can't get the conversation
        window.dispatchEvent(new Event('conversation-history-updated'));
      }
      
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save conversation';
      setError(errorMessage);
      console.error('Error saving conversation:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCurrentConversation = useCallback(async (messages: ConversationMessage[], apiKey?: string): Promise<void> => {
    if (!currentConversationId) {
      throw new Error('No active conversation to update');
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateConversation(currentConversationId, messages, apiKey);
      
      // Fetch the updated conversation to get full details
      const updatedConversation = await getConversation(currentConversationId, apiKey);
      
      // Dispatch custom event with conversation details for optimized state update
      if (updatedConversation) {
        window.dispatchEvent(new CustomEvent('conversation-history-updated', {
          detail: { type: 'updated', conversation: updatedConversation }
        }));
      } else {
        // Fallback to full refresh if we can't get the conversation
        window.dispatchEvent(new Event('conversation-history-updated'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conversation';
      setError(errorMessage);
      console.error('Error updating conversation:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId]);

  const deleteConversationById = useCallback(async (id: string, apiKey?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await deleteConversation(id, apiKey);
      
      // Only update state if delete was successful
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
      
      // Dispatch custom event with delete details for optimized state update
      // Only dispatch if delete succeeded
      window.dispatchEvent(new CustomEvent('conversation-history-updated', {
        detail: { type: 'deleted', id }
      }));
      
      console.log(`Successfully deleted conversation ${id} and updated UI`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(errorMessage);
      console.error('Error deleting conversation:', err);
      
      // Don't remove from UI if delete failed - force a refresh to show actual state
      console.log('Delete failed, refreshing conversation list to show actual state');
      window.dispatchEvent(new Event('conversation-history-updated'));
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId]);

  return (
    <ConversationContext.Provider
      value={{
        currentConversationId,
        isLoading,
        error,
        startNewConversation,
        loadConversation,
        saveCurrentConversation,
        updateCurrentConversation,
        deleteConversationById,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}

