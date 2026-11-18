// backend/src/controllers/meController.ts
// GET /api/me/parties
// GET /api/me/hosted-parties

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getMyParties, getMyHostedParties } from '../services/meService.js';
import { completeAccountProfile, getAccountProfile } from '../services/accountProfileService.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { Logger } from '../utils/logger.js';
import { serviceError } from '../utils/serviceError.js';

const meRouter = Router();

meRouter.get('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = getCallerEmail(req, res);
    if (!email) return;
    const profile = await getAccountProfile(email);
    Logger.info('meController: resolved caller profile');
    res.set('Cache-Control', 'no-store').json(profile);
  } catch (error) {
    next(error);
  }
});

meRouter.put('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = getCallerEmail(req, res);
    if (!email) return;
    const browserOrigin = new URL(process.env['BASE_URL'] ?? 'https://localhost:3000').origin;
    if (req.get('Origin') !== browserOrigin) throw serviceError('Profile saves must come from the site origin.', 403);
    if (!req.is('application/json')) throw serviceError('Profile saves require application/json.', 415);

    const body: unknown = req.body;
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 2 ||
        !('firstName' in body) || !('lastName' in body) ||
        typeof body.firstName !== 'string' || typeof body.lastName !== 'string' ||
        !body.firstName.trim() || !body.lastName.trim()) {
      throw serviceError('Provide only nonblank firstName and lastName fields.', 400);
    }

    const profile = await completeAccountProfile(email, body.firstName, body.lastName);
    Logger.info('meController: completed caller profile');
    res.set('Cache-Control', 'no-store').json(profile);
  } catch (error) {
    next(error);
  }
});

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
