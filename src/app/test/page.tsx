"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, RefreshCw, Send, Copy, Key } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { API_URLS } from "@/lib/api/config";
import { getAllowedModelTypes, filterModelsByType, selectDefaultModel } from "@/lib/model-filter-utils";
import { logModelName } from "@/lib/model-name-utils";
import { useNotification } from "@/lib/NotificationContext";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { apiGet } from "@/lib/api/apiService";

interface Model {
  id: string;
  blockchainId?: string;
  ModelType?: string;
}

interface ApiModelResponse {
  id: string;
  blockchainID?: string;
  blockchainId?: string;
  created?: number;
  modelType?: string;
  ModelType?: string;
}

interface AutomationSettings {
  is_enabled: boolean;
  session_duration: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

interface SessionPingResponse {
  status: 'alive' | 'dead' | 'no_session';
  session_id?: string;
  response_time_ms?: number;
  message?: string;
}

interface SessionCreateResponse {
  session_id: string;
  provider: string;
  model_id: string;
  bid_id?: string;
  duration: number;
  cost: number;
}

export default function TestPage() {
  const router = useRouter();
  const { error: showError } = useNotification();
  const { apiKeys, accessToken } = useCognitoAuth();
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [selectedModel, setSelectedModel] = useState("default");
  const [prompt, setPrompt] = useState("What is the capital of New Hampshire?");
  const [curlRequest, setCurlRequest] = useState("");
  const [responseContent, setResponseContent] = useState("");
  const [serverResponse, setServerResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [allowedTypes] = useState<string[]>(getAllowedModelTypes());
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Load API key from sessionStorage
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem('verified_api_key');
    const storedPrefix = sessionStorage.getItem('verified_api_key_prefix');
    const storedName = sessionStorage.getItem('verified_api_key_name');
    
    if (storedApiKey && storedPrefix) {
      setSelectedApiKey(storedApiKey);
      setApiKeyPrefix(storedPrefix);
      
      // Get API key name from sessionStorage or find it from apiKeys context
      if (storedName) {
        setApiKeyName(storedName);
      } else if (apiKeys.length > 0) {
        // Try to find the API key name by matching the prefix
        const matchingKey = apiKeys.find(key => key.key_prefix === storedPrefix);
        if (matchingKey) {
          setApiKeyName(matchingKey.name);
          sessionStorage.setItem('verified_api_key_name', matchingKey.name);
        } else {
          // If still not found, try to get it from the API keys list
          // This handles the case where the prefix might not match exactly
          const foundKey = apiKeys.find(key => 
            storedPrefix.toLowerCase().startsWith(key.key_prefix.toLowerCase()) ||
            key.key_prefix.toLowerCase().startsWith(storedPrefix.toLowerCase())
          );
          if (foundKey) {
            setApiKeyName(foundKey.name);
            sessionStorage.setItem('verified_api_key_name', foundKey.name);
          }
        }
      }
    }
  }, [apiKeys]);

  // Fetch available models
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // Filter models to LLM only when models change
  useEffect(() => {
    if (models.length > 0) {
      applyModelTypeFilter(models, 'LLM');
    }
  }, [models]);

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
        // Format models from API response
        const formattedModels = modelsArray.map((model: ApiModelResponse) => ({
          id: model.id,
          blockchainId: model.blockchainID || model.blockchainId,
          created: model.created,
          ModelType: model.modelType || model.ModelType || 'UNKNOWN'
        })) as Model[];
        
        // Filter to only LLM models
        const llmModels = formattedModels.filter((model: Model) => 
          (model.ModelType?.toUpperCase() || 'UNKNOWN') === 'LLM'
        );
        const sortedModels = llmModels.sort((a: Model, b: Model) => a.id.localeCompare(b.id));
        setModels(sortedModels);
        applyModelTypeFilter(sortedModels, 'LLM');
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

  const applyModelTypeFilter = (modelsToFilter: Model[], filterType: string) => {
    const filtered = filterModelsByType(modelsToFilter, filterType, allowedTypes);
    setFilteredModels(filtered);
    
    if (filtered.length > 0) {
      const defaultModelId = selectDefaultModel(filtered);
      if (defaultModelId) {
        setSelectedModel(defaultModelId);
      }
    }
  };

  const handleCopyCurl = async () => {
    if (!curlRequest) return;
    try {
      await navigator.clipboard.writeText(curlRequest);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyResponse = async () => {
    if (!serverResponse) return;
    try {
      await navigator.clipboard.writeText(serverResponse);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const generateCurlRequest = () => {
    const curl = `curl -X 'POST' \\
'${API_URLS.chatCompletions()}' \\
-H 'accept: application/json' \\
-H 'Authorization: Bearer ${selectedApiKey}' \\
-H 'Content-Type: application/json' \\
-d '{
    "model": "${selectedModel}",
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "${prompt.replace(/'/g, "\\'")}"
        }
    ],
    "stream": false
}'`;
    setCurlRequest(curl);
  };

  // Check if automation is enabled
  const checkAutomationSettings = async (): Promise<AutomationSettings | null> => {
    if (!accessToken) {
      // If no access token, assume automation is enabled (default behavior)
      return null;
    }

    try {
      const response = await apiGet<AutomationSettings>(
        API_URLS.automationSettings(),
        accessToken
      );

      if (response.error || !response.data) {
        console.warn('Could not fetch automation settings, assuming enabled:', response.error);
        return null;
      }

      return response.data;
    } catch (err) {
      console.error('Error checking automation settings:', err);
      // Default to enabled if we can't check
      return null;
    }
  };

  // Check if there's an active session
  const checkActiveSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(API_URLS.sessionPing(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'Authorization': `Bearer ${selectedApiKey}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data: SessionPingResponse = await response.json();
      return data.status === 'alive';
    } catch (err) {
      console.error('Error checking active session:', err);
      return false;
    }
  };

  // Create a session for the selected model
  const createSession = async (modelId: string, duration?: number): Promise<boolean> => {
    // Find the model to get its blockchain ID
    const model = models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Use blockchain ID if available, otherwise fall back to model ID
    const modelIdentifier = model.blockchainId || modelId;

    // Build URL with query parameter for model_id
    const url = new URL(API_URLS.sessionCreateModel());
    url.searchParams.set('model_id', modelIdentifier);

    // Request body according to SessionDataRequest schema from OpenAPI spec
    // Required fields: sessionDuration, directPayment, failover
    const requestBody = {
      sessionDuration: duration || 3600,
      directPayment: false,
      failover: false
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'Authorization': `Bearer ${selectedApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      const errorDetail = errorData.detail || `HTTP ${response.status}`;
      throw new Error(errorDetail);
    }

    const data: SessionCreateResponse = await response.json();
    console.log('Session created successfully:', data.session_id);
    return true;
  };

  // Ensure session exists before making request (when automation is disabled)
  const ensureSessionExists = async (): Promise<void> => {
    const automationSettings = await checkAutomationSettings();
    
    // If automation is enabled, no need to check/create session
    if (automationSettings === null || automationSettings.is_enabled) {
      return;
    }

    // Automation is disabled, check if session exists
    const hasActiveSession = await checkActiveSession();
    
    if (!hasActiveSession) {
      // Try to create a session, but handle 404 gracefully
      // The endpoint may not exist in dev environment
      try {
        const sessionDuration = automationSettings.session_duration || 3600;
        await createSession(selectedModel, sessionDuration);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        
        // If endpoint doesn't exist (404), provide helpful guidance
        if (errorMessage.includes("404") || errorMessage.includes("Not Found") || 
            errorMessage.includes("not available")) {
          throw new Error(
            "Cannot create session automatically. " +
            "The session creation endpoint is not available in this environment. " +
            "Please enable automation in your account settings (Account → Automation Settings) " +
            "to automatically create sessions, or create a session manually through the API."
          );
        }
        // Re-throw other errors
        throw err;
      }
    }
  };

  const handleSendRequest = async () => {
    if (!prompt.trim() || !selectedApiKey) {
      showError("Validation Error", "Please provide a prompt and ensure API key is set");
      return;
    }

    setIsLoading(true);
    setResponseContent("");
    setServerResponse("");
    generateCurlRequest();

    try {
      // Ensure session exists if automation is disabled
      await ensureSessionExists();

      // Log model name for debugging
      logModelName('sendRequest', selectedModel);

      // Use model name exactly as returned from /v1/models endpoint
      const requestBody = {
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false
      };

      const response = await fetch(API_URLS.chatCompletions(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'Authorization': `Bearer ${selectedApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      setServerResponse(JSON.stringify(data, null, 2));

      if (!response.ok) {
        // Handle error response
        const errorMessage = data.detail || data.error?.message || `HTTP ${response.status}`;
        setResponseContent(`Error: ${errorMessage}`);
        
        // Handle model name errors (400 Bad Request)
        if (response.status === 400) {
          const isModelError = errorMessage.toLowerCase().includes('invalid model') || 
                              errorMessage.toLowerCase().includes('model name') ||
                              errorMessage.toLowerCase().includes('model=');
          
          if (isModelError) {
            // Extract the model name the backend tried to use (if mentioned in error)
            const backendModelMatch = errorMessage.match(/model=([^\s,}]+)/i);
            const backendModelName = backendModelMatch ? backendModelMatch[1] : null;
            
            console.error('[Model Error] Backend inconsistency detected:', {
              requestedModel: selectedModel,
              backendAttemptedModel: backendModelName,
              errorMessage: errorMessage,
              fullError: data,
              note: 'This model was returned from /v1/models but rejected by /v1/chat/completions'
            });
            
            const errorMsg = backendModelName && backendModelName !== selectedModel
              ? `The backend returned "${selectedModel}" in the models list but tried to use "${backendModelName}" when making the request. This is a backend configuration issue.`
              : `The model "${selectedModel}" was returned from the models list but is not accepted by the chat endpoint. This is a backend configuration issue.`;
            
            showError(
              "Model Configuration Error",
              errorMsg,
              { duration: 15000 }
            );
          }
        }
        
        // Check for automation disabled error and show helpful message
        if (response.status === 403 && errorMessage.toLowerCase().includes('automation')) {
          showError(
            "Automation Disabled",
            "Session automation is disabled. Please enable it in your Account settings to use the API.",
            {
              actionLabel: 'Go to Account',
              actionUrl: '/account',
              duration: 15000
            }
          );
        } else {
          showError("Request Failed", errorMessage);
        }
        return;
      }

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        setResponseContent(data.choices[0].message.content);
      } else {
        setResponseContent("No content found in response");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setResponseContent(`Error: ${errorMessage}`);
      setServerResponse(`Error: ${errorMessage}`);
      showError("Request Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show message if no API key
  if (!selectedApiKey || !apiKeyPrefix) {
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
                You need to create and verify an API key before you can use Test.
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
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground">API Test</h1>
        <p className="text-muted-foreground text-base md:text-lg mt-2">
          Type an example prompt and view the raw CURL request and server response
        </p>

        {/* API Key Selection and Model Selection */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-4 md:mt-6">
          {/* API Key Selection */}
          <Card className="p-4 md:p-6 bg-card text-card-foreground rounded-lg shadow-sm flex-1">
            <CardContent className="flex flex-col gap-3">
              {/* Row 1: Label and Switch Key Button (Desktop) */}
              <div className="hidden sm:flex sm:items-center gap-3">
                <Label className="text-sm font-medium shrink-0">Selected API Key:</Label>
                <Button variant="outline" className="sm:ml-auto shrink-0" onClick={() => router.push('/api-keys')}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Switch Key
                </Button>
              </div>
              {/* Mobile: Row 1 - Label */}
              <div className="flex sm:hidden">
                <Label className="text-sm font-medium">Selected API Key:</Label>
              </div>
              {/* Mobile: Row 2 - API Key Name and Badge */}
              {/* Desktop: Row 2 - API Key Name, String, and Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                {/* Mobile: Show name and badge on same row */}
                <div className="flex sm:hidden items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{apiKeyName || apiKeys.find(key => key.key_prefix === apiKeyPrefix)?.name || ''}</span>
                  <Badge variant="default" className="flex items-center gap-1 bg-green-500/20 text-green-500 shrink-0">
                    <Check className="h-4 w-4" />
                    Ready for Testing
                  </Badge>
                </div>
                {/* Desktop: Show name, string, and badge */}
                <div className="hidden sm:flex sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground shrink-0">{apiKeyName || apiKeys.find(key => key.key_prefix === apiKeyPrefix)?.name || ''}</span>
                  <span className="font-mono text-sm break-all flex-1 min-w-0">{apiKeyPrefix}...</span>
                  <Badge variant="default" className="flex items-center gap-1 bg-green-500/20 text-green-500 shrink-0">
                    <Check className="h-4 w-4" />
                    Ready for Testing
                  </Badge>
                </div>
              </div>
              {/* Mobile: Row 2 - Switch Key Button */}
              <div className="flex sm:hidden">
                <Button variant="outline" className="w-full" onClick={() => router.push('/api-keys')}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Switch Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card className="p-4 md:p-6 bg-card text-card-foreground rounded-lg shadow-sm flex-1">
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <Label>Model</Label>
                <span className="text-xs md:text-sm text-muted-foreground">Model Type: LLM</span>
              </div>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={loadingModels}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {loadingModels ? (
                    <SelectItem value="loading">Loading...</SelectItem>
                  ) : filteredModels.length === 0 ? (
                    <SelectItem value="none">No models available</SelectItem>
                  ) : (
                    filteredModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs md:text-sm mt-2">
                {loadingModels ? 'Loading...' : `${filteredModels.length} model${filteredModels.length !== 1 ? 's' : ''} available`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Prompt */}
        <Card className="p-4 md:p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-4 md:mt-6">
          <CardContent>
            <Label htmlFor="user-prompt">User Prompt</Label>
            <Textarea
              id="user-prompt"
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="mt-2"
            />
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white mt-4 w-full md:w-auto"
              onClick={handleSendRequest}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? "Sending..." : "Send Request"}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="p-4 md:p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-4 md:mt-6">
          <CardContent>
            <h2 className="text-lg md:text-xl font-semibold mb-4">Select Output</h2>
            <Tabs defaultValue="response-content">
              <TabsList className="grid w-full grid-cols-3 gap-1 md:gap-2">
                <TabsTrigger value="response-content" className="text-xs md:text-sm px-2 md:px-4">
                  <span className="hidden sm:inline">Response Content</span>
                  <span className="sm:hidden">Response</span>
                </TabsTrigger>
                <TabsTrigger value="curl-request" className="text-xs md:text-sm px-2 md:px-4">
                  <Send className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 shrink-0" />
                  <span className="hidden sm:inline">Curl Request</span>
                  <span className="sm:hidden">Curl</span>
                </TabsTrigger>
                <TabsTrigger value="server-response" className="text-xs md:text-sm px-2 md:px-4">
                  <span className="hidden sm:inline">Server Response</span>
                  <span className="sm:hidden">Server</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="response-content" className="mt-4">
                {responseContent ? (
                  <div className="bg-black p-3 md:p-4 rounded-md border border-gray-300/20">
                    <pre className="text-white whitespace-pre-wrap text-xs md:text-sm overflow-x-auto">{responseContent}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Send a request to see the response content</p>
                )}
              </TabsContent>
              <TabsContent value="curl-request" className="mt-4">
                {curlRequest ? (
                  <div className="relative bg-black p-3 md:p-4 rounded-md border border-gray-300/20">
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={handleCopyCurl}
                    >
                      {copiedCurl ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-white whitespace-pre-wrap font-mono text-xs md:text-sm overflow-x-auto pr-12">{curlRequest}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Send a request to generate the cURL command</p>
                )}
              </TabsContent>
              <TabsContent value="server-response" className="mt-4">
                {serverResponse ? (
                  <div className="relative bg-black p-3 md:p-4 rounded-md border border-gray-300/20">
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={handleCopyResponse}
                    >
                      {copiedResponse ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-white whitespace-pre-wrap font-mono text-xs md:text-sm overflow-x-auto pr-12">{serverResponse}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Send a request to see the server response</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}

