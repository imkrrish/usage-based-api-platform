import { Router } from 'express';
import {
  createDeployment,
  getDeployment,
  deleteDeployment,
} from './deployment.controller.js';

const router: Router = Router();

// POST /deployments - Create a new deployment
router.post('/', createDeployment);

// GET /deployments/:id - Get deployment status
router.get('/:id', getDeployment);

// DELETE /deployments/:id - Terminate a deployment
router.delete('/:id', deleteDeployment);

export default router;
