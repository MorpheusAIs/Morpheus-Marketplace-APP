'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useNotification } from '@/lib/NotificationContext';
import { useConversation } from '@/lib/ConversationContext';
import { useStreamManager } from '@/lib/StreamManagerContext';
import { STREAM_EVENTS } from '@/lib/stream-manager';
import type { ConversationMessage } from '@/lib/conversation-history';
import { API_URLS } from '@/lib/api/config';
import { getAllowedModelTypes, filterModelsByType, getFilterOptions, selectDefaultModel } from '@/lib/model-filter-utils';
import { logModelName } from '@/lib/model-name-utils';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { Button } from '@/components/ui/button';
import { CheckIcon, Settings, Key } from 'lucide-react';
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
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { ChatSettingsDialog } from '@/components/chat-settings-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Type definitions
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
  const { warning } = useNotification();
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentConversationId,
  } = useConversation();
  const {
    startStream,
  } = useStreamManager();

  // API Key state (retrieved from sessionStorage)
  const [fullApiKey, setFullApiKey] = useState<string>('');
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string>('');

  // Chat state
  const [isLoading, setIsLoading] = useState(false);
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

  // Chat settings modal state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Refs for tracking current stream
  const currentConversationIdRef = useRef<string | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);

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

  // Listen for new conversation creation from StreamManager and navigate
  useEffect(() => {
    const handleNewConversationCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { conversationId } = customEvent.detail || {};

      // Only navigate if this is the page that started the stream (has the stream ID)
      if (conversationId && currentStreamIdRef.current) {
        console.log(`[ChatPage] New conversation created: ${conversationId}, navigating...`);
        // Navigate to the new conversation so subsequent messages go to the same conversation
        router.push(`/chat/${conversationId}`);
      }
    };

    window.addEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversationCreated);
    return () => {
      window.removeEventListener(STREAM_EVENTS.NEW_CONVERSATION, handleNewConversationCreated);
    };
  }, [router]);

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
    };

    window.addEventListener('load-conversation', handleLoadConversation);
    window.addEventListener('new-conversation-started', handleNewConversation);

    return () => {
      window.removeEventListener('load-conversation', handleLoadConversation);
      window.removeEventListener('new-conversation-started', handleNewConversation);
    };
  }, [router, pathname]);

  // Fetch available models on component mount
  useEffect(() => {
    fetchAvailableModels();
  }, []);

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

  // Handle form submission - starts stream and lets the event listener handle redirect
  const handleSubmit = useCallback(async (message: PromptInputMessage, _e: React.FormEvent) => {
    if (!message.text?.trim()) return;
    if (!fullApiKey) {
      warning('API Key Required', 'Please set up your API key first.', { duration: 5000 });
      return;
    }

    setIsLoading(true);
    setStreamingStatus('submitted');

    const currentPrompt = message.text;

    // Build empty message history for new conversation
    const messageHistory: ConversationMessage[] = [];

    // Log model name for debugging
    logModelName('sendRequest', selectedModel);

    try {
      // Start stream via StreamManager - it handles persistence and background streaming
      // The NEW_CONVERSATION event listener will handle navigation to the chat page
      const streamId = await startStream({
        conversationId: null, // New conversation
        userMessageContent: currentPrompt,
        messageHistory,
        model: selectedModel,
        apiKey: fullApiKey,
      });

      currentStreamIdRef.current = streamId;
      setStreamingStatus('streaming');
    } catch (err) {
      console.error('[ChatPage] Error starting stream:', err);
      setStreamingStatus('error');
      setIsLoading(false);
      currentStreamIdRef.current = null;
    }
  }, [fullApiKey, selectedModel, startStream, warning]);

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
      <div className="flex flex-col h-full items-center justify-center bg-background text-foreground">
        {/* Centered content container */}
        <div className="w-full max-w-2xl px-4 space-y-8">
          {/* Morpheus Logo */}
          <div className="flex justify-center">
            <Image
              src="/images/logo-green.svg"
              alt="Morpheus"
              width={200}
              height={90}
              priority
            />
          </div>

          {/* Input */}
          <PromptInput onSubmit={handleSubmit} status={streamingStatus}>
            <PromptInputBody className="items-center">
              <PromptInputTextarea placeholder="What do you want to know?" />
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
              <PromptInputSubmit
                status={streamingStatus}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                disabled={isLoading}
              />
            </PromptInputBody>
          </PromptInput>
        </div>
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
    </AuthenticatedLayout>
  );
}
