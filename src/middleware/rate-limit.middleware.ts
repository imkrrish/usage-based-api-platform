import type { Request, Response, NextFunction } from 'express';
import { createApiError } from './error.middleware.js';
import { checkRateLimit } from '../modules/rate-limit/rate-limit.service.js';

/**
 * Rate limiting middleware
 * Limits requests to 100 per minute per API key
 */
export async function rateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Get API key from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No auth header - let auth middleware handle this
    next();
    return;
  }

  // Parse Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    // Invalid format - let auth middleware handle this
    next();
    return;
  }

  const apiKey = parts[1];
  if (!apiKey || apiKey.length === 0) {
    // No token - let auth middleware handle this
    next();
    return;
  }

  // Check rate limit
  const result = checkRateLimit(apiKey);

  if (!result.allowed) {
    throw createApiError(
      429,
      'Rate limit exceeded. Maximum 100 requests per minute per API key.',
      'RATE_LIMIT_EXCEEDED',
      {
        retry_after: result.retryAfterSeconds,
        limit: 100,
        window_ms: 60000,
      }
    );
  }

  next();
}
