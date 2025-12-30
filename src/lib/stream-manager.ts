/**
 * Stream Manager
 *
 * Singleton service that manages LLM streaming responses independently of React component lifecycle.
 * This allows streaming to continue in the background when users navigate between conversations.
 */

import { API_URLS } from './api/config';
import { saveConversation, updateConversation, getConversation } from './conversation-history';
import type { ConversationMessage, Conversation } from './conversation-history';

export type StreamStatus = 'pending' | 'streaming' | 'completed' | 'error';

export interface StreamState {
  /** Unique identifier for this stream */
  streamId: string;
  /** Conversation ID (null for new conversations until created) */
  conversationId: string | null;
  /** The user message that initiated this stream */
  userMessage: ConversationMessage;
  /** ID of the assistant message being streamed */
  assistantMessageId: string;
  /** Accumulated content from the stream */
  accumulatedContent: string;
  /** Current status of the stream */
  status: StreamStatus;
  /** Model being used for this stream */
  model: string;
  /** Message history (previous messages in the conversation) */
  messageHistory: ConversationMessage[];
  /** When the stream was created */
  createdAt: number;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Conversation title (for new conversations) */
  title?: string;
}

export interface StartStreamParams {
  /** Existing conversation ID (null for new conversations) */
  conversationId: string | null;
  /** The user's message content */
  userMessageContent: string;
  /** Previous messages in the conversation */
  messageHistory: ConversationMessage[];
  /** Model to use for the completion */
  model: string;
  /** API key for authentication */
  apiKey: string;
  /** System prompt */
  systemPrompt?: string;
}

export interface StreamCallbacks {
  /** Called when new content is received */
  onProgress?: (content: string) => void;
  /** Called when stream completes successfully */
  onComplete?: (content: string, conversationId: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

interface InternalStreamState extends StreamState {
  abortController: AbortController;
  apiKey: string;
  systemPrompt: string;
  subscribers: Map<string, StreamCallbacks>;
}

// Custom event names for stream updates
export const STREAM_EVENTS = {
  PROGRESS: 'stream-manager-progress',
  COMPLETE: 'stream-manager-complete',
  ERROR: 'stream-manager-error',
  NEW_CONVERSATION: 'stream-manager-new-conversation',
} as const;

// Event detail types
export interface StreamProgressEvent {
  streamId: string;
  conversationId: string | null;
  content: string;
}

export interface StreamCompleteEvent {
  streamId: string;
  conversationId: string;
  content: string;
}

export interface StreamErrorEvent {
  streamId: string;
  conversationId: string | null;
  error: string;
}

export interface NewConversationEvent {
  streamId: string;
  conversationId: string;
  title: string;
}

/**
 * StreamManager singleton class
 * Manages all active streams independently of React component lifecycle
 */
class StreamManager {
  private static instance: StreamManager;
  private streams: Map<string, InternalStreamState> = new Map();
  private conversationToStream: Map<string, string> = new Map(); // conversationId -> streamId

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  /**
   * Start a new stream
   * @returns streamId that can be used to track/subscribe to the stream
   */
  async startStream(params: StartStreamParams): Promise<string> {
    const {
      conversationId,
      userMessageContent,
      messageHistory,
      model,
      apiKey,
      systemPrompt = "You are a helpful assistant. Format your responses using Markdown when appropriate. You can use features like **bold text**, *italics*, ### headings, `code blocks`, numbered and bulleted lists, and tables to make your answers more readable and structured."
    } = params;

    // Generate unique stream ID
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Create user message
    const userMessage: ConversationMessage = {
      role: 'user',
      content: userMessageContent,
    };

    // Generate title for new conversations
    const title = userMessageContent.substring(0, 50) + (userMessageContent.length > 50 ? '...' : '');

    // Create stream state
    const streamState: InternalStreamState = {
      streamId,
      conversationId,
      userMessage,
      assistantMessageId,
      accumulatedContent: '',
      status: 'pending',
      model,
      messageHistory,
      createdAt: Date.now(),
      title,
      abortController: new AbortController(),
      apiKey,
      systemPrompt,
      subscribers: new Map(),
    };

    // Register the stream
    this.streams.set(streamId, streamState);
    if (conversationId) {
      this.conversationToStream.set(conversationId, streamId);
    }

    // Start the streaming process (async, doesn't block)
    this.processStream(streamId);

    return streamId;
  }

  /**
   * Get stream state by stream ID
   */
  getStreamState(streamId: string): StreamState | undefined {
    const internal = this.streams.get(streamId);
    if (!internal) return undefined;

    // Return public state (without internal fields)
    const { abortController: _a, apiKey: _k, systemPrompt: _s, subscribers: _sub, ...publicState } = internal;
    return publicState;
  }

  /**
   * Get active stream for a conversation
   */
  getStreamForConversation(conversationId: string | null): StreamState | undefined {
    if (!conversationId) {
      // For new conversations, find any pending stream without conversationId
      for (const [, state] of this.streams) {
        if (!state.conversationId && (state.status === 'pending' || state.status === 'streaming')) {
          const { abortController: _a, apiKey: _k, systemPrompt: _s, subscribers: _sub, ...publicState } = state;
          return publicState;
        }
      }
      return undefined;
    }

    const streamId = this.conversationToStream.get(conversationId);
    if (!streamId) return undefined;

    return this.getStreamState(streamId);
  }

  /**
   * Get all active streams (pending or streaming)
   */
  getActiveStreams(): StreamState[] {
    const active: StreamState[] = [];
    for (const [, state] of this.streams) {
      if (state.status === 'pending' || state.status === 'streaming') {
        const { abortController: _a, apiKey: _k, systemPrompt: _s, subscribers: _sub, ...publicState } = state;
        active.push(publicState);
      }
    }
    return active;
  }

  /**
   * Check if a conversation has an active stream
   */
  hasActiveStream(conversationId: string | null): boolean {
    const stream = this.getStreamForConversation(conversationId);
    return !!stream && (stream.status === 'pending' || stream.status === 'streaming');
  }

  /**
   * Subscribe to stream updates
   * @returns Unsubscribe function
   */
  subscribeToStream(streamId: string, callbacks: StreamCallbacks): () => void {
    const state = this.streams.get(streamId);
    if (!state) {
      console.warn(`Cannot subscribe to non-existent stream: ${streamId}`);
      return () => {};
    }

    const subscriberId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    state.subscribers.set(subscriberId, callbacks);

    // If stream is already completed or errored, immediately call the appropriate callback
    if (state.status === 'completed' && callbacks.onComplete) {
      callbacks.onComplete(state.accumulatedContent, state.conversationId!);
    } else if (state.status === 'error' && callbacks.onError) {
      callbacks.onError(new Error(state.errorMessage || 'Unknown error'));
    } else if (state.status === 'streaming' && callbacks.onProgress) {
      // Send current accumulated content
      callbacks.onProgress(state.accumulatedContent);
    }

    // Return unsubscribe function
    return () => {
      state.subscribers.delete(subscriberId);
    };
  }

  /**
   * Abort a stream
   */
  abortStream(streamId: string): void {
    const state = this.streams.get(streamId);
    if (!state) return;

    state.abortController.abort();
    state.status = 'error';
    state.errorMessage = 'Stream aborted by user';

    // Notify subscribers
    this.notifyError(state, new Error('Stream aborted by user'));
  }

  /**
   * Abort stream for a conversation
   */
  abortStreamForConversation(conversationId: string | null): void {
    if (!conversationId) {
      // Find and abort any pending stream without conversationId
      for (const [streamId, state] of this.streams) {
        if (!state.conversationId && (state.status === 'pending' || state.status === 'streaming')) {
          this.abortStream(streamId);
          return;
        }
      }
      return;
    }

    const streamId = this.conversationToStream.get(conversationId);
    if (streamId) {
      this.abortStream(streamId);
    }
  }

  /**
   * Clean up old completed/errored streams
   */
  cleanup(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [streamId, state] of this.streams) {
      if (
        (state.status === 'completed' || state.status === 'error') &&
        now - state.createdAt > maxAgeMs
      ) {
        toDelete.push(streamId);
      }
    }

    for (const streamId of toDelete) {
      const state = this.streams.get(streamId);
      if (state?.conversationId) {
        this.conversationToStream.delete(state.conversationId);
      }
      this.streams.delete(streamId);
    }
  }

  /**
   * Process a stream (internal method)
   */
  private async processStream(streamId: string): Promise<void> {
    const state = this.streams.get(streamId);
    if (!state) return;

    try {
      // Step 1: Create/save the conversation with user message immediately
      let actualConversationId = state.conversationId;

      if (!actualConversationId) {
        // New conversation - create it first
        console.log(`[StreamManager] Creating new conversation for stream ${streamId}`);

        // Save conversation with user message
        const allMessages: ConversationMessage[] = [
          ...state.messageHistory,
          state.userMessage,
        ];

        actualConversationId = await saveConversation(allMessages, state.apiKey);

        // Update state with new conversation ID
        state.conversationId = actualConversationId;
        this.conversationToStream.set(actualConversationId, streamId);

        console.log(`[StreamManager] Created conversation ${actualConversationId} for stream ${streamId}`);

        // Emit new conversation event
        this.emitEvent(STREAM_EVENTS.NEW_CONVERSATION, {
          streamId,
          conversationId: actualConversationId,
          title: state.title || 'New Chat',
        });
      } else {
        // Existing conversation - save user message immediately
        console.log(`[StreamManager] Saving user message to existing conversation ${actualConversationId}`);
        await updateConversation(actualConversationId, [state.userMessage], state.apiKey);
      }

      // Step 2: Start streaming
      state.status = 'streaming';

      // Build request body
      const requestBody = {
        model: state.model,
        messages: [
          { role: "system", content: state.systemPrompt },
          ...state.messageHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          { role: "user", content: state.userMessage.content }
        ],
        stream: true
      };

      const response = await fetch(API_URLS.chatCompletions(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'text/event-stream',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody?.error?.message || errorBody?.detail || `API returned status ${response.status}`;
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      // Process stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;

              if (delta) {
                state.accumulatedContent += delta;

                // Notify subscribers
                this.notifyProgress(state);
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      // Step 3: Stream completed - save assistant message
      console.log(`[StreamManager] Stream ${streamId} completed, saving assistant message to conversation ${actualConversationId}`);

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: state.accumulatedContent,
        id: state.assistantMessageId,
      };

      await updateConversation(actualConversationId!, [assistantMessage], state.apiKey);

      // Update state
      state.status = 'completed';

      // Notify subscribers
      this.notifyComplete(state);

      // Emit completion event for sidebar update
      window.dispatchEvent(new CustomEvent('conversation-history-updated', {
        detail: {
          type: state.messageHistory.length === 0 ? 'created' : 'updated',
          id: actualConversationId,
          conversation: await getConversation(actualConversationId!, state.apiKey)
        }
      }));

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was aborted, already handled
        return;
      }

      console.error(`[StreamManager] Error in stream ${streamId}:`, error);
      state.status = 'error';
      state.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Notify subscribers
      this.notifyError(state, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Notify subscribers of progress
   */
  private notifyProgress(state: InternalStreamState): void {
    for (const [, callbacks] of state.subscribers) {
      callbacks.onProgress?.(state.accumulatedContent);
    }

    // Also emit global event
    this.emitEvent(STREAM_EVENTS.PROGRESS, {
      streamId: state.streamId,
      conversationId: state.conversationId,
      content: state.accumulatedContent,
    });
  }

  /**
   * Notify subscribers of completion
   */
  private notifyComplete(state: InternalStreamState): void {
    for (const [, callbacks] of state.subscribers) {
      callbacks.onComplete?.(state.accumulatedContent, state.conversationId!);
    }

    // Also emit global event
    this.emitEvent(STREAM_EVENTS.COMPLETE, {
      streamId: state.streamId,
      conversationId: state.conversationId!,
      content: state.accumulatedContent,
    });
  }

  /**
   * Notify subscribers of error
   */
  private notifyError(state: InternalStreamState, error: Error): void {
    for (const [, callbacks] of state.subscribers) {
      callbacks.onError?.(error);
    }

    // Also emit global event
    this.emitEvent(STREAM_EVENTS.ERROR, {
      streamId: state.streamId,
      conversationId: state.conversationId,
      error: error.message,
    });
  }

  /**
   * Emit a custom event
   */
  private emitEvent(eventName: string, detail: unknown): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
  }
}

// Export singleton instance getter
export const getStreamManager = (): StreamManager => StreamManager.getInstance();

// Export for testing
export { StreamManager };
