import type { DeploymentAuthInfo } from './deployment.service.js';
import { getDeploymentByApiKey } from './deployment.service.js';
import type { DeploymentStatus } from '../../types/deployment.js';

// Result of authentication attempt
export type AuthResult =
  | { success: true; deployment: DeploymentAuthInfo }
  | { success: false; error: 'INVALID_API_KEY' | 'DEPLOYMENT_NOT_READY'; status?: DeploymentStatus };

/**
 * Authenticates a request using the API key
 * Returns the deployment info if authentication succeeds
 */
export async function authenticateWithApiKey(apiKey: string): Promise<AuthResult> {
  // Find deployment by API key
  const deployment = await getDeploymentByApiKey(apiKey);

  if (!deployment) {
    return { success: false, error: 'INVALID_API_KEY' };
  }

  // Check deployment status
  if (deployment.status !== 'ready') {
    return {
      success: false,
      error: 'DEPLOYMENT_NOT_READY',
      status: deployment.status
    };
  }

  return { success: true, deployment };
}
