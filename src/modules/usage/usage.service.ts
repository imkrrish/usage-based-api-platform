import type { IUsageEvent, UsageGroupItem, UsageResponse } from '../../types/usage.js';
import {
  calculateInputCost,
  calculateOutputCost,
  calculateTotalCost,
} from '../../types/usage.js';
import { UsageEvent } from './usage.model.js';
import type { PipelineStage } from 'mongoose';

// Input for creating a usage event
export interface CreateUsageEventInput {
  api_key: string;
  deployment_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Creates a usage event record
 */
export async function createUsageEvent(input: CreateUsageEventInput): Promise<IUsageEvent> {
  const usageEvent = await UsageEvent.create({
    api_key: input.api_key,
    deployment_id: input.deployment_id,
    model: input.model,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    timestamp: new Date(),
  });

  return usageEvent.toObject();
}

/**
 * Aggregates usage events by day
 * Uses MongoDB aggregation pipeline
 */
export async function aggregateUsageByDay(
  apiKey: string,
  fromDate: Date,
  toDate: Date
): Promise<UsageGroupItem[]> {
  // MongoDB aggregation pipeline
  // Groups by UTC date (YYYY-MM-DD format)
  const pipeline: PipelineStage[] = [
    {
      $match: {
        api_key: apiKey,
        timestamp: {
          $gte: fromDate,
          $lte: toDate,
        },
      },
    },
    {
      $addFields: {
        // Extract UTC date as YYYY-MM-DD string
        utcDate: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$timestamp',
            timezone: 'UTC',
          },
        },
      },
    },
    {
      $group: {
        _id: '$utcDate',
        input_tokens: { $sum: '$input_tokens' },
        output_tokens: { $sum: '$output_tokens' },
      },
    },
    {
      $sort: { _id: 1 }, // Sort by date ascending
    },
  ];

  const results = await UsageEvent.aggregate<
    { _id: string; input_tokens: number; output_tokens: number }
  >(pipeline);

  return results.map((item) => ({
    key: item._id,
    input_tokens: item.input_tokens,
    output_tokens: item.output_tokens,
    total_tokens: item.input_tokens + item.output_tokens,
    input_cost: calculateInputCost(item.input_tokens),
    output_cost: calculateOutputCost(item.output_tokens),
    total_cost: calculateTotalCost(item.input_tokens, item.output_tokens),
  }));
}

/**
 * Aggregates usage events by model
 * Uses MongoDB aggregation pipeline
 */
export async function aggregateUsageByModel(
  apiKey: string,
  fromDate: Date,
  toDate: Date
): Promise<UsageGroupItem[]> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        api_key: apiKey,
        timestamp: {
          $gte: fromDate,
          $lte: toDate,
        },
      },
    },
    {
      $group: {
        _id: '$model',
        input_tokens: { $sum: '$input_tokens' },
        output_tokens: { $sum: '$output_tokens' },
      },
    },
    {
      $sort: { _id: 1 }, // Sort by model name ascending
    },
  ];

  const results = await UsageEvent.aggregate<
    { _id: string; input_tokens: number; output_tokens: number }
  >(pipeline);

  return results.map((item) => ({
    key: item._id,
    input_tokens: item.input_tokens,
    output_tokens: item.output_tokens,
    total_tokens: item.input_tokens + item.output_tokens,
    input_cost: calculateInputCost(item.input_tokens),
    output_cost: calculateOutputCost(item.output_tokens),
    total_cost: calculateTotalCost(item.input_tokens, item.output_tokens),
  }));
}

/**
 * Gets usage data for an API key with grouping
 */
export async function getUsage(
  apiKey: string,
  fromDate: Date,
  toDate: Date,
  groupBy: 'day' | 'model'
): Promise<UsageResponse> {
  // Get aggregated breakdown
  const breakdown =
    groupBy === 'day'
      ? await aggregateUsageByDay(apiKey, fromDate, toDate)
      : await aggregateUsageByModel(apiKey, fromDate, toDate);

  // Calculate totals from breakdown (avoids extra query)
  const totalInputTokens = breakdown.reduce((sum, item) => sum + item.input_tokens, 0);
  const totalOutputTokens = breakdown.reduce((sum, item) => sum + item.output_tokens, 0);

  return {
    api_key: apiKey,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    group_by: groupBy,
    totals: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
      input_cost: calculateInputCost(totalInputTokens),
      output_cost: calculateOutputCost(totalOutputTokens),
      total_cost: calculateTotalCost(totalInputTokens, totalOutputTokens),
    },
    breakdown,
  };
}
