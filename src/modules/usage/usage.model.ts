import mongoose, { Schema } from 'mongoose';
import type { IUsageEvent } from '../../types/usage.js';

// Schema definition
const usageEventSchema = new Schema<IUsageEvent>(
  {
    api_key: {
      type: String,
      required: true,
      index: true,
    },
    deployment_id: {
      type: String,
      required: true,
      index: true,
    },
    model: {
      type: String,
      required: true,
      enum: ['model-a', 'model-b'] as const,
    },
    input_tokens: {
      type: Number,
      required: true,
    },
    output_tokens: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for querying by deployment_id and timestamp (common query pattern)
usageEventSchema.index({ deployment_id: 1, timestamp: -1 });

// Compound index for querying by api_key and timestamp (for rate limit lookups)
usageEventSchema.index({ api_key: 1, timestamp: -1 });

// Create and export the model
export const UsageEvent = mongoose.model<IUsageEvent>('UsageEvent', usageEventSchema);
