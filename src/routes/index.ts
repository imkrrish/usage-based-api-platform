import { Router } from 'express';
import deploymentRoutes from '../modules/deployments/deployment.routes.js';
import completionRoutes from '../modules/completions/completion.routes.js';
import usageRoutes from '../modules/usage/usage.routes.js';

export const router: Router = Router();

// Deployment routes
router.use('/deployments', deploymentRoutes);

// Completion routes (v1 API)
router.use('/v1', completionRoutes);

// Usage routes
router.use('/usage', usageRoutes);
