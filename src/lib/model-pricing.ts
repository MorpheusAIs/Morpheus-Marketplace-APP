/**
 * Static pricing catalog mirrored from the public Morpheus website
 * (/inference-api models table). Used as a fallback for cost calculation
 * in the Playground when the upstream /v1/models endpoint does not return
 * input_price_per_million / output_price_per_million fields.
 *
 * Prices are USD per 1,000,000 tokens.
 */

export interface ModelPricingEntry {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  context: string;
  size: "Large" | "Medium" | "Small" | "Embedding";
  capabilities: {
    reasoning: boolean;
    toolCalling: boolean;
    vision: boolean;
  };
}

export const MODEL_PRICING: Record<string, ModelPricingEntry> = {
  "glm-5": {
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 3.2,
    context: "200K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "glm-5.1": {
    inputPricePerMillion: 1.5,
    outputPricePerMillion: 5.0,
    context: "200K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "glm-5.1-non-thinking": {
    inputPricePerMillion: 1.5,
    outputPricePerMillion: 5.0,
    context: "200K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "kimi-k2.5": {
    inputPricePerMillion: 0.6,
    outputPricePerMillion: 3.0,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: true },
  },
  "kimi-k2.6": {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 3.25,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: true },
  },
  "kimi-k2-thinking": {
    inputPricePerMillion: 0.6,
    outputPricePerMillion: 3.0,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "glm-4.7": {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 2.25,
    context: "198K",
    size: "Large",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "glm-4.7-thinking": {
    inputPricePerMillion: 0.45,
    outputPricePerMillion: 2.0,
    context: "198K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "glm-4.7-flash": {
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.5,
    context: "128K",
    size: "Large",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "qwen3-235b": {
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 3.0,
    context: "128K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "minimax-m2.5": {
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 1.2,
    context: "198K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "minimax-m2.7": {
    inputPricePerMillion: 0.35,
    outputPricePerMillion: 1.5,
    context: "198K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
  "qwen3-coder-480b-a35b-instruct": {
    inputPricePerMillion: 0.7,
    outputPricePerMillion: 2.8,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "qwen3-next-80b": {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 1.5,
    context: "256K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "gpt-oss-120b": {
    inputPricePerMillion: 0.07,
    outputPricePerMillion: 0.28,
    context: "128K",
    size: "Large",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "hermes-3-llama-3.1-405b": {
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 3.0,
    context: "128K",
    size: "Large",
    capabilities: { reasoning: false, toolCalling: false, vision: false },
  },
  "llama-3.3-70b": {
    inputPricePerMillion: 0.7,
    outputPricePerMillion: 2.5,
    context: "128K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "llama-3.2-3b": {
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.5,
    context: "128K",
    size: "Small",
    capabilities: { reasoning: false, toolCalling: true, vision: false },
  },
  "mistral-31-24b": {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 2.0,
    context: "128K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: true, vision: true },
  },
  "venice-uncensored": {
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.9,
    context: "32K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: false, vision: false },
  },
  "text-embedding-bge-m3": {
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.5,
    context: "—",
    size: "Embedding",
    capabilities: { reasoning: false, toolCalling: false, vision: false },
  },
  "gemma-4-31b": {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.4,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: false, vision: true },
  },
  "gemma-4-26b-a4b": {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.4,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: false, vision: true },
  },
  "qwen35-35b-a3b": {
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 1.25,
    context: "256K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: true, vision: true },
  },
  "qwen35-9b": {
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.15,
    context: "256K",
    size: "Medium",
    capabilities: { reasoning: false, toolCalling: true, vision: true },
  },
  "arcee-trinity-large-thinking": {
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 1.0,
    context: "256K",
    size: "Large",
    capabilities: { reasoning: true, toolCalling: true, vision: false },
  },
};

/**
 * Normalize a model name to a pricing-catalog key.
 * - lowercases
 * - strips trailing `:web` / `:tee` provider suffixes (matches website)
 * - strips leading `alt-` (Morpheus exposes alternate routing variants like
 *   `alt-glm-5` that share pricing with their base model)
 */
export function normalizeModelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/:(web|tee)$/, "")
    .replace(/^alt-/, "");
}

export function getModelPricing(modelName: string): ModelPricingEntry | undefined {
  if (!modelName) return undefined;
  return MODEL_PRICING[normalizeModelKey(modelName)];
}

/**
 * Calculate the USD cost of a request given input/output token counts.
 * `apiInputPrice` / `apiOutputPrice` (per million tokens) take precedence when
 * provided by the backend; otherwise the static pricing catalog is used.
 * Returns null when no pricing data is available.
 */
export function calculateCostUsd(
  modelName: string,
  tokensIn: number | null,
  tokensOut: number | null,
  apiInputPrice?: number,
  apiOutputPrice?: number
): number | null {
  if (tokensIn === null || tokensOut === null) return null;

  const inputPrice =
    apiInputPrice ?? getModelPricing(modelName)?.inputPricePerMillion;
  const outputPrice =
    apiOutputPrice ?? getModelPricing(modelName)?.outputPricePerMillion;

  if (inputPrice === undefined || outputPrice === undefined) return null;

  return (
    (tokensIn / 1_000_000) * inputPrice +
    (tokensOut / 1_000_000) * outputPrice
  );
}
