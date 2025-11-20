'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { useConversation } from '@/lib/ConversationContext';
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
import { MessageSquare, CheckIcon, Settings, Trash2, Key } from 'lucide-react';
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
  const { error, warning } = useNotification();
  const router = useRouter();
  const pathname = usePathname();
  const { 
    currentConversationId, 
    saveCurrentConversation, 
    updateCurrentConversation,
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
  
  // Chat history state - using localStorage now
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  
  // Chat settings modal state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Streaming state
  const [streamingContent, setStreamingContent] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  
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
      // Create the request body for the API with streaming enabled
      const requestBody = {
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Format your responses using Markdown when appropriate. You can use features like **bold text**, *italics*, ### headings, `code blocks`, numbered and bulleted lists, and tables to make your answers more readable and structured."
          },
          ...messages.filter(msg => msg.id !== streamingMessageId).map(msg => ({
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

      // Make the streaming API call
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
              actionLabel: 'Go to Admin',
              actionUrl: '/api-keys',
              duration: 10000
            }
          );
          setStreamingStatus('error');
          return;
        }
        throw new Error(`API returned status ${res.status}`);
      }

      // Read the stream
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
                
                // Update the message in real-time
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

      // Finalize the message
      const finalMessage: Message = {
        id: streamingMessageId,
        role: 'assistant',
        content: accumulatedContent,
      };
      
      // Update messages state
      let updatedMessages: Message[] = [];
      setMessages(prev => {
        updatedMessages = prev.map(msg => 
          msg.id === streamingMessageId ? finalMessage : msg
        );
        return updatedMessages;
      });
      
      setStreamingStatus('ready');
      setStreamingContent('');

      // Save to API if saveChatHistory is enabled
      if (saveChatHistory && accumulatedContent) {
        try {
          // Convert all messages (including the new ones) to ConversationMessage format
          const conversationMessages: ConversationMessage[] = updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            id: msg.id,
            sequence: msg.sequence,
          }));

          // Check current conversation ID from state (not ref) to ensure we have the latest value
          // If no current conversation ID, create a new one; otherwise update existing
          if (!currentConversationId) {
            // Create new conversation
            const newId = await saveCurrentConversation(conversationMessages, fullApiKey);
            console.log('Saved new conversation:', newId);
            // Update ref immediately after saving
            currentConversationIdRef.current = newId;
            // Navigate to the new conversation route
            router.push(`/chat/${newId}`);
          } else {
            // Update existing conversation
            await updateCurrentConversation(conversationMessages, fullApiKey);
            console.log('Updated conversation:', currentConversationId);
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
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream was cancelled, don't show error
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
              messages.map((message, index) => (
                <Message key={message.id || index} from={message.role}>
                  <MessageContent>
                    {message.role === 'assistant' ? (
                      <MessageResponse>
                        {message.content || streamingContent}
                      </MessageResponse>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </MessageContent>
                </Message>
              ))
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
