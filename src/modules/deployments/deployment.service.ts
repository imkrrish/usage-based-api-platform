import type { ModelType, DeploymentStatus } from '../../types/deployment.js';
import { Deployment } from './deployment.model.js';
import { generateApiKey, generateDeploymentId } from '../../utils/api-key.js';

// Service return type for created deployment
export interface CreatedDeployment {
  deployment_id: string;
  status: DeploymentStatus;
}

// Service return type for fetched deployment
export interface FetchedDeployment {
  deployment_id: string;
  status: DeploymentStatus;
  model: ModelType;
  endpoint_url: string | null;
  api_key: string | null;
  created_at: Date;
  updated_at: Date;
}

// Deployment info for authentication (minimal fields)
export interface DeploymentAuthInfo {
  deployment_id: string;
  status: DeploymentStatus;
  model: ModelType;
  api_key: string | null;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  provisioning: ['ready', 'terminated'],
  ready: ['terminated'],
  terminated: [],
};

// Configurable provisioning delay (milliseconds)
// Tests can set this to a small value for fast execution
let provisioningDelayMs = 10000;

/**
 * Sets the provisioning delay (for testing)
 */
export function setProvisioningDelay(ms: number): void {
  provisioningDelayMs = ms;
}

/**
 * Gets the current provisioning delay
 */
export function getProvisioningDelay(): number {
  return provisioningDelayMs;
}

/**
 * Creates a new deployment and starts async provisioning
 */
export async function createDeployment(model: ModelType): Promise<CreatedDeployment> {
  const deploymentId = generateDeploymentId();
  const apiKey = generateApiKey();
  const endpointUrl = `https://api.example.com/v1/${deploymentId}`;

  // Create deployment in provisioning state
  const deployment = await Deployment.create({
    deployment_id: deploymentId,
    model,
    status: 'provisioning',
    api_key: null, // Not available during provisioning
    endpoint_url: null, // Not available during provisioning
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Start async provisioning (10 second delay)
  void provisionDeployment(deployment.deployment_id, apiKey, endpointUrl);

  return {
    deployment_id: deployment.deployment_id,
    status: deployment.status,
  };
}

/**
 * Asynchronously provisions a deployment after configured delay
 * Sets status to ready and makes endpoint_url and api_key available
 */
async function provisionDeployment(
  deploymentId: string,
  apiKey: string,
  endpointUrl: string
): Promise<void> {
  // Wait for the configured delay
  await new Promise((resolve) => setTimeout(resolve, provisioningDelayMs));

  try {
    // Update deployment to ready state with api_key and endpoint_url
    await Deployment.findOneAndUpdate(
      { deployment_id: deploymentId, status: 'provisioning' },
      {
        status: 'ready',
        api_key: apiKey,
        endpoint_url: endpointUrl,
        updated_at: new Date(),
      }
    );
  } catch (error) {
    console.error(`Failed to provision deployment ${deploymentId}:`, error);
  }
}

/**
 * Gets a deployment by ID
 */
export async function getDeploymentById(deploymentId: string): Promise<FetchedDeployment | null> {
  const deployment = await Deployment.findOne({ deployment_id: deploymentId }).lean();

  if (!deployment) {
    return null;
  }

  return {
    deployment_id: deployment.deployment_id,
    status: deployment.status,
    model: deployment.model,
    endpoint_url: deployment.endpoint_url,
    api_key: deployment.api_key,
    created_at: deployment.created_at,
    updated_at: deployment.updated_at,
  };
}

/**
 * Gets deployment by API key (for authentication)
 * Returns minimal info needed for auth checks
 */
export async function getDeploymentByApiKey(apiKey: string): Promise<DeploymentAuthInfo | null> {
  const deployment = await Deployment.findOne({ api_key: apiKey })
    .select('deployment_id status model api_key')
    .lean();

  if (!deployment) {
    return null;
  }

  return {
    deployment_id: deployment.deployment_id,
    status: deployment.status,
    model: deployment.model,
    api_key: deployment.api_key,
  };
}

export type TerminateResult =
  | { success: true; deployment: FetchedDeployment }
  | { success: false; error: 'NOT_FOUND' }
  | { success: false; error: 'INVALID_STATE_TRANSITION'; current_status: DeploymentStatus };

/**
 * Terminates a deployment (soft delete)
 */
export async function terminateDeployment(deploymentId: string): Promise<TerminateResult> {
  const deployment = await Deployment.findOne({ deployment_id: deploymentId });

  if (!deployment) {
    return { success: false, error: 'NOT_FOUND' };
  }

  if (!VALID_TRANSITIONS[deployment.status].includes('terminated')) {
    return {
      success: false,
      error: 'INVALID_STATE_TRANSITION',
      current_status: deployment.status,
    };
  }

  deployment.status = 'terminated';
  await deployment.save();

  return {
    success: true,
    deployment: {
      deployment_id: deployment.deployment_id,
      status: deployment.status,
      model: deployment.model,
      endpoint_url: deployment.endpoint_url,
      api_key: deployment.api_key,
      created_at: deployment.created_at,
      updated_at: deployment.updated_at,
    },
  };
}

/**
 * Checks if a state transition is valid
 */
export function isValidStateTransition(
  currentStatus: DeploymentStatus,
  targetStatus: DeploymentStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(targetStatus);
}
