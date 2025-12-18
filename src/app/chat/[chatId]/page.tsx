'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { useConversation } from '@/lib/ConversationContext';
import { useConversationHistory } from '@/lib/hooks/use-conversation-history';
import { updateConversation } from '@/lib/conversation-history';
import type { ConversationMessage } from '@/lib/conversation-history';
import { API_URLS } from '@/lib/api/config';
import { getAllowedModelTypes, filterModelsByType, getFilterOptions, selectDefaultModel } from '@/lib/model-filter-utils';
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
import { MessageSquare, CheckIcon, Settings, Trash2, Key, Loader2, CopyIcon } from 'lucide-react';
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
import '../markdown.css';
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

export default function ChatPage() {
  // Cognito authentication
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading: _authLoading } = useCognitoAuth();
  const { error, warning, success } = useNotification();
  const router = useRouter();
  const params = useParams();
  const chatId = params?.chatId as string | undefined;
  
  const { getConversationById } = useConversationHistory();
  const { 
    currentConversationId, 
    saveCurrentConversation, 
    deleteConversationById,
    loadConversation
  } = useConversation();
  
  // API Key state (retrieved from sessionStorage)
  const [fullApiKey, setFullApiKey] = useState<string>('');
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string>('');
  
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Chat state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
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
  
  // Chat history state
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  
  // Chat settings modal state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Streaming state
  const [streamingContent, setStreamingContent] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const isLoadingConversationRef = useRef<boolean>(false);
  
  // Token usage state
  const [tokenUsage, setTokenUsage] = useState<LanguageModelUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
  const [maxTokens, setMaxTokens] = useState<number>(128_000); // Default fallback

  // Sync ref with context value
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
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

  // Load conversation from URL on mount or when chatId changes
  useEffect(() => {
    const loadConversationFromUrl = async () => {
      if (!chatId || !fullApiKey) {
        setIsLoadingConversation(false);
        isLoadingConversationRef.current = false;
        return;
      }

      // Prevent multiple simultaneous loads
      if (isLoadingConversationRef.current) {
        console.log('Conversation load already in progress, skipping...');
        return;
      }

      setIsLoadingConversation(true);
      isLoadingConversationRef.current = true;
      try {
        // First check if conversation is already preloaded
        const preloadedConversation = getConversationById(chatId);
        
        let conversation;
        if (preloadedConversation && preloadedConversation.messages && preloadedConversation.messages.length > 0) {
          // Use preloaded conversation
          console.log(`Using preloaded conversation ${chatId} with ${preloadedConversation.messages.length} messages`);
          conversation = preloadedConversation;
        } else {
          // Not preloaded, fetch it
          console.log(`Conversation ${chatId} not preloaded, fetching...`);
          conversation = await loadConversation(chatId, fullApiKey);
        }

        if (conversation) {
          // Deduplicate messages when loading
          const seenMessages = new Set<string>();
          const deduplicatedMessages: Message[] = [];
          
          (conversation.messages || []).forEach((msg: ConversationMessage) => {
            const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
            if (!seenMessages.has(messageKey)) {
              seenMessages.add(messageKey);
              deduplicatedMessages.push({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                sequence: msg.sequence,
              });
            }
          });

          setMessages(deduplicatedMessages);
          setConversationTitle(conversation.title);
          setStreamingContent('');
          console.log(`Loaded conversation ${chatId} with ${deduplicatedMessages.length} deduplicated messages`);
        } else {
          // Conversation not found, redirect to /chat
          router.push('/chat');
        }
      } catch (err) {
        console.error('Error loading conversation from URL:', err);
        // On error, redirect to /chat
        router.push('/chat');
      } finally {
        setIsLoadingConversation(false);
        isLoadingConversationRef.current = false;
      }
    };

    loadConversationFromUrl();
  }, [chatId, fullApiKey, loadConversation, router, getConversationById]);

  // Listen for conversation history updates to refresh title only if it matches current chatId
  useEffect(() => {
    const handleHistoryUpdate = async (e: Event) => {
      // Only update title if the updated conversation matches the current chatId from URL
      if (!chatId) return;
      
      const customEvent = e as CustomEvent;
      const updatedConversation = customEvent.detail?.conversation;
      
      // If the event includes conversation details and it matches current chatId, update title
      if (updatedConversation && updatedConversation.id === chatId) {
        setConversationTitle(updatedConversation.title);
      } else if (customEvent.detail?.type === 'updated' && customEvent.detail?.id === chatId) {
        // If it's an update event for current chatId, reload to get latest title
        try {
          const conversation = await loadConversation(chatId, fullApiKey);
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
  }, [chatId, fullApiKey, loadConversation]);

  // Listen for conversation load events from sidebar
  useEffect(() => {
    const handleLoadConversation = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const conversation = customEvent.detail;
      if (conversation && conversation.id) {
        // Navigate to the conversation route
        router.push(`/chat/${conversation.id}`);
      }
    };

    const handleNewConversation = () => {
      router.push('/chat');
    };

    window.addEventListener('load-conversation', handleLoadConversation);
    window.addEventListener('new-conversation-started', handleNewConversation);

    return () => {
      window.removeEventListener('load-conversation', handleLoadConversation);
      window.removeEventListener('new-conversation-started', handleNewConversation);
    };
  }, [router]);

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
          const contextWindow = await getContextWindow(selectedModel);
          if (contextWindow) {
            const totalMax = contextWindow.totalMax ?? contextWindow.combinedMax ?? contextWindow.inputMax;
            if (totalMax !== undefined) {
              setMaxTokens(totalMax);
            }
          }
        } catch (error) {
          console.warn('Could not get context window from tokenlens, using default:', error);
        }
      }
    };
    updateMaxTokens();
  }, [selectedModel]);

  // Estimate tokens from text (rough estimate: ~4 characters per token)
  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  };

  // Update token usage when messages change
  useEffect(() => {
    let inputTokens = 0;
    let outputTokens = 0;

    // Deduplicate messages before calculating tokens to avoid double counting
    const seenMessages = new Set<string>();
    const deduplicatedMessages: Message[] = [];
    
    for (const msg of messages) {
      const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
      if (!seenMessages.has(messageKey)) {
        seenMessages.add(messageKey);
        deduplicatedMessages.push(msg);
      }
    }

    deduplicatedMessages.forEach((msg) => {
      const tokens = estimateTokens(msg.content);
      if (msg.role === 'user') {
        inputTokens += tokens;
      } else if (msg.role === 'assistant') {
        outputTokens += tokens;
      }
    });

    const systemMessage = "You are a helpful assistant. Format your responses using Markdown when appropriate. You can use features like **bold text**, *italics*, ### headings, `code blocks`, numbered and bulleted lists, and tables to make your answers more readable and structured.";
    inputTokens += estimateTokens(systemMessage);

    // Only add streaming content if it's not already in messages (to avoid double counting)
    const lastMessage = deduplicatedMessages[deduplicatedMessages.length - 1];
    const isStreamingInMessages = lastMessage && lastMessage.role === 'assistant' && lastMessage.content === streamingContent;
    
    if (streamingContent && !isStreamingInMessages) {
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
      const modelsArray = data.data || data;
      
      if (Array.isArray(modelsArray)) {
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
  };

  // Handle conversation deletion
  const handleDeleteConversation = async () => {
    if (chatId) {
      try {
        await deleteConversationById(chatId);
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

  // Handle form submission with streaming
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSubmit = async (message: PromptInputMessage, _e: React.FormEvent) => {
    if (!message.text?.trim()) return;
    
    setIsLoading(true);
    setAuthError(false);
    setStreamingStatus('submitted');
    
    const currentPrompt = message.text;
    
    // Add user message to UI immediately
    const newUserMessage: Message = {
      role: 'user',
      content: currentPrompt,
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    // Add a temporary assistant message for streaming
    const streamingMessageId = Date.now().toString();
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
    };
    
    setMessages(prev => [...prev, streamingMessage]);
    setStreamingContent('');
    setStreamingStatus('streaming');
    
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this stream
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      // Deduplicate messages before sending to API to prevent duplicate messages in request
      const seenMessages = new Set<string>();
      const deduplicatedMessages = messages
        .filter(msg => msg.id !== streamingMessageId) // Remove streaming message
        .filter(msg => {
          // Create a unique key for deduplication
          const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 100)}`;
          if (seenMessages.has(messageKey)) {
            return false; // Skip duplicate
          }
          seenMessages.add(messageKey);
          return true;
        });

      const requestBody = {
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Format your responses using Markdown when appropriate. You can use features like **bold text**, *italics*, ### headings, `code blocks`, numbered and bulleted lists, and tables to make your answers more readable and structured."
          },
          ...deduplicatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: "user",
            content: currentPrompt
          }
        ],
        stream: true
      };

      const res = await fetch(API_URLS.chatCompletions(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'text/event-stream',
          'Authorization': `Bearer ${fullApiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });

      if (!res.ok) {
        // Try to parse error response for specific error messages
        let errorDetail = '';
        try {
          const errorBody = await res.json();
          errorDetail = errorBody?.detail || '';
        } catch {
          // Ignore parse errors
        }

        // Check for automation disabled error (403 with specific message)
        if (res.status === 403 && errorDetail.toLowerCase().includes('automation')) {
          setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '⚠️ Session automation is disabled. Please enable it in your Account settings to use Chat.'
          }]);
          warning(
            'Automation Disabled',
            'Session automation is disabled. Enable it in Account settings to chat.',
            {
              actionLabel: 'Go to Account',
              actionUrl: '/account',
              duration: 15000
            }
          );
          setStreamingStatus('error');
          return;
        }

        // Handle other auth errors (401 or 403 without automation message)
        if (res.status === 401 || res.status === 403) {
          setAuthError(true);
          setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Authentication error: Please provide a valid API key or log in to get one.'
          }]);
          warning(
            'Authentication Required',
            'Please verify your API key to continue chatting.',
            {
              actionLabel: 'Go to Api Keys',
              actionUrl: '/api-keys',
              duration: 10000
            }
          );
          setStreamingStatus('error');
          return;
        }
        throw new Error(`API returned status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (!reader) {
        throw new Error('No reader available');
      }

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
                accumulatedContent += delta;
                setStreamingContent(accumulatedContent);
                
                setMessages(prev => prev.map(msg => 
                  msg.id === streamingMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }

      const finalMessage: Message = {
        id: streamingMessageId,
        role: 'assistant',
        content: accumulatedContent,
      };
      
      let updatedMessages: Message[] = [];
      setMessages(prev => {
        // Update the streaming message and deduplicate to prevent duplicates in state
        const seenMessages = new Set<string>();
        updatedMessages = prev
          .map(msg => msg.id === streamingMessageId ? finalMessage : msg)
          .filter(msg => {
            const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 100)}`;
            if (seenMessages.has(messageKey)) {
              return false; // Skip duplicate
            }
            seenMessages.add(messageKey);
            return true;
          });
        return updatedMessages;
      });
      
      setStreamingStatus('ready');
      setStreamingContent('');

      // Save to API if saveChatHistory is enabled
      if (saveChatHistory && accumulatedContent) {
        // Prevent multiple simultaneous saves
        if (isSavingRef.current) {
          console.log('Save already in progress, skipping...');
          return;
        }

        try {
          isSavingRef.current = true;
          
          // Use chatId from URL params instead of currentConversationId from context
          // This ensures we use the correct ID even if context is stale
          if (!chatId) {
            // No chatId in URL means this is a new conversation - save all messages
            // Deduplicate messages by ID or content+role combination
            const seenMessages = new Set<string>();
            const deduplicatedMessages: Message[] = [];
            
            for (const msg of updatedMessages) {
              // Create a unique key for deduplication
              const messageKey = msg.id || `${msg.role}-${msg.content.substring(0, 50)}`;
              if (!seenMessages.has(messageKey)) {
                seenMessages.add(messageKey);
                deduplicatedMessages.push(msg);
              }
            }

            const conversationMessages: ConversationMessage[] = deduplicatedMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              id: msg.id,
              sequence: msg.sequence,
            }));

            const newId = await saveCurrentConversation(conversationMessages, fullApiKey);
            console.log('Saved new conversation:', newId);
            currentConversationIdRef.current = newId;
            // Navigate to the new conversation route
            router.push(`/chat/${newId}`);
          } else {
            // chatId exists - only send the NEW messages (last user + assistant pair)
            // This prevents duplicating existing messages that are already in the API
            // The new messages are the last 2 messages in updatedMessages
            const newMessages = updatedMessages.slice(-2); // Get last 2 messages (user + assistant)
            
            const conversationMessages: ConversationMessage[] = newMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              id: msg.id,
              sequence: msg.sequence,
            }));

            console.log(`Updating conversation ${chatId} with ${conversationMessages.length} new messages`);
            await updateConversation(chatId, conversationMessages, fullApiKey);
            console.log('Updated conversation:', chatId);
            
            // Dispatch event to update conversation history
            try {
              const updatedConversation = await loadConversation(chatId, fullApiKey);
              if (updatedConversation) {
                window.dispatchEvent(new CustomEvent('conversation-history-updated', {
                  detail: { type: 'updated', conversation: updatedConversation }
                }));
              }
            } catch (err) {
              console.warn('Could not fetch updated conversation for event dispatch:', err);
              // Still dispatch a generic update event
              window.dispatchEvent(new CustomEvent('conversation-history-updated', {
                detail: { type: 'updated', id: chatId }
              }));
            }
          }
        } catch (saveError) {
          console.error('Error saving chat to API:', saveError);
          const errorMessage = saveError instanceof Error ? saveError.message : 'Failed to save conversation';
          warning(
            'Save Failed',
            `Could not save conversation: ${errorMessage}`,
            {
              duration: 5000
            }
          );
        } finally {
          isSavingRef.current = false;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      
      console.error('Error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred while processing your request.'
      }]);
      
      error(
        'Message Failed',
        'Failed to send your message. Please check your connection and try again.',
        {
          duration: 8000
        }
      );
      
      setStreamingStatus('error');
    } finally {
      setIsLoading(false);
      if (streamingStatus !== 'streaming') {
        setStreamingStatus('ready');
      }
    }
  };

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

  if (isLoadingConversation) {
    return (
      <AuthenticatedLayout>
        <div className="flex flex-col h-full bg-background text-foreground items-center justify-center">
          <div className="text-muted-foreground">Loading conversation...</div>
        </div>
      </AuthenticatedLayout>
    );
  }

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
          {chatId && (
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
                        const uniqueModelsMap = new Map<string, Model>();
                        filteredModels.forEach((model) => {
                          if (!uniqueModelsMap.has(model.id)) {
                            uniqueModelsMap.set(model.id, model);
                          }
                        });
                        
                        const uniqueModels = Array.from(uniqueModelsMap.values())
                          .sort((a, b) => a.id.localeCompare(b.id));

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

