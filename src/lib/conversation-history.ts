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
 * Fetches conversation details and messages in parallel for better performance
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
    // Fetch conversation details and messages in parallel for better performance
    const [conversationResponse, messagesResponse] = await Promise.all([
      apiGet<ApiConversation>(API_URLS.chatDetail(id), key),
      apiGet<ConversationMessage[]>(API_URLS.chatMessages(id), key)
    ]);

    if (conversationResponse.error || !conversationResponse.data) {
      if (conversationResponse.status === 404) {
        return null;
      }
      throw new Error(conversationResponse.error || 'Failed to fetch conversation');
    }

    const conversation = conversationResponse.data;

    // Use messages from parallel fetch
    if (messagesResponse.data && Array.isArray(messagesResponse.data)) {
      conversation.messages = messagesResponse.data;
    } else if (!conversation.messages) {
      conversation.messages = [];
    }

    console.log(`Fetched conversation ${id} with ${conversation.messages?.length || 0} messages (parallel fetch)`);

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

  // Filter out messages with empty content (but keep messages with content)
  const messagesWithContent = messages.filter(msg => msg.content && msg.content.trim().length > 0);
  
  // Check if we have at least one user message with content
  const hasUserMessage = messagesWithContent.some(msg => msg.role === 'user');
  
  if (messagesWithContent.length === 0 || !hasUserMessage) {
    throw new Error('Cannot save empty conversation');
  }

  // Generate title from first user message (first 50 characters)
  const firstUserMessage = messagesWithContent.find(msg => msg.role === 'user');
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
    console.log(`Created conversation ${conversationId}, now adding ${messagesWithContent.length} messages in parallel...`);

    // Step 2: Add messages in parallel via the messages endpoint
    const messagesUrl = API_URLS.chatMessages(conversationId);

    try {
      // Add all messages in parallel for better performance
      const messagePromises = messagesWithContent.map((message, i) =>
        apiPost<ConversationMessage>(messagesUrl, message, key)
          .then(response => ({ index: i, success: !response.error, error: response.error }))
          .catch(err => ({ index: i, success: false, error: err.message }))
      );

      const results = await Promise.all(messagePromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(`Message addition complete: ${successCount} succeeded, ${failCount} failed out of ${messagesWithContent.length} total (parallel)`);
    } catch (messagesError) {
      console.error(`Error adding messages to conversation ${conversationId}:`, messagesError);
      // Don't throw - conversation was created, messages can be added later
    }

    return conversationId;
  } catch (error) {
    console.error('Error saving conversation to API:', error);
    throw error;
  }
}

/**
 * Update an existing conversation
 * Only adds new messages to the conversation. The title is never changed after creation.
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

  // Filter out messages with empty content (but keep messages with content)
  const messagesWithContent = messages.filter(msg => msg.content && msg.content.trim().length > 0);
  
  // Check if we have at least one user message with content
  const hasUserMessage = messagesWithContent.some(msg => msg.role === 'user');
  
  if (messagesWithContent.length === 0 || !hasUserMessage) {
    console.log(`Skipping update for conversation ${id}: no valid messages with content`);
    return; // Silent no-op - this is a valid scenario when messages are already synced
  }

  try {
    console.log(`Updating conversation ${id} with ${messages.length} messages`);

    // Only add NEW messages that don't already exist
    // Fetch existing messages first to avoid duplicates, with fallback if fetch fails
    try {
      let existingMessages: ConversationMessage[] = [];
      const existingMessageKeys = new Set<string>();
      
      try {
        // Get existing messages from the conversation with a timeout
        const existingMessagesResponse = await apiGet<ConversationMessage[]>(
          API_URLS.chatMessages(id), 
          key,
          { timeout: 10000 } // 10 second timeout
        );
        
        if (existingMessagesResponse.error) {
          console.warn(`Could not fetch existing messages for conversation ${id}:`, existingMessagesResponse.error);
          // Continue without deduplication - API should handle duplicates
        } else {
          existingMessages = existingMessagesResponse.data || [];
          
          // Create a set of existing message keys for quick lookup
          existingMessages.forEach(msg => {
            const key = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
            existingMessageKeys.add(key);
          });
        }
      } catch (fetchError) {
        console.warn(`Error fetching existing messages for conversation ${id}, proceeding without deduplication:`, fetchError);
        // Continue without deduplication - API should handle duplicates or we'll deduplicate on load
      }
      
      // Filter to only new messages that don't already exist (if we successfully fetched existing messages)
      const newMessages = existingMessageKeys.size > 0
        ? messagesWithContent.filter(msg => {
            const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
            return !existingMessageKeys.has(messageKey);
          })
        : messagesWithContent; // If we couldn't fetch existing messages, try to add all (API should handle duplicates)
      
      console.log(`Found ${existingMessages.length} existing messages, adding ${newMessages.length} new messages`);
      
      // Only add new messages that don't already exist - batch in parallel
      if (newMessages.length > 0) {
        const messagePromises = newMessages.map(message =>
          apiPost<ConversationMessage>(
            API_URLS.chatMessages(id),
            message,
            key,
            { timeout: 10000 }
          )
            .then(response => ({ success: !response.error, error: response.error }))
            .catch(err => ({ success: false, error: err.message }))
        );

        const results = await Promise.all(messagePromises);
        const successCount = results.filter(r => r.success).length;
        console.log(`Added ${successCount}/${newMessages.length} new messages to conversation ${id} (parallel)`);
      } else {
        console.log(`No new messages to add to conversation ${id} (all messages already exist)`);
      }
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

