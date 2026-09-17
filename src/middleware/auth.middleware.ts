import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { authenticateWithApiKey } from '../modules/deployments/auth.service.js';
import { createApiError } from './error.middleware.js';

/**
 * Authentication middleware for completion endpoints
 * Validates Bearer token from Authorization header
 * Attaches deployment info to request if authenticated
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader) {
    throw createApiError(401, 'Missing Authorization header', 'UNAUTHORIZED');
  }

  // Parse Bearer token
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw createApiError(401, 'Invalid Authorization header format. Expected: Bearer <token>', 'UNAUTHORIZED');
  }

  const token = parts[1];

  if (!token || token.length === 0) {
    throw createApiError(401, 'Missing API key in Authorization header', 'UNAUTHORIZED');
  }

  // Authenticate with API key
  const result = await authenticateWithApiKey(token);

  if (!result.success) {
    if (result.error === 'INVALID_API_KEY') {
      throw createApiError(401, 'Invalid API key', 'UNAUTHORIZED');
    }

    if (result.error === 'DEPLOYMENT_NOT_READY') {
      throw createApiError(
        409,
        `Deployment is ${result.status ?? 'not ready'}. Only ready deployments can process requests.`,
        'DEPLOYMENT_NOT_READY'
      );
    }

    // Should never reach here, but TypeScript needs exhaustive check
    throw createApiError(500, 'Authentication failed', 'INTERNAL_ERROR');
  }

  // Attach deployment info to request
  (req as AuthenticatedRequest).deployment = {
    deployment_id: result.deployment.deployment_id,
    status: result.deployment.status,
    model: result.deployment.model,
  };

  next();
}
