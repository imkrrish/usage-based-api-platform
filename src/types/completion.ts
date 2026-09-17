// Request body for creating a completion
export interface CreateCompletionRequest {
  prompt: string;
}

// Response for creating a completion
export interface CreateCompletionResponse {
  output: string;
  input_tokens: number;
  output_tokens: number;
}

// Route params for completion operations
export interface CompletionParams {
  [key: string]: string;
  deployment_id: string;
}
