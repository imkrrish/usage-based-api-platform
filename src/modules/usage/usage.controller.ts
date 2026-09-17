import type { Request, Response, NextFunction } from 'express';
import type { UsageResponse } from '../../types/usage.js';
import { getUsage } from './usage.service.js';
import { createApiError } from '../../middleware/error.middleware.js';

/**
 * Validates ISO date string format (YYYY-MM-DD or full ISO format)
 */
function isValidIsoDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * GET /usage
 * Returns usage data for an API key with grouping options
 */
export async function getUsageHandler(
  req: Request,
  res: Response<UsageResponse>,
  _next: NextFunction
): Promise<void> {
  const api_key = req.query.api_key;
  const from = req.query.from;
  const to = req.query.to;
  const group_by = req.query.group_by;

  // Validate api_key
  if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
    throw createApiError(400, 'api_key is required', 'VALIDATION_ERROR', {
      field: 'api_key',
    });
  }

  // Validate from
  if (!from || typeof from !== 'string' || from.trim().length === 0) {
    throw createApiError(400, 'from is required', 'VALIDATION_ERROR', {
      field: 'from',
    });
  }

  if (!isValidIsoDate(from)) {
    throw createApiError(400, 'from must be a valid ISO date', 'VALIDATION_ERROR', {
      field: 'from',
      provided: from,
    });
  }

  // Validate to
  if (!to || typeof to !== 'string' || to.trim().length === 0) {
    throw createApiError(400, 'to is required', 'VALIDATION_ERROR', {
      field: 'to',
    });
  }

  if (!isValidIsoDate(to)) {
    throw createApiError(400, 'to must be a valid ISO date', 'VALIDATION_ERROR', {
      field: 'to',
      provided: to,
    });
  }

  // Validate group_by
  if (!group_by || typeof group_by !== 'string') {
    throw createApiError(400, 'group_by is required', 'VALIDATION_ERROR', {
      field: 'group_by',
    });
  }

  if (group_by !== 'day' && group_by !== 'model') {
    throw createApiError(400, 'group_by must be either "day" or "model"', 'VALIDATION_ERROR', {
      field: 'group_by',
      allowed: ['day', 'model'],
      provided: group_by,
    });
  }

  // Parse dates
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Validate date range
  if (fromDate > toDate) {
    throw createApiError(400, 'from date must be before or equal to to date', 'VALIDATION_ERROR', {
      field: 'date_range',
      from: from,
      to: to,
    });
  }

  // Get usage data
  const result = await getUsage(api_key.trim(), fromDate, toDate, group_by);

  res.status(200).json(result);
}
