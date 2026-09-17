// Model types for deployment
export type ModelType = 'model-a' | 'model-b';

// Deployment status types
export type DeploymentStatus = 'provisioning' | 'ready' | 'terminated';

// Request body for creating a deployment
export interface CreateDeploymentRequest {
  model: ModelType;
}

// Response for creating a deployment
export interface CreateDeploymentResponse {
  deployment_id: string;
  status: DeploymentStatus;
}

// Response for getting a deployment (fields vary by status)
export interface GetDeploymentResponse {
  deployment_id: string;
  status: DeploymentStatus;
  model: ModelType;
  endpoint_url?: string;
  api_key?: string;
  created_at: Date;
  updated_at: Date;
}

// Route params for deployment operations
export interface DeploymentParams {
  id: string;
}

// Deployment document interface (for Mongoose)
export interface IDeployment {
  deployment_id: string;
  model: ModelType;
  status: DeploymentStatus;
  api_key: string | null;
  endpoint_url: string | null;
  created_at: Date;
  updated_at: Date;
}

// Valid state transitions map
export const VALID_STATE_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  provisioning: ['ready', 'terminated'],
  ready: ['terminated'],
  terminated: [], // No transitions allowed from terminated
};
