'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  getStreamManager,
  type StreamState,
  type StartStreamParams,
  type StreamCallbacks,
  STREAM_EVENTS,
} from './stream-manager';

interface StreamManagerContextType {
  /**
   * Start a new stream
   * @returns Promise that resolves to the stream ID
   */
  startStream: (params: StartStreamParams) => Promise<string>;

  /**
   * Get stream state for a specific stream ID
   */
  getStreamState: (streamId: string) => StreamState | undefined;

  /**
   * Get active stream for a conversation (if any)
   */
  getStreamForConversation: (conversationId: string | null) => StreamState | undefined;

  /**
   * Get all active streams
   */
  getActiveStreams: () => StreamState[];

  /**
   * Check if a conversation has an active stream
   */
  hasActiveStream: (conversationId: string | null) => boolean;

  /**
   * Subscribe to stream updates
   * @returns Unsubscribe function
   */
  subscribeToStream: (streamId: string, callbacks: StreamCallbacks) => () => void;

  /**
   * Abort a specific stream
   */
  abortStream: (streamId: string) => void;

  /**
   * Abort stream for a conversation
   */
  abortStreamForConversation: (conversationId: string | null) => void;
}

const StreamManagerContext = createContext<StreamManagerContextType | null>(null);

interface StreamManagerProviderProps {
  children: React.ReactNode;
}

export function StreamManagerProvider({ children }: StreamManagerProviderProps) {
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize cleanup interval
  useEffect(() => {
    // Clean up old streams every minute
    cleanupIntervalRef.current = setInterval(() => {
      getStreamManager().cleanup();
    }, 60 * 1000);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, []);

  const startStream = useCallback(async (params: StartStreamParams): Promise<string> => {
    return getStreamManager().startStream(params);
  }, []);

  const getStreamState = useCallback((streamId: string): StreamState | undefined => {
    return getStreamManager().getStreamState(streamId);
  }, []);

  const getStreamForConversation = useCallback((conversationId: string | null): StreamState | undefined => {
    return getStreamManager().getStreamForConversation(conversationId);
  }, []);

  const getActiveStreams = useCallback((): StreamState[] => {
    return getStreamManager().getActiveStreams();
  }, []);

  const hasActiveStream = useCallback((conversationId: string | null): boolean => {
    return getStreamManager().hasActiveStream(conversationId);
  }, []);

  const subscribeToStream = useCallback((streamId: string, callbacks: StreamCallbacks): (() => void) => {
    return getStreamManager().subscribeToStream(streamId, callbacks);
  }, []);

  const abortStream = useCallback((streamId: string): void => {
    getStreamManager().abortStream(streamId);
  }, []);

  const abortStreamForConversation = useCallback((conversationId: string | null): void => {
    getStreamManager().abortStreamForConversation(conversationId);
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<StreamManagerContextType>(() => ({
    startStream,
    getStreamState,
    getStreamForConversation,
    getActiveStreams,
    hasActiveStream,
    subscribeToStream,
    abortStream,
    abortStreamForConversation,
  }), [
    startStream,
    getStreamState,
    getStreamForConversation,
    getActiveStreams,
    hasActiveStream,
    subscribeToStream,
    abortStream,
    abortStreamForConversation,
  ]);

  return (
    <StreamManagerContext.Provider value={value}>
      {children}
    </StreamManagerContext.Provider>
  );
}

/**
 * Hook to access the StreamManager context
 */
export function useStreamManager(): StreamManagerContextType {
  const context = useContext(StreamManagerContext);
  if (!context) {
    throw new Error('useStreamManager must be used within a StreamManagerProvider');
  }
  return context;
}

/**
 * Hook to subscribe to stream events for a specific conversation
 * Automatically handles subscription/unsubscription lifecycle
 */
export function useConversationStream(
  conversationId: string | null,
  callbacks: StreamCallbacks
): StreamState | undefined {
  const { getStreamForConversation, subscribeToStream } = useStreamManager();
  const callbacksRef = useRef(callbacks);
  const [streamState, setStreamState] = React.useState<StreamState | undefined>(() =>
    getStreamForConversation(conversationId)
  );

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Subscribe to stream updates
  useEffect(() => {
    const stream = getStreamForConversation(conversationId);
    setStreamState(stream);

    if (!stream) return;

    const unsubscribe = subscribeToStream(stream.streamId, {
      onProgress: (content) => {
        setStreamState(prev => prev ? { ...prev, accumulatedContent: content, status: 'streaming' } : prev);
        callbacksRef.current.onProgress?.(content);
      },
      onComplete: (content, convId) => {
        setStreamState(prev => prev ? { ...prev, accumulatedContent: content, status: 'completed', conversationId: convId } : prev);
        callbacksRef.current.onComplete?.(content, convId);
      },
      onError: (error) => {
        setStreamState(prev => prev ? { ...prev, status: 'error', errorMessage: error.message } : prev);
        callbacksRef.current.onError?.(error);
      },
    });

    return unsubscribe;
  }, [conversationId, getStreamForConversation, subscribeToStream]);

  // Listen for new conversation events that might affect this hook
  useEffect(() => {
    const handleNewConversation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;

      // If we were tracking a null conversationId and a new one was created, update
      if (conversationId === null && detail?.conversationId) {
        const stream = getStreamForConversation(detail.conversationId);
        if (stream) {
          setStreamState(stream);
        }
      }
    };

    window.addEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversation);
    return () => {
      window.removeEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversation);
    };
  }, [conversationId, getStreamForConversation]);

  return streamState;
}

/**
 * Hook to get all active streams (useful for sidebar indicators)
 */
export function useActiveStreams(): StreamState[] {
  const { getActiveStreams } = useStreamManager();
  const [activeStreams, setActiveStreams] = React.useState<StreamState[]>(() => getActiveStreams());

  useEffect(() => {
    // Update on any stream event
    const updateStreams = () => {
      setActiveStreams(getActiveStreams());
    };

    window.addEventListener(STREAM_EVENTS.PROGRESS, updateStreams);
    window.addEventListener(STREAM_EVENTS.COMPLETE, updateStreams);
    window.addEventListener(STREAM_EVENTS.ERROR, updateStreams);
    window.addEventListener(STREAM_EVENTS.NEW_CONVERSATION, updateStreams);

    // Initial update
    updateStreams();

    return () => {
      window.removeEventListener(STREAM_EVENTS.PROGRESS, updateStreams);
      window.removeEventListener(STREAM_EVENTS.COMPLETE, updateStreams);
      window.removeEventListener(STREAM_EVENTS.ERROR, updateStreams);
      window.removeEventListener(STREAM_EVENTS.NEW_CONVERSATION, updateStreams);
    };
  }, [getActiveStreams]);

  return activeStreams;
}

export { STREAM_EVENTS };
