# API Test Screen

## Overview
A screen for testing API endpoints, specifically chat completions. Users can configure API keys, select models, input prompts, and view generated cURL requests or server responses.

## Component Structure

### Root Layout
- **Container**: `div`
  - **Props**: `className: "flex h-screen bg-background"`

### Sidebar
- **Component**: `Sidebar` (see `docs/components/sidebar.md`)
- **Props**: Standard sidebar props

### Main Content Area
- **Container**: `div`
  - **Props**: `className: "flex-1 overflow-y-auto p-8"`

### Header Section
- **Title**: `h1`
  - **Props**: `className: "text-4xl font-bold text-foreground"`
  - **Content**: `"API Test"`
- **Subtitle**: `p`
  - **Props**: `className: "text-muted-foreground text-lg mt-2"`
  - **Content**: `"Type an example prompt and view the raw CURL request and server response"`

### API Key Selection Section
- **Container**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6"`
- **Selected API Key Display**: `div`
  - **Label**: `Label` (from `@/components/ui/label`)
    - **Props**: `className: "text-sm font-medium"`
    - **Content**: `"Selected API Key:"`
  - **Value**: `span`
    - **Props**: `className: "font-mono text-sm ml-2"`
    - **Content**: Truncated API key
  - **Status Indicator**: `Badge` (from `@/components/ui/badge`)
    - **Props**: `variant: "default" className: "ml-4 flex items-center gap-1 bg-green-500/20 text-green-500"`
    - **Children**: `Check` icon (from `lucide-react`) + `"Ready for Testing"`
- **Switch Key Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "outline" className: "ml-auto"`
  - **Children**: `RefreshCw` icon (from `lucide-react`) + `"Switch Key"`

### Model Type Selection Section
- **Container**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6"`
- **Model Type Dropdowns**: `div` with `flex gap-4`
  - **Left Select**: `Select` (from `@/components/ui/select`)
    - **Props**: `defaultValue: "all"`
    - **SelectTrigger**: `SelectTrigger` (from `@/components/ui/select`)
    - **SelectContent**: `SelectContent` (from `@/components/ui/select`)
      - **SelectItem**: `SelectItem` (from `@/components/ui/select`) value="all" label="All"
  - **Right Select**: `Select` (from `@/components/ui/select`)
    - **Props**: `defaultValue: "mistral-31-24b"`
    - Same structure as left select
- **Models Available Text**: `p`
  - **Props**: `className: "text-muted-foreground text-sm mt-2"`
  - **Content**: `"19 models available"`

### User Prompt Input Section
- **Container**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "user-prompt"`
  - **Content**: `"User Prompt"`
- **Textarea**: `Textarea` (from `@/components/ui/textarea`)
  - **Props**:
    - `id`: `"user-prompt"`
    - `placeholder`: `"Enter your prompt here..."`
    - `defaultValue`: `"What is the capital of New Hampshire?"`
    - `rows`: `3`
    - `className`: `"mt-2"`
- **Send Request Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "default" className: "bg-green-600 hover:bg-green-700 text-white mt-4"`
  - **Content**: `"Send Request"`

### Select Output Section
- **Container**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6"`
- **Header**: `h2`
  - **Props**: `className: "text-xl font-semibold mb-4"`
  - **Content**: `"Select Output"`
- **Tabs**: `Tabs` (from `@/components/ui/tabs`)
  - **Props**: `defaultValue: "curl-request"`
  - **TabsList**: `TabsList` (from `@/components/ui/tabs`)
    - **TabsTrigger**: `TabsTrigger` (from `@/components/ui/tabs`)
      - **Props**: `value: "response-content"`
      - **Content**: `"Response Content"`
    - **TabsTrigger**: `TabsTrigger` (from `@/components/ui/tabs`)
      - **Props**: `value: "curl-request"`
      - **Children**: `Send` icon (from `lucide-react`) + `"Curl Request"`
    - **TabsTrigger**: `TabsTrigger` (from `@/components/ui/tabs`)
      - **Props**: `value: "server-response"`
      - **Content**: `"Server Response"`
  - **TabsContent**: `TabsContent` (from `@/components/ui/tabs`)
    - **Props**: `value: "curl-request"`
    - **Code Block**: `CodeBlock` (from `@ai-elements/code-block`)
      - **Props**:
        - `language`: `"bash"`
        - `code`: cURL command string
        - `className`: `"mt-4"`
      - **Note**: Should include copy button functionality

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CodeBlock } from "@ai-elements/code-block";
import { Check, RefreshCw, Send } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

export default function ApiTestPage() {
  const [selectedApiKey] = useState("sk-nbnsRJ-bf5g3a-Arbn5f");
  const [modelType, setModelType] = useState("all");
  const [selectedModel, setSelectedModel] = useState("mistral-31-24b");
  const [prompt, setPrompt] = useState("What is the capital of New Hampshire?");
  const [curlRequest, setCurlRequest] = useState("");

  const generateCurlRequest = () => {
    const curl = `curl -X 'POST' \\
'https://api.mor.org/api/v1/chat/completions' \\
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
            "content": "${prompt}"
        }
    ]
}'`;
    setCurlRequest(curl);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-foreground">API Test</h1>
        <p className="text-muted-foreground text-lg mt-2">
          Type an example prompt and view the raw CURL request and server response
        </p>

        {/* API Key Selection */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
          <CardContent className="flex items-center">
            <Label className="text-sm font-medium">Selected API Key:</Label>
            <span className="font-mono text-sm ml-2">{selectedApiKey}...</span>
            <Badge variant="default" className="ml-4 flex items-center gap-1 bg-green-500/20 text-green-500">
              <Check className="h-4 w-4" />
              Ready for Testing
            </Badge>
            <Button variant="outline" className="ml-auto">
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
                <Select value={modelType} onValueChange={setModelType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mistral-31-24b">mistral-31-24b</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mt-2">19 models available</p>
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
              onClick={generateCurlRequest}
            >
              Send Request
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="p-6 bg-card text-card-foreground rounded-lg shadow-sm mt-6">
          <CardContent>
            <h2 className="text-xl font-semibold mb-4">Select Output</h2>
            <Tabs defaultValue="curl-request">
              <TabsList>
                <TabsTrigger value="response-content">Response Content</TabsTrigger>
                <TabsTrigger value="curl-request">
                  <Send className="mr-2 h-4 w-4" />
                  Curl Request
                </TabsTrigger>
                <TabsTrigger value="server-response">Server Response</TabsTrigger>
              </TabsList>
              <TabsContent value="curl-request" className="mt-4">
                {curlRequest && (
                  <CodeBlock language="bash" code={curlRequest} />
                )}
              </TabsContent>
              <TabsContent value="response-content" className="mt-4">
                {/* Response content display */}
              </TabsContent>
              <TabsContent value="server-response" className="mt-4">
                {/* Server response display */}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## Styling Notes
- Dark theme with card-based sections
- Green accent for primary actions and status indicators
- Code block with syntax highlighting for cURL commands
- Tabs for switching between output formats
- Responsive layout with proper spacing

