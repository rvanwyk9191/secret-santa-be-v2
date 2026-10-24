// src/controllers/assignmentController.ts
// POST /api/parties/:party_id/assignments

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAssignments } from '../services/assignmentService';
import { Logger } from '../utils/logger';
import { getCallerEmail } from '../utils/requestHelpers';

const assignmentRouter = Router();

/**
 * POST /api/parties/:party_id/assignments
 * Generates or saves giver/recipient assignment pairs for the party.
 * Requires a valid access_token cookie (checkJwt middleware applied in index.ts).
 * Only the party administrator may trigger assignments.
 * The party must be locked before assignments can be created.
 *
 * Body (automatic):  { mode: 'automatic' }
 * Body (manual):     { mode: 'manual', assignments: [{ giverEmail, recipientEmail }] }
 */
assignmentRouter.post(
  '/parties/:party_id/assignments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id } = req.params as { party_id: string };
      const { mode, assignments: manualPairs } = req.body as {
        mode?: string;
        assignments?: Array<{ giverEmail: string; recipientEmail: string }>;
      };

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      if (mode !== 'automatic' && mode !== 'manual') {
        res.status(400).json({ error: { message: "mode must be 'automatic' or 'manual'." } });
        return;
      }

      const result = await createAssignments(
        party_id,
        callerEmail,
        mode,
        mode === 'manual' ? manualPairs : undefined
      );

      Logger.info(
        `assignmentController: ${result.length} assignments created for party '${party_id}' by '${callerEmail}'`
      );
      res.status(201).json(result);
    } catch (err) {
      Logger.error(
        'Error in POST /api/parties/:party_id/assignments',
        err instanceof Error ? err.message : String(err)
      );
      next(err);
    }
  }
);

export default assignmentRouter;
