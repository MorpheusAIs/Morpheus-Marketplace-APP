import type { LedgerEntryResponse } from "@/types/billing";

export interface ModelPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

/**
 * Build a model → pricing map from ledger usage entries. /v1/models does not
 * expose per-token pricing, so we derive it from the most recent usage_charge
 * entry we've seen for each model. Keys lookups by both model_id (blockchain
 * id) and model_name (human id) so the playground can match either.
 */
export function buildPricingMap(
  entries: LedgerEntryResponse[],
): Map<string, ModelPricing> {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const map = new Map<string, ModelPricing>();
  for (const entry of sorted) {
    if (entry.input_price_per_million == null) continue;
    if (entry.output_price_per_million == null) continue;
    const inputPrice = parseFloat(entry.input_price_per_million);
    const outputPrice = parseFloat(entry.output_price_per_million);
    if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) continue;

    const pricing: ModelPricing = {
      inputPricePerMillion: inputPrice,
      outputPricePerMillion: outputPrice,
    };
    if (entry.model_id && !map.has(entry.model_id)) {
      map.set(entry.model_id, pricing);
    }
    if (entry.model_name && !map.has(entry.model_name)) {
      map.set(entry.model_name, pricing);
    }
  }
  return map;
}

export function lookupPricing(
  pricingMap: Map<string, ModelPricing>,
  modelId: string | undefined,
  blockchainId: string | undefined,
): ModelPricing | null {
  if (modelId && pricingMap.has(modelId)) return pricingMap.get(modelId)!;
  if (blockchainId && pricingMap.has(blockchainId)) {
    return pricingMap.get(blockchainId)!;
  }
  return null;
}

export function computeCost(
  pricing: ModelPricing,
  tokensIn: number,
  tokensOut: number,
): number {
  return (
    (tokensIn / 1_000_000) * pricing.inputPricePerMillion +
    (tokensOut / 1_000_000) * pricing.outputPricePerMillion
  );
}
