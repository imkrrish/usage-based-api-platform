import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types/auth.js';
import type { CreateCompletionRequest, CompletionParams } from '../../types/completion.js';
import { createCompletion } from './completion.service.js';
import { createApiError } from '../../middleware/error.middleware.js';
import { createUsageEvent } from '../usage/usage.service.js';

/**
 * POST /v1/:deployment_id/completions
 * Creates a completion for the specified deployment
 */
export async function handleCompletion(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  // Cast to AuthenticatedRequest after middleware has attached deployment
  const authenticatedReq = req as AuthenticatedRequest;
  const params = req.params as unknown as CompletionParams;
  const body = req.body as CreateCompletionRequest;

  const { deployment_id } = params;
  const { prompt } = body;
  const { deployment } = authenticatedReq;

  // Get API key from Authorization header for usage tracking
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.split(' ')[1] ?? '';

  // Validate prompt
  if (typeof prompt !== 'string') {
    throw createApiError(400, 'Prompt must be a string', 'VALIDATION_ERROR', {
      field: 'prompt',
      expected: 'string',
    });
  }

  if (prompt.trim().length === 0) {
    throw createApiError(400, 'Prompt cannot be empty', 'VALIDATION_ERROR', {
      field: 'prompt',
    });
  }

  // Verify deployment_id in URL matches the authenticated deployment
  if (deployment.deployment_id !== deployment_id) {
    throw createApiError(
      403,
      'API key does not belong to this deployment',
      'FORBIDDEN',
      {
        requested_deployment: deployment_id,
        api_key_deployment: deployment.deployment_id,
      }
    );
  }

  // Create completion
  const result = createCompletion(prompt);

  // Create usage event (only for successful completions)
  await createUsageEvent({
    api_key: apiKey,
    deployment_id: deployment.deployment_id,
    model: deployment.model,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
  });

  res.status(200).json(result);
}
