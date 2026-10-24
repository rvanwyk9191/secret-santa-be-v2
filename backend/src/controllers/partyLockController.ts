// src/controllers/partyLockController.ts
// POST /api/parties/:party_id/lock

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { lockParty } from '../services/partyLockService';
import { Logger } from '../utils/logger';
import { getCallerEmail } from '../utils/requestHelpers';

const partyLockRouter = Router();

/**
 * POST /api/parties/:party_id/lock
 * Locks the party so no further membership changes or gift updates can occur.
 * Requires a valid access_token cookie (checkJwt middleware applied in index.ts).
 * Only the party administrator may lock the party.
 * Publishes a party_locked SNS event on success.
 */
partyLockRouter.post(
  '/parties/:party_id/lock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id } = req.params as { party_id: string };

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      const party = await lockParty(party_id, callerEmail);

      Logger.info(`partyLockController: party '${party_id}' locked by '${callerEmail}'`);
      res.status(200).json(party);
    } catch (err) {
      Logger.error(
        'Error in POST /api/parties/:party_id/lock',
        err instanceof Error ? err.message : String(err)
      );
      next(err);
    }
  }
);

export default partyLockRouter;
