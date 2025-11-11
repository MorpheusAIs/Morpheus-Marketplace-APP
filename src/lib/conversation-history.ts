/**
 * Conversation History Storage
 * 
 * Manages conversation storage in browser localStorage.
 * All conversations are stored client-side only.
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  sequence?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'morpheus-conversation-history';
const MAX_CONVERSATIONS = 50;

/**
 * Get all conversations from localStorage
 */
export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const conversations: Conversation[] = JSON.parse(stored);
    // Sort by updatedAt descending (most recent first)
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error reading conversations from localStorage:', error);
    return [];
  }
}

/**
 * Get a specific conversation by ID
 */
export function getConversation(id: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find(conv => conv.id === id) || null;
}

/**
 * Save a new conversation
 */
export function saveConversation(messages: ConversationMessage[]): string {
  if (typeof window === 'undefined' || messages.length === 0) {
    throw new Error('Cannot save empty conversation');
  }

  const conversations = getConversations();
  const now = Date.now();
  
  // Generate title from first user message (first 50 characters)
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : 'New Conversation';

  const newConversation: Conversation = {
    id: `conv-${now}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    messages,
    createdAt: now,
    updatedAt: now,
  };

  // Add new conversation and keep only the most recent MAX_CONVERSATIONS
  const updatedConversations = [newConversation, ...conversations].slice(0, MAX_CONVERSATIONS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConversations));
    return newConversation.id;
  } catch (error) {
    console.error('Error saving conversation to localStorage:', error);
    throw error;
  }
}

/**
 * Update an existing conversation
 */
export function updateConversation(id: string, messages: ConversationMessage[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  const conversations = getConversations();
  const index = conversations.findIndex(conv => conv.id === id);

  if (index === -1) {
    throw new Error(`Conversation with id ${id} not found`);
  }

  // Update title if first message changed
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : conversations[index].title;

  conversations[index] = {
    ...conversations[index],
    title,
    messages,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error updating conversation in localStorage:', error);
    throw error;
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const conversations = getConversations();
  const filtered = conversations.filter(conv => conv.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting conversation from localStorage:', error);
    throw error;
  }
}

/**
 * Clear all conversations
 */
export function clearAllConversations(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing conversations from localStorage:', error);
    throw error;
  }
}

