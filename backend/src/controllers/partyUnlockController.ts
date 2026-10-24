// backend/src/controllers/partyUnlockController.ts
// POST /api/parties/:party_id/unlock

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { unlockParty } from '../services/partyLockService.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { Logger } from '../utils/logger.js';

const partyUnlockRouter = Router();

/**
 * POST /api/parties/:party_id/unlock
 * Unlocks a locked party. Only the party administrator may call this.
 */
partyUnlockRouter.post('/parties/:party_id/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { party_id } = req.params as { party_id: string };

    const callerEmail = getCallerEmail(req, res);
    if (!callerEmail) return;

    const party = await unlockParty(party_id, callerEmail);
    Logger.info(`partyUnlockController: party '${party_id}' unlocked by '${callerEmail}'`);
    res.status(200).json(party);
  } catch (err) {
    Logger.error('Error in POST /api/parties/:party_id/unlock', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

export default partyUnlockRouter;
