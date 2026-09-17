import { Router } from 'express';
import type { RequestHandler } from 'express';
import { handleCompletion } from './completion.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { rateLimiter } from '../../middleware/rate-limit.middleware.js';

const router: Router = Router();

// POST /v1/:deployment_id/completions - Create a completion
// Rate limiter runs before auth to reject early
router.post(
  '/:deployment_id/completions',
  rateLimiter as RequestHandler,
  requireAuth as RequestHandler,
  handleCompletion as RequestHandler
);

export default router;
