import { Router } from 'express';
import type { RequestHandler } from 'express';
import { getUsageHandler } from './usage.controller.js';

const router: Router = Router();

// GET /usage - Get usage data with grouping options
router.get('/', getUsageHandler as RequestHandler);

export default router;
