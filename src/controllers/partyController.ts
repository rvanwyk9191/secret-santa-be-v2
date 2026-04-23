import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createParty } from '../services/partyService';
import { Logger } from '../utils/logger';

const partyRouter = Router();

/**
 * POST /api/parties
 * Creates a new party. Requires Auth0 JWT (admin_email from token sub).
 */
partyRouter.post('/parties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, customizationEnabled } = req.body as {
      name?: string;
      description?: string;
      customizationEnabled?: boolean;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: { message: 'Party name is required.' } });
      return;
    }
    Logger.info('Req:', (req as any).auth);
    // Extract admin_email from the Auth0 custom claim set by the Post-Login Action.
    // The bare 'email' claim is not present in access tokens — use 'registered_user_email'.
    const adminEmail = (req as any).auth?.payload?.['registered_user_email'] as string | undefined;
    if (!adminEmail) {
      res.status(401).json({ error: { message: 'Unauthorized: missing email claim in token.' } });
      return;
    }

    const options: { description?: string; customizationEnabled?: boolean } = {};
    if (description !== undefined) options.description = description;
    if (customizationEnabled !== undefined) options.customizationEnabled = customizationEnabled;

    const party = await createParty(name.trim(), adminEmail, options);

    Logger.info(`Party created: ${party.party_id}`);
    res.status(201).json(party);
  } catch (err) {
    Logger.error('Error in POST /api/parties', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

export default partyRouter;
