import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import type { IDeployment } from '../../types/deployment.js';

// Document interface extending Mongoose Document
export type DeploymentDocument = HydratedDocument<IDeployment>;

// Schema definition
const deploymentSchema = new Schema<IDeployment>(
  {
    deployment_id: {
      type: String,
      required: true,
      unique: true,
    },
    model: {
      type: String,
      required: true,
      enum: ['model-a', 'model-b'] as const,
    },
    status: {
      type: String,
      required: true,
      enum: ['provisioning', 'ready', 'terminated'] as const,
      default: 'provisioning',
    },
    api_key: {
      type: String,
      default: null,
    },
    endpoint_url: {
      type: String,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We manage timestamps manually
    versionKey: false,
  }
);

// Pre-save middleware to update the updated_at field
deploymentSchema.pre('save', function (this: DeploymentDocument) {
  this.updated_at = new Date();
});

// Create and export the model
export const Deployment = mongoose.model<IDeployment>('Deployment', deploymentSchema);
