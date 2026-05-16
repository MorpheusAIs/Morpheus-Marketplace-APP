"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Key,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { API_URLS } from "@/lib/api/config";
import {
  getAllowedModelTypes,
  filterModelsByType,
  selectDefaultModel,
} from "@/lib/model-filter-utils";
import { logModelName } from "@/lib/model-name-utils";
import { useNotification } from "@/lib/NotificationContext";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { validateJsonDepth, safeJsonParseOrNull } from "@/lib/utils/safe-json";

import {
  ParametersPanel,
  DEFAULT_PARAMS,
  type PlaygroundParams,
} from "@/components/playground/parameters-panel";
import {
  MessageBubble,
  type ConversationMessage,
  type MessageRole,
} from "@/components/playground/message-bubble";
import {
  ResponsePanel,
  type ResponseMetrics,
} from "@/components/playground/response-panel";

/* ------------------------------------------------------------------ */
/* Types                                                                  */
/* ------------------------------------------------------------------ */

interface Model {
  id: string;
  blockchainId?: string;
  ModelType?: string;
  input_price_per_million?: number;
  output_price_per_million?: number;
  context_length?: number;
}

interface ApiModelResponse {
  id: string;
  blockchainID?: string;
  blockchainId?: string;
  created?: number;
  modelType?: string;
  ModelType?: string;
  input_price_per_million?: number;
  output_price_per_million?: number;
  context_length?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeDefaultConversation(): ConversationMessage[] {
  return [
    { id: generateId(), role: "system", content: "You are a helpful assistant." },
    { id: generateId(), role: "user", content: "" },
  ];
}

function buildMessagesPayload(messages: ConversationMessage[]) {
  return messages
    .filter((m) => m.content.trim() !== "" || m.role === "system")
    .map((m) => ({ role: m.role, content: m.content }));
}

function generateCurlSnippet(
  apiKey: string,
  modelId: string,
  messages: ConversationMessage[],
  params: PlaygroundParams
): string {
  const body = {
    model: modelId,
    messages: buildMessagesPayload(messages),
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
    stream: params.stream,
    ...(params.stopSequences.length > 0 ? { stop: params.stopSequences } : {}),
  };
  return `curl -X POST '${API_URLS.chatCompletions()}' \\
  -H 'accept: application/json' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(body, null, 2)}'`;
}

function generatePythonSnippet(
  apiKey: string,
  modelId: string,
  messages: ConversationMessage[],
  params: PlaygroundParams
): string {
  const msgs = buildMessagesPayload(messages);
  return `from openai import OpenAI

client = OpenAI(
    base_url="${API_URLS.chatCompletions().replace("/chat/completions", "")}",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=${JSON.stringify(msgs, null, 4).replace(/^/gm, "    ").trimStart()},
    temperature=${params.temperature},
    max_tokens=${params.maxTokens},
    top_p=${params.topP},
    frequency_penalty=${params.frequencyPenalty},
    presence_penalty=${params.presencePenalty},
    stream=${params.stream ? "True" : "False"},${params.stopSequences.length > 0 ? `\n    stop=${JSON.stringify(params.stopSequences)},` : ""}
)

print(response.choices[0].message.content)`;
}

function generateNodeSnippet(
  apiKey: string,
  modelId: string,
  messages: ConversationMessage[],
  params: PlaygroundParams
): string {
  const msgs = buildMessagesPayload(messages);
  return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_URLS.chatCompletions().replace("/chat/completions", "")}",
  apiKey: "${apiKey}",
});

const response = await client.chat.completions.create({
  model: "${modelId}",
  messages: ${JSON.stringify(msgs, null, 2).replace(/^/gm, "  ").trimStart()},
  temperature: ${params.temperature},
  max_tokens: ${params.maxTokens},
  top_p: ${params.topP},
  frequency_penalty: ${params.frequencyPenalty},
  presence_penalty: ${params.presencePenalty},
  stream: ${params.stream},${params.stopSequences.length > 0 ? `\n  stop: ${JSON.stringify(params.stopSequences)},` : ""}
});

console.log(response.choices[0].message.content);`;
}

/* ------------------------------------------------------------------ */
/* Main component                                                        */
/* ------------------------------------------------------------------ */

export default function TestPage() {
  const router = useRouter();
  const { error: showError } = useNotification();
  const { apiKeys } = useCognitoAuth();

  /* API key state */
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");

  /* Model state */
  const [selectedModel, setSelectedModel] = useState("default");
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [allowedTypes] = useState<string[]>(getAllowedModelTypes());

  /* Parameters */
  const [params, setParams] = useState<PlaygroundParams>(DEFAULT_PARAMS);

  /* Conversation */
  const [messages, setMessages] = useState<ConversationMessage[]>(
    makeDefaultConversation()
  );

  /* Response / metrics */
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ResponseMetrics>({
    latencyMs: null,
    tokensIn: null,
    tokensOut: null,
    costUsd: null,
  });
  const [finishReason, setFinishReason] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState("");

  /* Copy state (keyed by message id) */
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  /* Mobile param accordion */
  const [paramsOpen, setParamsOpen] = useState(false);

  /* Scroll ref */
  const convEndRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------- */
  /* Load API key from sessionStorage                                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem("verified_api_key");
    const storedPrefix = sessionStorage.getItem("verified_api_key_prefix");
    const storedName = sessionStorage.getItem("verified_api_key_name");

    if (storedApiKey && storedPrefix) {
      setSelectedApiKey(storedApiKey);
      setApiKeyPrefix(storedPrefix);

      if (storedName) {
        setApiKeyName(storedName);
      } else if (apiKeys.length > 0) {
        const matchingKey = apiKeys.find(
          (key) => key.key_prefix === storedPrefix
        );
        if (matchingKey) {
          setApiKeyName(matchingKey.name);
          sessionStorage.setItem("verified_api_key_name", matchingKey.name);
        } else {
          const foundKey = apiKeys.find(
            (key) =>
              storedPrefix
                .toLowerCase()
                .startsWith(key.key_prefix.toLowerCase()) ||
              key.key_prefix
                .toLowerCase()
                .startsWith(storedPrefix.toLowerCase())
          );
          if (foundKey) {
            setApiKeyName(foundKey.name);
            sessionStorage.setItem(
              "verified_api_key_name",
              foundKey.name
            );
          }
        }
      }
    }
  }, [apiKeys]);

  /* ---------------------------------------------------------------- */
  /* Fetch models                                                        */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    fetchAvailableModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (models.length > 0) {
      applyModelTypeFilter(models, "LLM");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // Cmd/Ctrl+Enter shortcut wiring is set up further down, once
  // handleSendRequest is defined (see effect after handleSendRequest).
  const sendRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchAvailableModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch(API_URLS.models(), {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!response.ok) throw new Error(`API returned status ${response.status}`);

      const responseText = await response.text();
      const data = safeJsonParseOrNull(responseText, { maxDepth: 100 });
      if (!data)
        throw new Error(
          "Failed to parse response or response exceeds maximum depth"
        );

      const modelsArray = data.data || data;

      if (Array.isArray(modelsArray)) {
        const formattedModels = modelsArray.map((model: ApiModelResponse) => ({
          id: model.id,
          blockchainId: model.blockchainID || model.blockchainId,
          ModelType: model.modelType || model.ModelType || "UNKNOWN",
          input_price_per_million: model.input_price_per_million,
          output_price_per_million: model.output_price_per_million,
          context_length: model.context_length,
        })) as Model[];

        const llmModels = formattedModels.filter(
          (model: Model) =>
            (model.ModelType?.toUpperCase() || "UNKNOWN") === "LLM"
        );
        const sortedModels = llmModels.sort((a: Model, b: Model) =>
          a.id.localeCompare(b.id)
        );
        setModels(sortedModels);
        applyModelTypeFilter(sortedModels, "LLM");
      } else {
        const fallbackModels = [{ id: "default", ModelType: "LLM" }];
        setModels(fallbackModels);
        setFilteredModels(fallbackModels);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      const fallbackModels = [{ id: "default", ModelType: "LLM" }];
      setModels(fallbackModels);
      setFilteredModels(fallbackModels);
    } finally {
      setLoadingModels(false);
    }
  };

  const applyModelTypeFilter = (
    modelsToFilter: Model[],
    filterType: string
  ) => {
    const filtered = filterModelsByType(
      modelsToFilter,
      filterType,
      allowedTypes
    );
    setFilteredModels(filtered);

    if (filtered.length > 0) {
      const defaultModelId = selectDefaultModel(filtered);
      if (defaultModelId) setSelectedModel(defaultModelId);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Derived model metadata                                             */
  /* ---------------------------------------------------------------- */
  const currentModel = filteredModels.find((m) => m.id === selectedModel);

  /* ---------------------------------------------------------------- */
  /* Message management                                                 */
  /* ---------------------------------------------------------------- */
  const updateMessageContent = (id: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content } : m))
    );
  };

  const addMessage = (role: MessageRole = "user") => {
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role, content: "" },
    ]);
    setTimeout(() => {
      convEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== id);
      // Always keep at least system + one user turn
      const hasSystem = filtered.some((m) => m.role === "system");
      const hasUser = filtered.some((m) => m.role === "user");
      if (!hasSystem)
        return [
          { id: generateId(), role: "system", content: "You are a helpful assistant." },
          ...filtered,
        ];
      if (!hasUser)
        return [...filtered, { id: generateId(), role: "user", content: "" }];
      return filtered;
    });
  };

  const clearConversation = () => {
    setMessages(makeDefaultConversation());
    setMetrics({ latencyMs: null, tokensIn: null, tokensOut: null, costUsd: null });
    setFinishReason(null);
    setRawResponse("");
    setStreamingMsgId(null);
  };

  /* ---------------------------------------------------------------- */
  /* Send request                                                       */
  /* ---------------------------------------------------------------- */
  const handleSendRequest = useCallback(
    async (overrideMessages?: ConversationMessage[]) => {
      const msgsToSend = overrideMessages ?? messages;
      const payload = buildMessagesPayload(msgsToSend);

      // Need at least one non-empty user message
      const hasUserContent = payload.some(
        (m) => m.role === "user" && m.content.trim() !== ""
      );
      if (!hasUserContent || !selectedApiKey) {
        showError(
          "Validation Error",
          "Please add a user message and ensure your API key is set"
        );
        return;
      }

      setIsLoading(true);
      setFinishReason(null);

      // Remove any trailing empty assistant message or add a new one
      let updatedMessages = msgsToSend.filter(
        (m) => !(m.role === "assistant" && m.content.trim() === "")
      );
      const assistantMsgId = generateId();
      const assistantMsg: ConversationMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      };
      updatedMessages = [...updatedMessages, assistantMsg];
      setMessages(updatedMessages);
      setStreamingMsgId(assistantMsgId);

      const startTime = Date.now();

      try {
        logModelName("sendRequest", selectedModel);

        const requestBody: Record<string, unknown> = {
          model: selectedModel,
          messages: payload,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          top_p: params.topP,
          frequency_penalty: params.frequencyPenalty,
          presence_penalty: params.presencePenalty,
          stream: params.stream,
        };
        if (params.stopSequences.length > 0) {
          requestBody.stop = params.stopSequences;
        }

        try {
          validateJsonDepth(requestBody, { maxDepth: 100 });
        } catch (error) {
          showError(
            "Validation Error",
            `Invalid request data: ${
              error instanceof Error
                ? error.message
                : "Data exceeds maximum depth"
            }`
          );
          setIsLoading(false);
          setStreamingMsgId(null);
          return;
        }

        const response = await fetch(API_URLS.chatCompletions(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            Authorization: `Bearer ${selectedApiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        /* ---- Streaming path ---- */
        if (params.stream && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finalChunk: Record<string, unknown> | null = null;
          let accumulated = "";

          const flush = (chunk: string) => {
            // Process SSE lines
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (raw === "[DONE]") continue;
              const parsed = safeJsonParseOrNull(raw, { maxDepth: 100 });
              if (!parsed) continue;
              finalChunk = parsed as Record<string, unknown>;
              const choices = (parsed as { choices?: Array<{ delta?: { content?: string } }> }).choices;
              const delta = choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulated }
                      : m
                  )
                );
              }
            }
          };

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const boundary = buffer.lastIndexOf("\n");
            if (boundary !== -1) {
              flush(buffer.slice(0, boundary));
              buffer = buffer.slice(boundary + 1);
            }
          }
          if (buffer) flush(buffer);

          const latencyMs = Date.now() - startTime;

          // Extract usage and finish_reason from final chunk.
          // Prefer usage_from_consumer (what the user actually paid for) over
          // the raw `usage` block, which includes provider-side overhead like
          // hidden system primers.
          const finalParsed = finalChunk as {
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            usage_from_consumer?: { prompt_tokens?: number; completion_tokens?: number };
            usage_from_provider?: { prompt_tokens?: number; completion_tokens?: number };
            choices?: Array<{ finish_reason?: string }>;
          } | null;

          const effectiveUsage =
            finalParsed?.usage_from_consumer ??
            finalParsed?.usage_from_provider ??
            finalParsed?.usage;
          const tokensIn = effectiveUsage?.prompt_tokens ?? null;
          const tokensOut = effectiveUsage?.completion_tokens ?? null;
          const reason = finalParsed?.choices?.[0]?.finish_reason ?? null;

          let costUsd: number | null = null;
          if (
            tokensIn !== null &&
            tokensOut !== null &&
            currentModel?.input_price_per_million &&
            currentModel?.output_price_per_million
          ) {
            costUsd =
              (tokensIn / 1_000_000) * currentModel.input_price_per_million +
              (tokensOut / 1_000_000) * currentModel.output_price_per_million;
          }

          setMetrics({ latencyMs, tokensIn, tokensOut, costUsd });
          setFinishReason(reason);
          setRawResponse(
            finalChunk ? JSON.stringify(finalChunk, null, 2) : ""
          );

          if (!response.ok) {
            // Response was not ok — already consumed stream for error info
            const errMsg =
              (finalParsed as { detail?: string; error?: { message?: string } } | null)
                ?.detail ||
              (finalParsed as { detail?: string; error?: { message?: string } } | null)
                ?.error?.message ||
              `HTTP ${response.status}`;
            handleResponseError(response.status, errMsg, finalParsed);
          }
        } else {
          /* ---- Non-streaming path ---- */
          const responseText = await response.text();
          const data = safeJsonParseOrNull(responseText, { maxDepth: 100 });
          if (!data) {
            showError(
              "Parse Error",
              "Failed to parse response or response exceeds maximum depth"
            );
            setIsLoading(false);
            setStreamingMsgId(null);
            return;
          }

          setRawResponse(JSON.stringify(data, null, 2));

          const latencyMs = Date.now() - startTime;
          const typedData = data as {
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            usage_from_consumer?: { prompt_tokens?: number; completion_tokens?: number };
            usage_from_provider?: { prompt_tokens?: number; completion_tokens?: number };
            detail?: string;
            error?: { message?: string };
          };
          const effectiveUsage =
            typedData.usage_from_consumer ??
            typedData.usage_from_provider ??
            typedData.usage;
          const tokensIn = effectiveUsage?.prompt_tokens ?? null;
          const tokensOut = effectiveUsage?.completion_tokens ?? null;

          let costUsd: number | null = null;
          if (
            tokensIn !== null &&
            tokensOut !== null &&
            currentModel?.input_price_per_million &&
            currentModel?.output_price_per_million
          ) {
            costUsd =
              (tokensIn / 1_000_000) * currentModel.input_price_per_million +
              (tokensOut / 1_000_000) * currentModel.output_price_per_million;
          }

          setMetrics({ latencyMs, tokensIn, tokensOut, costUsd });

          if (!response.ok) {
            const errorMessage =
              typedData.detail ||
              typedData.error?.message ||
              `HTTP ${response.status}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: `Error: ${errorMessage}` }
                  : m
              )
            );
            handleResponseError(response.status, errorMessage, typedData);
            return;
          }

          const content =
            typedData.choices?.[0]?.message?.content ??
            "No content found in response";
          const reason = typedData.choices?.[0]?.finish_reason ?? null;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content } : m
            )
          );
          setFinishReason(reason ?? null);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `Error: ${errorMessage}` }
              : m
          )
        );
        showError("Request Failed", errorMessage);
      } finally {
        setIsLoading(false);
        setStreamingMsgId(null);
        setTimeout(() => {
          convEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, selectedApiKey, selectedModel, params, currentModel]
  );

  // Keep the keyboard-shortcut ref pointed at the latest handler/state
  // so Cmd/Ctrl+Enter never fires a stale closure.
  useEffect(() => {
    sendRef.current = () => {
      if (!isLoading) handleSendRequest();
    };
  }, [handleSendRequest, isLoading]);

  function handleResponseError(
    status: number,
    errorMessage: string,
    data: unknown
  ) {
    if (status === 400) {
      const isModelError =
        errorMessage.toLowerCase().includes("invalid model") ||
        errorMessage.toLowerCase().includes("model name") ||
        errorMessage.toLowerCase().includes("model=");

      if (isModelError) {
        const backendModelMatch = errorMessage.match(/model=([^\s,}]+)/i);
        const backendModelName = backendModelMatch
          ? backendModelMatch[1]
          : null;

        console.error("[Model Error] Backend inconsistency detected:", {
          requestedModel: selectedModel,
          backendAttemptedModel: backendModelName,
          errorMessage,
          fullError: data,
          note: "This model was returned from /v1/models but rejected by /v1/chat/completions",
        });

        const errMsg =
          backendModelName && backendModelName !== selectedModel
            ? `The backend returned "${selectedModel}" in the models list but tried to use "${backendModelName}" when making the request. This is a backend configuration issue.`
            : `The model "${selectedModel}" was returned from the models list but is not accepted by the chat endpoint. This is a backend configuration issue.`;

        showError("Model Configuration Error", errMsg, { duration: 15000 });
      }
    }

    if (
      status === 403 &&
      errorMessage.toLowerCase().includes("automation")
    ) {
      showError(
        "Automation Disabled",
        "Session automation is disabled. Please enable it in your Account settings to use the API.",
        { actionLabel: "Go to Account", actionUrl: "/account", duration: 15000 }
      );
    } else if (status !== 400) {
      showError("Request Failed", errorMessage);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Per-turn actions                                                   */
  /* ---------------------------------------------------------------- */
  const handleRegenerate = (assistantMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 0) return;
    // Slice up to (but not including) this assistant turn
    const prior = messages.slice(0, idx);
    // Remove the assistant message we're regenerating
    setMessages(prior);
    handleSendRequest(prior);
  };

  const handleCopyMessage = async (msg: ConversationMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleBranch = (assistantMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 0) return;
    const branchMsgs: ConversationMessage[] = messages
      .slice(0, idx + 1)
      .map((m) => ({ ...m, id: generateId() }));
    setMessages(branchMsgs);
  };

  /* ---------------------------------------------------------------- */
  /* Code snippets (memoised via callback deps)                         */
  /* ---------------------------------------------------------------- */
  const curlSnippet = generateCurlSnippet(
    selectedApiKey,
    selectedModel,
    messages,
    params
  );
  const pythonSnippet = generatePythonSnippet(
    selectedApiKey,
    selectedModel,
    messages,
    params
  );
  const nodeSnippet = generateNodeSnippet(
    selectedApiKey,
    selectedModel,
    messages,
    params
  );

  /* ---------------------------------------------------------------- */
  /* API key gate                                                        */
  /* ---------------------------------------------------------------- */
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
                A Default API key must be set and verified before using the
                Playground. Go to API Keys to set your Default API Key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push("/api-keys")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Go to API Keys
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                              */
  /* ---------------------------------------------------------------- */
  return (
    <AuthenticatedLayout>
      <div className="flex flex-col h-[calc(100svh-4rem)] min-h-0 overflow-hidden">
        {/* ── TOP BAR ──────────────────────────────────────────────── */}
        <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-background">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">
              Playground
            </h1>
            <p className="text-sm text-muted-foreground">
              Iterate on prompts before shipping
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Model pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs text-foreground">
              <span className="font-semibold tracking-widest uppercase text-muted-foreground text-[10px]">
                MODEL
              </span>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={loadingModels}
              >
                <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-xs font-mono text-foreground shadow-none focus:ring-0 focus:outline-none min-w-[80px] max-w-[200px] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:ml-1 [&>svg]:opacity-50">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {loadingModels ? (
                    <SelectItem value="loading">Loading…</SelectItem>
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
              {currentModel?.context_length && (
                <span className="text-muted-foreground hidden sm:inline">
                  · {Math.round(currentModel.context_length / 1000)}k ctx
                </span>
              )}
              {currentModel?.input_price_per_million && (
                <span className="text-muted-foreground hidden sm:inline">
                  · ${currentModel.input_price_per_million.toFixed(2)}/M in
                </span>
              )}
            </div>

            {/* Key pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs">
              <span className="font-semibold tracking-widest uppercase text-muted-foreground text-[10px]">
                KEY
              </span>
              <span className="font-medium text-foreground">
                {apiKeyName || "—"}
              </span>
              <span className="font-mono text-muted-foreground">
                · {apiKeyPrefix}…
              </span>
            </div>
          </div>
        </header>

        {/* ── MOBILE: PARAMETERS ACCORDION ────────────────────────── */}
        <div className="md:hidden shrink-0 border-b border-border">
          <button
            onClick={() => setParamsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Parameters</span>
            {paramsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {paramsOpen && (
            <div className="border-t border-border">
              <ParametersPanel params={params} onChange={setParams} />
            </div>
          )}
        </div>

        {/* ── THREE-COLUMN BODY ───────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT — Parameters (desktop only) */}
          <div className="hidden md:flex flex-col w-[272px] shrink-0 border-r border-border overflow-y-auto">
            <ParametersPanel params={params} onChange={setParams} />
          </div>

          {/* MIDDLE — Conversation */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border">
            {/* Column header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                Conversation
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => addMessage("user")}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Message
                </button>
                <button
                  onClick={clearConversation}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  modelId={selectedModel}
                  isStreaming={streamingMsgId === msg.id}
                  onContentChange={(content) =>
                    updateMessageContent(msg.id, content)
                  }
                  onRegenerate={
                    msg.role === "assistant"
                      ? () => handleRegenerate(msg.id)
                      : undefined
                  }
                  onCopy={
                    msg.role === "assistant"
                      ? () => handleCopyMessage(msg)
                      : undefined
                  }
                  onBranch={
                    msg.role === "assistant"
                      ? () => handleBranch(msg.id)
                      : undefined
                  }
                  onRemove={
                    // System messages are removable only when there's more than one
                    ((): (() => void) | undefined => {
                      if (msg.role === "system") {
                        return messages.filter(m => m.role === "system").length > 1
                          ? () => removeMessage(msg.id)
                          : undefined;
                      }
                      return () => removeMessage(msg.id);
                    })()
                  }
                  copiedId={copiedMsgId}
                />
              ))}
              <div ref={convEndRef} />
            </div>

            <Separator />

            {/* Composer */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => addMessage("user")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add message</span>
              </button>

              <div className="flex-1" />

              <Button
                onClick={() => handleSendRequest()}
                disabled={isLoading}
                className="h-8 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Run
                <kbd className="hidden sm:inline text-[10px] opacity-70 ml-0.5">⌘↩</kbd>
              </Button>
            </div>
          </div>

          {/* RIGHT — Response */}
          <div className="hidden lg:flex flex-col w-[420px] shrink-0 min-h-0">
            <ResponsePanel
              content={
                messages.find(
                  (m) =>
                    m.role === "assistant" &&
                    (streamingMsgId === m.id || !isLoading)
                )?.content ?? ""
              }
              metrics={metrics}
              finishReason={finishReason}
              rawResponse={rawResponse}
              isLoading={isLoading}
              curlSnippet={curlSnippet}
              pythonSnippet={pythonSnippet}
              nodeSnippet={nodeSnippet}
            />
          </div>
        </div>

        {/* ── MOBILE: Response panel below conversation ─────────── */}
        <div className="lg:hidden shrink-0 border-t border-border max-h-72 overflow-y-auto">
          <ResponsePanel
            content={
              messages.find(
                (m) =>
                  m.role === "assistant" &&
                  (streamingMsgId === m.id || !isLoading)
              )?.content ?? ""
            }
            metrics={metrics}
            finishReason={finishReason}
            rawResponse={rawResponse}
            isLoading={isLoading}
            curlSnippet={curlSnippet}
            pythonSnippet={pythonSnippet}
            nodeSnippet={nodeSnippet}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
