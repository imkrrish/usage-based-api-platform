// Usage event document interface
export interface IUsageEvent {
  api_key: string;
  deployment_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: Date;
}

// Query parameters for usage endpoint
export interface UsageQueryParams {
  api_key: string;
  from: string;
  to: string;
  group_by: 'day' | 'model';
}

// Aggregated usage for a single group (day or model)
export interface UsageGroupItem {
  key: string; // ISO date string (YYYY-MM-DD) or model name
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
}

// Response for usage endpoint
export interface UsageResponse {
  api_key: string;
  from: string;
  to: string;
  group_by: 'day' | 'model';
  totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
  breakdown: UsageGroupItem[];
}

// Pricing constants
export const PRICING = {
  INPUT_COST_PER_1K_TOKENS: 0.001,
  OUTPUT_COST_PER_1K_TOKENS: 0.002,
} as const;

// Calculate input cost
export function calculateInputCost(inputTokens: number): number {
  return (inputTokens / 1000) * PRICING.INPUT_COST_PER_1K_TOKENS;
}

// Calculate output cost
export function calculateOutputCost(outputTokens: number): number {
  return (outputTokens / 1000) * PRICING.OUTPUT_COST_PER_1K_TOKENS;
}

// Calculate total cost
export function calculateTotalCost(inputTokens: number, outputTokens: number): number {
  return calculateInputCost(inputTokens) + calculateOutputCost(outputTokens);
}
