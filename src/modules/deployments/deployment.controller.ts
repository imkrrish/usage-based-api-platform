import type { Request, Response } from 'express';
import type {
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  GetDeploymentResponse,
  DeploymentParams,
} from '../../types/deployment.js';
import * as deploymentService from './deployment.service.js';
import { createApiError } from '../../middleware/error.middleware.js';

/**
 * POST /deployments
 * Creates a new deployment
 */
export async function createDeployment(
  req: Request<object, CreateDeploymentResponse, CreateDeploymentRequest>,
  res: Response<CreateDeploymentResponse>
): Promise<void> {
  const { model } = req.body;

  // Validate request body
  if (!model) {
    throw createApiError(400, 'Model is required', 'VALIDATION_ERROR', {
      field: 'model',
    });
  }

  if (model !== 'model-a' && model !== 'model-b') {
    throw createApiError(400, 'Invalid model. Must be "model-a" or "model-b"', 'VALIDATION_ERROR', {
      field: 'model',
      allowed: ['model-a', 'model-b'],
    });
  }

  const deployment = await deploymentService.createDeployment(model);

  res.status(201).json({
    deployment_id: deployment.deployment_id,
    status: deployment.status,
  });
}

/**
 * GET /deployments/:id
 * Returns the current deployment status
 */
export async function getDeployment(
  req: Request<DeploymentParams, GetDeploymentResponse>,
  res: Response<GetDeploymentResponse>
): Promise<void> {
  const { id } = req.params;

  if (!id) {
    throw createApiError(400, 'Deployment ID is required', 'VALIDATION_ERROR');
  }

  const deployment = await deploymentService.getDeploymentById(id);

  if (!deployment) {
    throw createApiError(404, 'Deployment not found', 'NOT_FOUND');
  }

  // Build response - only include endpoint_url and api_key when ready
  const response: GetDeploymentResponse = {
    deployment_id: deployment.deployment_id,
    status: deployment.status,
    model: deployment.model,
    created_at: deployment.created_at,
    updated_at: deployment.updated_at,
  };

  // Only expose endpoint_url and api_key when status is 'ready'
  if (deployment.status === 'ready') {
    if (deployment.endpoint_url !== null) {
      response.endpoint_url = deployment.endpoint_url;
    }
    if (deployment.api_key !== null) {
      response.api_key = deployment.api_key;
    }
  }

  res.status(200).json(response);
}

/**
 * DELETE /deployments/:id
 * Marks the deployment as terminated (soft delete)
 */
export async function deleteDeployment(
  req: Request<DeploymentParams>,
  res: Response
): Promise<void> {
  const { id } = req.params;

  if (!id) {
    throw createApiError(400, 'Deployment ID is required', 'VALIDATION_ERROR');
  }

  const result = await deploymentService.terminateDeployment(id);

  if (!result.success) {
    if (result.error === 'NOT_FOUND') {
      throw createApiError(404, 'Deployment not found', 'NOT_FOUND');
    }

    throw createApiError(409, 'Cannot terminate deployment from current state', 'INVALID_STATE_TRANSITION', {
      current_status: result.current_status,
    });
  }

  res.status(204).send();
}
