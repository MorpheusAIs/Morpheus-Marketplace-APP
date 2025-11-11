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
  startNewConversation: () => void;
  loadConversation: (id: string) => Conversation | null;
  saveCurrentConversation: (messages: ConversationMessage[]) => string;
  updateCurrentConversation: (messages: ConversationMessage[]) => void;
  deleteConversationById: (id: string) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    // Dispatch custom event to notify components
    window.dispatchEvent(new Event('conversation-history-updated'));
    window.dispatchEvent(new CustomEvent('new-conversation-started'));
  }, []);

  const loadConversation = useCallback((id: string): Conversation | null => {
    const conversation = getConversation(id);
    if (conversation) {
      setCurrentConversationId(id);
    }
    return conversation;
  }, []);

  const saveCurrentConversation = useCallback((messages: ConversationMessage[]): string => {
    if (messages.length === 0) {
      throw new Error('Cannot save empty conversation');
    }

    const id = saveConversation(messages);
    setCurrentConversationId(id);
    // Dispatch custom event to notify components
    window.dispatchEvent(new Event('conversation-history-updated'));
    return id;
  }, []);

  const updateCurrentConversation = useCallback((messages: ConversationMessage[]) => {
    if (!currentConversationId) {
      throw new Error('No active conversation to update');
    }
    updateConversation(currentConversationId, messages);
    // Dispatch custom event to notify components
    window.dispatchEvent(new Event('conversation-history-updated'));
  }, [currentConversationId]);

  const deleteConversationById = useCallback((id: string) => {
    deleteConversation(id);
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
    // Dispatch custom event to notify components
    window.dispatchEvent(new Event('conversation-history-updated'));
  }, [currentConversationId]);

  return (
    <ConversationContext.Provider
      value={{
        currentConversationId,
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

