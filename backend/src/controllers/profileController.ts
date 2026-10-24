// src/controllers/profileController.ts
// GET  /api/parties/:party_id/members/:member_id/profile
// PUT  /api/parties/:party_id/members/:member_id/profile

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getProfile, updateProfile } from '../services/profileService';
import { Logger } from '../utils/logger';
import { getCallerEmail, assertSelfAuthorized } from '../utils/requestHelpers';

const profileRouter = Router();

/**
 * GET /api/parties/:party_id/members/:member_id/profile
 * Returns the full PartyMember record (including gift_blob if set) for the authenticated member.
 * :member_id is the URL-encoded email address of the member.
 * Enforces Member Self-Authorization: caller email MUST match member_id (constitution v1.15).
 */
profileRouter.get(
  '/parties/:party_id/members/:member_id/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };

      const memberEmail = decodeURIComponent(member_id).toLowerCase();

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      if (!assertSelfAuthorized(callerEmail, memberEmail, res, 'Forbidden: you may only view your own profile.')) return;

      const member = await getProfile(party_id, memberEmail);

      Logger.info(`profileController: profile retrieved for member='${memberEmail}' party='${party_id}'`);
      res.status(200).json(member);
    } catch (err) {
      Logger.error(
        'Error in GET /api/parties/:party_id/members/:member_id/profile',
        err instanceof Error ? err.message : String(err)
      );
      next(err);
    }
  }
);

/**
 * PUT /api/parties/:party_id/members/:member_id/profile
 * Updates blank first_name and/or last_name for the authenticated member.
 * :member_id is the URL-encoded email address of the member.
 * Requires a valid access_token cookie (checkJwt middleware applied in index.ts).
 * Only blank fields are updated — existing non-blank values are never overwritten.
 */
profileRouter.put(
  '/parties/:party_id/members/:member_id/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };
      const { firstName, lastName } = req.body as { firstName?: string; lastName?: string };

      // member_id is the email (URL-encoded) — decode it
      const memberEmail = decodeURIComponent(member_id).toLowerCase();

      // Validate the caller is the member they are updating
      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      if (!assertSelfAuthorized(callerEmail, memberEmail, res, 'Forbidden: you may only update your own profile.')) return;

      if (firstName === undefined && lastName === undefined) {
        res.status(400).json({ error: { message: 'At least one of firstName or lastName is required.' } });
        return;
      }

      const fields: { firstName?: string; lastName?: string } = {};
      if (firstName !== undefined) fields.firstName = firstName;
      if (lastName !== undefined) fields.lastName = lastName;

      const member = await updateProfile(party_id, memberEmail, fields);

      Logger.info(`profileController: profile updated for member='${memberEmail}' party='${party_id}'`);
      res.status(200).json(member);
    } catch (err) {
      Logger.error(
        'Error in PUT /api/parties/:party_id/members/:member_id/profile',
        err instanceof Error ? err.message : String(err)
      );
      next(err);
    }
  }
);

export default profileRouter;
