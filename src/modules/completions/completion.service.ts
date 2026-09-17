/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates input tokens from prompt
 * Uses the assignment's rule: Math.round(prompt.length / 4)
 */
export function calculateInputTokens(prompt: string): number {
  return Math.round(prompt.length / 4);
}

/**
 * Generates output tokens count
 * Random integer from 50 to 200 inclusive
 */
export function generateOutputTokens(): number {
  return randomInt(50, 200);
}

/**
 * Completion result
 */
export interface CompletionResult {
  output: string;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Creates a mock completion
 * Returns "mocked response" with calculated tokens
 */
export function createCompletion(prompt: string): CompletionResult {
  const inputTokens = calculateInputTokens(prompt);
  const outputTokens = generateOutputTokens();

  return {
    output: 'mocked response',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}
