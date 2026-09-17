import type { Request } from 'express';
import type { DeploymentStatus, ModelType } from './deployment.js';

// Authenticated request with deployment info attached
export interface AuthenticatedRequest extends Request {
  deployment: {
    deployment_id: string;
    status: DeploymentStatus;
    model: ModelType;
  };
}

// Type guard to check if request is authenticated
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return 'deployment' in req && typeof req.deployment === 'object' && req.deployment !== null;
}
