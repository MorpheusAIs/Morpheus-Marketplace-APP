"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { Check, RefreshCw, Send, Copy } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { API_URLS } from "@/lib/api/config";
import { getAllowedModelTypes, filterModelsByType, getFilterOptions, selectDefaultModel } from "@/lib/model-filter-utils";
import { useNotification } from "@/lib/NotificationContext";

interface Model {
  id: string;
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

export default function TestPage() {
  const router = useRouter();
  const { error: showError } = useNotification();
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");
  const [modelType, setModelType] = useState("all");
  const [selectedModel, setSelectedModel] = useState("default");
  const [prompt, setPrompt] = useState("What is the capital of New Hampshire?");
  const [curlRequest, setCurlRequest] = useState("");
  const [responseContent, setResponseContent] = useState("");
  const [serverResponse, setServerResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [filterOptions, setFilterOptions] = useState<Array<{value: string, label: string}>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [allowedTypes] = useState<string[]>(getAllowedModelTypes());
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Load API key from sessionStorage and redirect if not verified
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem('verified_api_key');
    const storedPrefix = sessionStorage.getItem('verified_api_key_prefix');
    
    if (storedApiKey && storedPrefix) {
      setSelectedApiKey(storedApiKey);
      setApiKeyPrefix(storedPrefix);
    } else {
      router.push('/api-keys');
    }
  }, [router]);

  // Fetch available models
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // Filter models when model type changes
  useEffect(() => {
    if (models.length > 0) {
      applyModelTypeFilter(models, modelType);
    }
  }, [modelType, models]);

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
        }));
        
        const sortedModels = formattedModels.sort((a: Model, b: Model) => a.id.localeCompare(b.id));
        setModels(sortedModels);
        applyModelTypeFilter(sortedModels, 'all');
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
    
    const options = getFilterOptions(modelsToFilter, allowedTypes);
    setFilterOptions(options);
    
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

  if (!selectedApiKey) {
    return null; // Will redirect via useEffect
  }

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-foreground">API Test</h1>
        <p className="text-muted-foreground text-lg mt-2">
          Type an example prompt and view the raw CURL request and server response
        </p>

        {/* API Key Selection */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
          <CardContent className="flex items-center">
            <Label className="text-sm font-medium">Selected API Key:</Label>
            <span className="font-mono text-sm ml-2">{apiKeyPrefix}...</span>
            <Badge variant="default" className="ml-4 flex items-center gap-1 bg-green-500/20 text-green-500">
              <Check className="h-4 w-4" />
              Ready for Testing
            </Badge>
            <Button variant="outline" className="ml-auto" onClick={() => router.push('/api-keys')}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Switch Key
            </Button>
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Model Type</Label>
                <Select value={modelType} onValueChange={setModelType} disabled={loadingModels}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={loadingModels}>
                  <SelectTrigger>
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
              </div>
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              {loadingModels ? 'Loading...' : `${filteredModels.length} model${filteredModels.length !== 1 ? 's' : ''} available`}
            </p>
          </CardContent>
        </Card>

        {/* User Prompt */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
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
              className="bg-green-600 hover:bg-green-700 text-white mt-4"
              onClick={handleSendRequest}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? "Sending..." : "Send Request"}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Select Output</h2>
            <Tabs defaultValue="response-content">
              <TabsList>
                <TabsTrigger value="response-content">Response Content</TabsTrigger>
                <TabsTrigger value="curl-request">
                  <Send className="mr-2 h-4 w-4" />
                  Curl Request
                </TabsTrigger>
                <TabsTrigger value="server-response">Server Response</TabsTrigger>
              </TabsList>
              <TabsContent value="response-content" className="mt-4">
                {responseContent ? (
                  <div className="bg-black p-4 rounded-md border border-gray-300/20">
                    <pre className="text-white whitespace-pre-wrap">{responseContent}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Send a request to see the response content</p>
                )}
              </TabsContent>
              <TabsContent value="curl-request" className="mt-4">
                {curlRequest ? (
                  <div className="relative bg-black p-4 rounded-md border border-gray-300/20">
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
                    <pre className="text-white whitespace-pre-wrap font-mono text-sm pr-12">{curlRequest}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Send a request to generate the cURL command</p>
                )}
              </TabsContent>
              <TabsContent value="server-response" className="mt-4">
                {serverResponse ? (
                  <div className="relative bg-black p-4 rounded-md border border-gray-300/20">
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
                    <pre className="text-white whitespace-pre-wrap font-mono text-sm overflow-x-auto pr-12">{serverResponse}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Send a request to see the server response</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}

