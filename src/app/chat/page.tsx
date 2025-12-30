'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { useConversation } from '@/lib/ConversationContext';
import { useStreamManager } from '@/lib/StreamManagerContext';
import { STREAM_EVENTS } from '@/lib/stream-manager';
import type { ConversationMessage } from '@/lib/conversation-history';
import { API_URLS } from '@/lib/api/config';
import { RESILIENCE_CONFIG } from '@/lib/api/apiService';
import { getAllowedModelTypes, filterModelsByType, getFilterOptions, selectDefaultModel } from '@/lib/model-filter-utils';
import { logModelName } from '@/lib/model-name-utils';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MessageSquare, CheckIcon, Settings, Trash2, Key, Loader2, Wifi, CopyIcon } from 'lucide-react';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import './markdown.css';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from '@/components/ai-elements/context';
import { ChatSettingsDialog } from '@/components/chat-settings-dialog';
import { getContextWindow } from 'tokenlens';
import type { LanguageModelUsage } from 'ai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Type definitions
type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sequence?: number;
};

type Model = {
  id: string;
  blockchainId?: string;
  created?: number;
  tags?: string[];
  ModelType?: string;
};

interface ApiModelResponse {
  id: string;
  blockchainID?: string;
  blockchainId?: string;
  created?: number;
  modelType?: string;
  ModelType?: string;
}

// Connection status type for better UX during high-latency connections
type ConnectionStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'retrying';

type ApiErrorResponse = {
  detail?: string;
  error?: {
    message?: string;
  };
};

export default function ChatPage() {
  // Cognito authentication
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading: _authLoading } = useCognitoAuth();
  const { error, warning, success } = useNotification();
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentConversationId,
    deleteConversationById,
    loadConversation
  } = useConversation();
  const {
    startStream,
    getStreamForConversation,
    subscribeToStream,
    abortStreamForConversation
  } = useStreamManager();
  
  // API Key state (retrieved from sessionStorage)
  const [fullApiKey, setFullApiKey] = useState<string>('');
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string>('');
  
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Chat state
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_authError, setAuthError] = useState(false);
  const [saveChatHistory, setSaveChatHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('save_chat_history');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [streamingStatus, setStreamingStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  
  // Connection status for high-latency feedback
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  
  // Model state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('default');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loadingModels, setLoadingModels] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedModelType, setSelectedModelType] = useState<string>('all');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_filterOptions, setFilterOptions] = useState<Array<{value: string, label: string}>>([]);
  const [allowedTypes] = useState<string[]>(getAllowedModelTypes());
  
  // Chat history state - using localStorage now
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  
  // Chat settings modal state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Streaming state
  const [streamingContent, setStreamingContent] = useState<string>('');
  const currentConversationIdRef = useRef<string | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);
  
  // Token usage state
  const [tokenUsage, setTokenUsage] = useState<LanguageModelUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
  const [maxTokens, setMaxTokens] = useState<number>(128_000); // Default fallback

  // Sync ref with context value and clear messages when starting new conversation
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
    // When conversation ID becomes null (new conversation started), ensure messages are cleared
    if (!currentConversationId) {
      setMessages([]);
      setStreamingContent('');
    }
  }, [currentConversationId]);

  // Load API key from sessionStorage
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem('verified_api_key');
    const storedPrefix = sessionStorage.getItem('verified_api_key_prefix');

    if (storedApiKey && storedPrefix) {
      setFullApiKey(storedApiKey);
      setApiKeyPrefix(storedPrefix);
    }
  }, []);

  // Listen for new conversation creation from StreamManager and navigate
  useEffect(() => {
    const handleNewConversationCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { conversationId } = customEvent.detail || {};

      // Only navigate if this is the page that started the stream (has the stream ID)
      if (conversationId && currentStreamIdRef.current) {
        console.log(`[ChatPage] New conversation created: ${conversationId}, navigating...`);
        // Per user preference, we stay on /chat and don't auto-navigate
        // The user will click from sidebar when ready
        // But we should clear the current stream ref since it completed
        // Navigation will happen when user clicks sidebar
      }
    };

    window.addEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversationCreated);
    return () => {
      window.removeEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversationCreated);
    };
  }, []);

  // Restore stream state on mount for new conversations (null conversationId)
  useEffect(() => {
    // Check if there's an active stream for a new conversation
    const existingStream = getStreamForConversation(null);

    if (existingStream) {
      console.log(`[ChatPage] Found existing stream for new conversation:`, existingStream.status);
      currentStreamIdRef.current = existingStream.streamId;

      // Restore streaming content if stream is in progress
      if (existingStream.status === 'streaming' || existingStream.status === 'pending') {
        setStreamingStatus(existingStream.status === 'pending' ? 'submitted' : 'streaming');
        setStreamingContent(existingStream.accumulatedContent);
        setIsLoading(true);
        setConnectionStatus('streaming');

        // Add the user message and streaming assistant message to UI
        const userMsg: Message = {
          role: 'user',
          content: existingStream.userMessage.content,
        };
        const assistantMsg: Message = {
          id: existingStream.assistantMessageId,
          role: 'assistant',
          content: existingStream.accumulatedContent,
        };

        setMessages(prev => {
          // Only add if not already present
          const hasUserMsg = prev.some(m => m.role === 'user' && m.content === userMsg.content);
          if (hasUserMsg) {
            // Just update the last assistant message
            return prev.map((m, i) =>
              i === prev.length - 1 && m.role === 'assistant'
                ? { ...m, content: existingStream.accumulatedContent }
                : m
            );
          }
          return [...prev, userMsg, assistantMsg];
        });
      }

      // Subscribe to stream updates
      const unsubscribe = subscribeToStream(existingStream.streamId, {
        onProgress: (content) => {
          setStreamingContent(content);
          setStreamingStatus('streaming');
          setConnectionStatus('streaming');
          setMessages(prev =>
            prev.map((msg, i) =>
              i === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, content }
                : msg
            )
          );
        },
        onComplete: (content) => {
          setStreamingContent('');
          setStreamingStatus('ready');
          setConnectionStatus('idle');
          setIsLoading(false);
          currentStreamIdRef.current = null;
          setMessages(prev =>
            prev.map((msg, i) =>
              i === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, content }
                : msg
            )
          );
        },
        onError: (error) => {
          console.error('[ChatPage] Stream error:', error);
          setStreamingContent('');
          setStreamingStatus('error');
          setConnectionStatus('error');
          setIsLoading(false);
          currentStreamIdRef.current = null;
        },
      });

      return unsubscribe;
    }
  }, [getStreamForConversation, subscribeToStream]);

  // Update title when conversation ID changes
  useEffect(() => {
    const updateTitle = async () => {
      if (currentConversationId) {
        try {
          const conversation = await loadConversation(currentConversationId);
          if (conversation) {
            setConversationTitle(conversation.title);
          }
        } catch (err) {
          console.error('Error loading conversation for title:', err);
        }
      } else {
        setConversationTitle('New Chat');
      }
    };

    updateTitle();
  }, [currentConversationId, loadConversation]);

  // Also listen for conversation history updates to refresh title
  useEffect(() => {
    const handleHistoryUpdate = async () => {
      if (currentConversationId) {
        try {
          const conversation = await loadConversation(currentConversationId);
          if (conversation) {
            setConversationTitle(conversation.title);
          }
        } catch (err) {
          console.error('Error loading conversation for title update:', err);
        }
      }
    };

    window.addEventListener('conversation-history-updated', handleHistoryUpdate);
    return () => {
      window.removeEventListener('conversation-history-updated', handleHistoryUpdate);
    };
  }, [currentConversationId, loadConversation]);

  // Listen for conversation load events from sidebar
  useEffect(() => {
    const handleLoadConversation = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const conversation = customEvent.detail;
      if (conversation && conversation.id) {
        // Navigate to the conversation route instead of loading here
        router.push(`/chat/${conversation.id}`);
      }
    };

    const handleNewConversation = () => {
      // Ensure we're on the base /chat route for new conversations
      if (pathname !== '/chat') {
        router.push('/chat');
      }
      setMessages([]);
      setStreamingContent('');
      // Clear the ref immediately when starting a new conversation
      currentConversationIdRef.current = null;
    };

    window.addEventListener('load-conversation', handleLoadConversation);
    window.addEventListener('new-conversation-started', handleNewConversation);

    return () => {
      window.removeEventListener('load-conversation', handleLoadConversation);
      window.removeEventListener('new-conversation-started', handleNewConversation);
    };
  }, [router, pathname]);

  // Load save chat history preference
  useEffect(() => {
    const saved = localStorage.getItem('save_chat_history');
    if (saved !== null) {
      setSaveChatHistory(saved === 'true');
    }
  }, []);

  // Fetch available models on component mount
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // Update max tokens when model changes
  useEffect(() => {
    const updateMaxTokens = async () => {
      if (selectedModel && selectedModel !== 'default') {
        try {
          // Try to get context window from tokenlens
          const contextWindow = await getContextWindow(selectedModel);
          if (contextWindow) {
            // Extract the total max tokens from the context window object
            const totalMax = contextWindow.totalMax ?? contextWindow.combinedMax ?? contextWindow.inputMax;
            if (totalMax !== undefined) {
              setMaxTokens(totalMax);
            }
          }
        } catch (error) {
          console.warn('Could not get context window from tokenlens, using default:', error);
          // Keep default value
        }
      }
    };
    updateMaxTokens();
  }, [selectedModel]);

  // Estimate tokens from text (rough estimate: ~4 characters per token)
  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    // Rough estimation: average of 4 characters per token
    return Math.ceil(text.length / 4);
  };

  // Update token usage when messages change
  useEffect(() => {
    let inputTokens = 0;
    let outputTokens = 0;

    // Count tokens for all messages
    messages.forEach((msg) => {
      const tokens = estimateTokens(msg.content);
      if (msg.role === 'user') {
        inputTokens += tokens;
      } else if (msg.role === 'assistant') {
        outputTokens += tokens;
      }
    });

    // Add system message tokens
    const systemMessage = "You are a helpful assistant. Format your responses using Markdown when appropriate. You can use features like **bold text**, *italics*, ### headings, `code blocks`, numbered and bulleted lists, and tables to make your answers more readable and structured.";
    inputTokens += estimateTokens(systemMessage);

    // Add streaming content if present
    if (streamingContent) {
      outputTokens += estimateTokens(streamingContent);
    }

    setTokenUsage({
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    });
  }, [messages, streamingContent]);

  // Fetch available models from the API
  const fetchAvailableModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch(API_URLS.models(), {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the API response format: {"object":"list","data":[...]}
      const modelsArray = data.data || data;
      
      if (Array.isArray(modelsArray)) {
        // Log all models for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('[Models Fetched]', modelsArray.map((m: ApiModelResponse) => m.id));
        }
        
        // Filter to only LLM models and format them
        const llmModels = modelsArray
          .filter((model: ApiModelResponse) => (model.modelType || model.ModelType) === 'LLM')
          .map((model: ApiModelResponse) => ({
            id: model.id,
            blockchainId: model.blockchainID || model.blockchainId,
            created: model.created,
            ModelType: 'LLM'
          }));
        
        const sortedModels = llmModels.sort((a: Model, b: Model) => a.id.localeCompare(b.id));
        setModels(sortedModels);
        setFilteredModels(sortedModels);
        
        // Set default model
        if (sortedModels.length > 0) {
          const defaultModelId = selectDefaultModel(sortedModels);
          if (defaultModelId) {
            setSelectedModel(defaultModelId);
          }
        }
      } else {
        const fallbackModels = [{ id: 'default', ModelType: 'LLM' }];
        setModels(fallbackModels);
        setFilteredModels(fallbackModels);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      const fallbackModels = [{ id: 'default', ModelType: 'LLM' }];
      setModels(fallbackModels);
      setFilteredModels(fallbackModels);
    } finally {
      setLoadingModels(false);
    }
  };

  // Filter models by type using environment configuration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _applyModelTypeFilter = (modelsToFilter: Model[], filterType: string) => {
    const filtered = filterModelsByType(modelsToFilter, filterType, allowedTypes);
    setFilteredModels(filtered);
    
    const options = getFilterOptions(modelsToFilter, allowedTypes);
    setFilterOptions(options);
    
    if (filtered.length > 0) {
      const defaultModelId = selectDefaultModel(filtered);
      if (defaultModelId) {
        setSelectedModel(defaultModelId);
      }
    }
  };

  // Handle model type filter change
  const handleModelTypeFilterChange = (filterType: string) => {
    setSelectedModelType(filterType);
    // For chat, we only show LLM models, so no filtering needed
  };

  // Handle conversation deletion
  const handleDeleteConversation = async () => {
    if (currentConversationId) {
      try {
        await deleteConversationById(currentConversationId);
        router.push('/chat');
        setShowDeleteDialog(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
        error(
          'Delete Failed',
          errorMessage,
          {
            duration: 8000
          }
        );
        console.error('Error deleting conversation:', err);
      }
    }
  };

  // Handle form submission with streaming via StreamManager
  const handleSubmit = useCallback(async (message: PromptInputMessage, _e: React.FormEvent) => {
    if (!message.text?.trim()) return;
    if (!fullApiKey) {
      warning('API Key Required', 'Please set up your API key first.', { duration: 5000 });
      return;
    }

    // Abort any existing stream
    if (currentStreamIdRef.current) {
      abortStreamForConversation(null);
    }

    setIsLoading(true);
    setAuthError(false);
    setStreamingStatus('submitted');
    setConnectionStatus('connecting');
    setRetryCount(0);

    const currentPrompt = message.text;
    const streamingMessageId = `assistant-${Date.now()}`;

    // Add user message to UI immediately
    const newUserMessage: Message = {
      role: 'user',
      content: currentPrompt,
    };

    // Add a temporary assistant message for streaming
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, newUserMessage, streamingMessage]);
    setStreamingContent('');

    // Build message history (excluding the current user message and streaming message)
    const messageHistory: ConversationMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      id: msg.id,
      sequence: msg.sequence,
    }));

    // Log model name for debugging
    logModelName('sendRequest', selectedModel);

    try {
      // Start stream via StreamManager - it handles persistence and background streaming
      const streamId = await startStream({
        conversationId: null, // New conversation
        userMessageContent: currentPrompt,
        messageHistory,
        model: selectedModel,
        apiKey: fullApiKey,
      });

      currentStreamIdRef.current = streamId;
      setStreamingStatus('streaming');
      setConnectionStatus('streaming');

      // Subscribe to stream updates
      const unsubscribe = subscribeToStream(streamId, {
        onProgress: (content) => {
          setStreamingContent(content);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, content }
                : msg
            )
          );
        },
        onComplete: (content) => {
          setStreamingContent('');
          setStreamingStatus('ready');
          setConnectionStatus('idle');
          setIsLoading(false);
          currentStreamIdRef.current = null;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, content }
                : msg
            )
          );
          // Cleanup subscription on complete
          unsubscribe();
        },
        onError: (err) => {
          console.error('[ChatPage] Stream error:', err);
          setStreamingContent('');
          setStreamingStatus('error');
          setConnectionStatus('error');
          setIsLoading(false);
          currentStreamIdRef.current = null;

          // Remove the empty assistant message and show error
          setMessages(prev => {
            const filtered = prev.filter(msg => msg.id !== streamingMessageId);
            return [...filtered, {
              role: 'assistant',
              content: `An error occurred: ${err.message}`,
            }];
          });

          error(
            'Message Failed',
            'Failed to send your message. Please check your connection and try again.',
            { duration: 8000 }
          );

          // Cleanup subscription on error
          unsubscribe();
        },
      });
    } catch (err) {
      console.error('[ChatPage] Error starting stream:', err);
      setStreamingStatus('error');
      setConnectionStatus('error');
      setIsLoading(false);

      // Remove the streaming message
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));

      error(
        'Message Failed',
        'Failed to start the message. Please try again.',
        { duration: 8000 }
      );
    }
  }, [fullApiKey, messages, selectedModel, startStream, subscribeToStream, abortStreamForConversation, error, warning]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _truncateKey = (key: string) => {
    return `${key.substring(0, 15)}...`;
  };

  if (!fullApiKey) {
    return null;
  }

  // Show message if no API key
  if (!fullApiKey || !apiKeyPrefix) {
    return (
      <AuthenticatedLayout>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key Required
              </CardTitle>
              <CardDescription>
                You need to create and verify an API key before you can use Chat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/api-keys')}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
              >
                Go to API Keys
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Copy message content to clipboard
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      success('Copied!', 'Message copied to clipboard', { duration: 2000 });
    } catch {
      // Fallback for browsers that don't support clipboard API
      error('Copy failed', 'Unable to copy to clipboard');
    }
  };

  // Helper to get connection status message
  const getConnectionStatusMessage = (): string | null => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting to AI provider...';
      case 'retrying':
        return `Retrying connection (attempt ${retryCount + 1}/${RESILIENCE_CONFIG.MAX_RETRIES + 1})...`;
      default:
        return null;
    }
  };

  const connectionMessage = getConnectionStatusMessage();

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col h-full bg-background text-foreground">
        {/* Chat Header */}
        <header className="p-4 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">
              {conversationTitle}
            </h2>
            <p className="text-sm text-muted-foreground">API Key: {apiKeyPrefix}...</p>
          </div>
          {currentConversationId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="text-gray-400 hover:text-red-400 hover:bg-gray-800"
              title="Delete conversation"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </header>

        {/* Connection Status Banner - Shows during connecting/retrying */}
        {connectionMessage && (
          <div className="bg-orange-500/90 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium animate-pulse">
            <Wifi className="h-4 w-4" />
            <span>{connectionMessage}</span>
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {/* Messages */}
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const isAssistantMessage = message.role === 'assistant';
                const hasNoContent = !message.content && !streamingContent;
                const isProcessing = streamingStatus === 'submitted' || streamingStatus === 'streaming';
                const isWaitingForStream = isLastMessage && isAssistantMessage && hasNoContent && isProcessing;
                
                return (
                  <Message key={message.id || index} from={message.role}>
                    <MessageContent className="relative">
                      {isAssistantMessage ? (
                        <>
                          {isWaitingForStream && (
                            <div className="absolute top-1/2 left-3 -translate-y-1/2 z-20">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                          )}
                          {message.content || streamingContent ? (
                            <MessageResponse>
                              {message.content || streamingContent}
                            </MessageResponse>
                          ) : (
                            isWaitingForStream && <div className="min-h-[20px] w-full" />
                          )}
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </MessageContent>
                    {isAssistantMessage && (message.content || (isLastMessage && streamingContent)) && (
                      <MessageActions>
                        <MessageAction
                          label="Copy"
                          onClick={() => handleCopy(message.content || streamingContent || "")}
                          tooltip="Copy to clipboard"
                        >
                          <CopyIcon className="size-4" />
                        </MessageAction>
                      </MessageActions>
                    )}
                  </Message>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <PromptInput onSubmit={handleSubmit} status={streamingStatus}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask me anything..." />
              <Context
                maxTokens={maxTokens}
                modelId={selectedModel}
                usage={tokenUsage}
                usedTokens={tokenUsage.totalTokens ?? 0}
              >
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </ContextContentBody>
                </ContextContent>
              </Context>
              <PromptInputSubmit 
                status={streamingStatus}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                disabled={isLoading}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton onClick={() => setShowSettingsDialog(true)}>
                  <Settings className="h-4 w-4" />
                </PromptInputButton>
                <ModelSelector open={showModelSelector} onOpenChange={setShowModelSelector}>
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      <span className="text-sm">{selectedModel}</span>
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList className="max-h-[500px]">
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {(() => {
                        // Deduplicate models by id
                        const uniqueModelsMap = new Map<string, Model>();
                        filteredModels.forEach((model) => {
                          if (!uniqueModelsMap.has(model.id)) {
                            uniqueModelsMap.set(model.id, model);
                          }
                        });
                        
                        // Convert to array and sort alphabetically by id
                        const uniqueModels = Array.from(uniqueModelsMap.values())
                          .sort((a, b) => a.id.localeCompare(b.id));

                        // Render models directly (no grouping needed)
                        return uniqueModels.map((model) => (
                          <ModelSelectorItem
                            key={model.id}
                            onSelect={() => {
                              setSelectedModel(model.id);
                              setShowModelSelector(false);
                            }}
                            value={model.id}
                          >
                            <ModelSelectorName>{model.id}</ModelSelectorName>
                            {selectedModel === model.id ? (
                              <CheckIcon className="ml-auto size-4" />
                            ) : (
                              <div className="ml-auto size-4" />
                            )}
                          </ModelSelectorItem>
                        ));
                      })()}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/* Chat Settings Dialog */}
        <ChatSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          models={filteredModels}
          modelTypes={[{ value: 'LLM', label: 'LLM' }]}
          selectedModelType="LLM"
          onModelTypeChange={handleModelTypeFilterChange}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this conversation? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConversation}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </AuthenticatedLayout>
  );
}
