// src/controllers/giftController.ts
// POST /api/parties/:party_id/members/:member_id/gifts

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { saveGiftBlob } from '../services/giftService';
import { Logger } from '../utils/logger';
import { getCallerEmail, assertSelfAuthorized } from '../utils/requestHelpers';

const giftRouter = Router();

/**
 * POST /api/parties/:party_id/members/:member_id/gifts
 * Saves a gift blob for the authenticated member.
 * :member_id is the URL-encoded email address of the member.
 * Requires a valid access_token cookie (checkJwt middleware applied in index.ts).
 * Requires the party to have customizationEnabled = true.
 */
giftRouter.post(
  '/parties/:party_id/members/:member_id/gifts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };
      const { giftBlob } = req.body as { giftBlob?: string };

      // member_id is the email (URL-encoded) — decode it
      const memberEmail = decodeURIComponent(member_id).toLowerCase();

      // Validate the caller is the member they are posting for
      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      if (!assertSelfAuthorized(callerEmail, memberEmail, res, 'Forbidden: you may only submit your own gift details.')) return;

      if (!giftBlob || typeof giftBlob !== 'string' || giftBlob.trim().length === 0) {
        res.status(400).json({ error: { message: 'giftBlob is required and must be a non-empty string.' } });
        return;
      }

      const result = await saveGiftBlob(party_id, memberEmail, giftBlob.trim());

      Logger.info(`giftController: gift blob saved for member='${memberEmail}' party='${party_id}'`);
      res.status(201).json(result);
    } catch (err) {
      Logger.error(
        'Error in POST /api/parties/:party_id/members/:member_id/gifts',
        err instanceof Error ? err.message : String(err)
      );
      next(err);
    }
  }
);

export default giftRouter;
