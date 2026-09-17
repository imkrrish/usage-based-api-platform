import { Router } from 'express';
import type { RequestHandler } from 'express';
import { handleCompletion } from './completion.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { rateLimiter } from '../../middleware/rate-limit.middleware.js';

const router: Router = Router();

// POST /v1/:deployment_id/completions - Create a completion
// Authenticate first so invalid API keys consistently return 401.
router.post(
  '/:deployment_id/completions',
  requireAuth as RequestHandler,
  rateLimiter as RequestHandler,
  handleCompletion as RequestHandler
);

export default router;
