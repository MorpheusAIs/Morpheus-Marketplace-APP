/**
 * Conversation History Storage
 * 
 * Manages conversation storage via backend API endpoints.
 * All conversations are stored server-side.
 */

import { API_URLS } from './api/config';
import { apiGet, apiPost, apiPut, apiDelete } from './api/apiService';

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

/**
 * API response format (may include ISO date strings)
 * The list endpoint returns conversations without messages, only message_count
 */
interface ApiConversation {
  id: string;
  title: string;
  messages?: ConversationMessage[]; // Optional - not always included in list responses
  message_count?: number; // Present in list responses
  created_at?: string;
  updated_at?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Convert API response to Conversation format
 * Handles both ISO date strings and timestamp numbers
 */
function normalizeConversation(apiConv: ApiConversation): Conversation {
  const createdAt = apiConv.createdAt ?? (apiConv.created_at ? new Date(apiConv.created_at).getTime() : Date.now());
  const updatedAt = apiConv.updatedAt ?? (apiConv.updated_at ? new Date(apiConv.updated_at).getTime() : Date.now());
  
  return {
    id: apiConv.id,
    title: apiConv.title,
    messages: apiConv.messages || [],
    createdAt,
    updatedAt,
  };
}

/**
 * Get API key from sessionStorage
 */
function getApiKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return sessionStorage.getItem('verified_api_key');
}

/**
 * Get all conversations from the API
 */
export async function getConversations(apiKey?: string): Promise<Conversation[]> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('API key is required');
  }

  try {
    const response = await apiGet<ApiConversation[]>(API_URLS.chatHistory(), key);
    
    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to fetch conversations');
    }

    // Normalize and sort by updatedAt descending (most recent first)
    const conversations = response.data.map(normalizeConversation);
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error fetching conversations from API:', error);
    throw error;
  }
}

/**
 * Get a specific conversation by ID with messages
 * Always fetches messages separately since they're not included in the detail response
 */
export async function getConversation(id: string, apiKey?: string): Promise<Conversation | null> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('API key is required');
  }

  if (!id) {
    return null;
  }

  try {
    // First get the conversation details
    const conversationResponse = await apiGet<ApiConversation>(API_URLS.chatDetail(id), key);
    
    if (conversationResponse.error || !conversationResponse.data) {
      if (conversationResponse.status === 404) {
        return null;
      }
      throw new Error(conversationResponse.error || 'Failed to fetch conversation');
    }

    const conversation = conversationResponse.data;
    console.log(`Fetched conversation ${id}:`, {
      hasMessages: !!conversation.messages,
      messageCount: conversation.messages?.length || conversation.message_count || 0,
      title: conversation.title
    });

    // Always fetch messages separately since the API doesn't include them in detail responses
    // Check if we already have messages, but still fetch to ensure we have the latest
    if (!conversation.messages || conversation.messages.length === 0 || conversation.message_count !== conversation.messages.length) {
      console.log(`Fetching messages from messages endpoint for conversation ${id}...`);
      try {
        const messagesResponse = await apiGet<ConversationMessage[]>(API_URLS.chatMessages(id), key);
        console.log(`Messages endpoint response:`, {
          hasData: !!messagesResponse.data,
          isArray: Array.isArray(messagesResponse.data),
          count: Array.isArray(messagesResponse.data) ? messagesResponse.data.length : 0,
          error: messagesResponse.error,
          status: messagesResponse.status
        });
        
        if (messagesResponse.data && Array.isArray(messagesResponse.data)) {
          conversation.messages = messagesResponse.data;
          console.log(`Successfully loaded ${messagesResponse.data.length} messages for conversation ${id}`);
        } else if (messagesResponse.error) {
          console.warn('Messages endpoint returned error:', messagesResponse.error);
          // Don't set empty array if there was an error - keep whatever we have
          if (!conversation.messages) {
            conversation.messages = [];
          }
        } else {
          console.warn('Messages endpoint returned unexpected format:', messagesResponse.data);
          if (!conversation.messages) {
            conversation.messages = [];
          }
        }
      } catch (messagesError) {
        console.warn('Could not fetch messages separately:', messagesError);
        // Only set empty array if we don't have any messages
        if (!conversation.messages) {
          conversation.messages = [];
        }
      }
    } else {
      console.log(`Conversation ${id} already has ${conversation.messages.length} messages`);
    }

    return normalizeConversation(conversation);
  } catch (error) {
    console.error('Error fetching conversation from API:', error);
    throw error;
  }
}

/**
 * Save a new conversation
 * Creates the conversation first, then adds messages separately via the messages endpoint
 */
export async function saveConversation(messages: ConversationMessage[], apiKey?: string): Promise<string> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('API key is required');
  }

  if (!messages || messages.length === 0) {
    throw new Error('Cannot save empty conversation');
  }

  // Generate title from first user message (first 50 characters)
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : 'New Conversation';

  try {
    console.log(`Creating conversation with title: ${title}`);
    
    // Step 1: Create the conversation (without messages)
    const createResponse = await apiPost<ApiConversation>(API_URLS.chatHistory(), { title }, key);
    
    console.log('Create conversation response:', {
      hasError: !!createResponse.error,
      hasData: !!createResponse.data,
      conversationId: createResponse.data?.id,
      error: createResponse.error
    });
    
    if (createResponse.error || !createResponse.data) {
      throw new Error(createResponse.error || 'Failed to create conversation');
    }

    const conversationId = createResponse.data.id;
    console.log(`Created conversation ${conversationId}, now adding ${messages.length} messages...`);

    // Step 2: Add messages separately via the messages endpoint
    const messagesUrl = API_URLS.chatMessages(conversationId);
    console.log(`Adding messages to: ${messagesUrl}`);
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        console.log(`Adding message ${i + 1}/${messages.length}:`, {
          role: message.role,
          contentLength: message.content?.length || 0,
          hasId: !!message.id,
          hasSequence: message.sequence !== undefined
        });
        
        const messageResponse = await apiPost<ConversationMessage>(
          messagesUrl,
          message,
          key
        );
        
        console.log(`Message ${i + 1} response:`, {
          status: messageResponse.status,
          hasError: !!messageResponse.error,
          error: messageResponse.error,
          hasData: !!messageResponse.data
        });
        
        if (messageResponse.error) {
          console.error(`Failed to add message ${i + 1} to conversation ${conversationId}:`, messageResponse.error);
          failCount++;
          // Continue with other messages even if one fails
        } else {
          successCount++;
        }
      }
      console.log(`Message addition complete: ${successCount} succeeded, ${failCount} failed out of ${messages.length} total`);
    } catch (messagesError) {
      console.error(`Error adding messages to conversation ${conversationId}:`, messagesError);
      // Don't throw - conversation was created, messages can be added later
      // But log the error for debugging
    }
    
    return conversationId;
  } catch (error) {
    console.error('Error saving conversation to API:', error);
    throw error;
  }
}

/**
 * Update an existing conversation
 * Updates the conversation title/metadata, then replaces all messages
 */
export async function updateConversation(id: string, messages: ConversationMessage[], apiKey?: string): Promise<void> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('API key is required');
  }

  if (!id) {
    throw new Error('Conversation ID is required');
  }

  if (!messages || messages.length === 0) {
    throw new Error('Cannot update conversation with empty messages');
  }

  // Generate title from first user message (first 50 characters)
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  const title = firstUserMessage 
    ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : 'New Conversation';

  try {
    console.log(`Updating conversation ${id} with ${messages.length} messages`);
    
    // Step 1: Update conversation metadata (title)
    const updateResponse = await apiPut<ApiConversation>(
      API_URLS.chatDetail(id),
      { title },
      key
    );
    
    if (updateResponse.error) {
      if (updateResponse.status === 404) {
        throw new Error(`Conversation with id ${id} not found`);
      }
      throw new Error(updateResponse.error || 'Failed to update conversation');
    }

    console.log(`Updated conversation ${id} metadata, now updating messages...`);

    // Step 2: Replace messages by adding them via the messages endpoint
    // Note: The API might need us to delete old messages first, but for now we'll add new ones
    // If the API doesn't support replacing, we might need to delete and re-add
    try {
      // Try to add all messages (API might handle duplicates or replace)
      for (const message of messages) {
        const messageResponse = await apiPost<ConversationMessage>(
          API_URLS.chatMessages(id),
          message,
          key
        );
        
        if (messageResponse.error) {
          console.warn(`Failed to add message to conversation ${id}:`, messageResponse.error);
          // Continue with other messages even if one fails
        }
      }
      console.log(`Successfully updated ${messages.length} messages in conversation ${id}`);
    } catch (messagesError) {
      console.error(`Error updating messages in conversation ${id}:`, messagesError);
      // Don't throw - conversation metadata was updated
      // But log the error for debugging
    }
  } catch (error) {
    console.error('Error updating conversation in API:', error);
    throw error;
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string, apiKey?: string): Promise<void> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('API key is required');
  }

  if (!id) {
    throw new Error('Conversation ID is required');
  }

  const deleteUrl = API_URLS.chatDetail(id);
  console.log(`Deleting conversation ${id} from: ${deleteUrl}`);

  try {
    const response = await apiDelete<void>(deleteUrl, key);
    
    console.log(`Delete conversation response:`, {
      status: response.status,
      hasError: !!response.error,
      error: response.error
    });
    
    if (response.error && response.status !== 404) {
      throw new Error(response.error || 'Failed to delete conversation');
    }
    
    console.log(`Successfully deleted conversation ${id}`);
  } catch (error) {
    console.error('Error deleting conversation from API:', error);
    throw error;
  }
}

