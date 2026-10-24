// backend/src/controllers/meController.ts
// GET /api/me/parties
// GET /api/me/hosted-parties

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getMyParties, getMyHostedParties } from '../services/meService.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { Logger } from '../utils/logger.js';

const meRouter = Router();

/**
 * GET /api/me/parties
 * Returns all parties the authenticated user is an accepted member of,
 * excluding parties they administer. Enriched with assignment info if present.
 */
meRouter.get('/me/parties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerEmail = getCallerEmail(req, res);
    if (!callerEmail) return;

    const entries = await getMyParties(callerEmail);
    Logger.info(`meController: getMyParties returned ${entries.length} entries for '${callerEmail}'`);
    res.status(200).json(entries);
  } catch (err) {
    Logger.error('Error in GET /api/me/parties', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

/**
 * GET /api/me/hosted-parties
 * Returns all parties the authenticated user is hosting (admin_email matches),
 * with full member lists and assignment status.
 */
meRouter.get('/me/hosted-parties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callerEmail = getCallerEmail(req, res);
    if (!callerEmail) return;

    const entries = await getMyHostedParties(callerEmail);
    Logger.info(`meController: getMyHostedParties returned ${entries.length} entries for '${callerEmail}'`);
    res.status(200).json(entries);
  } catch (err) {
    Logger.error('Error in GET /api/me/hosted-parties', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

export default meRouter;
