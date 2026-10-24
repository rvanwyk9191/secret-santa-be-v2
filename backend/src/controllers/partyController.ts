import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createParty } from '../services/partyService';
import { Logger } from '../utils/logger';
import { getCallerEmail } from '../utils/requestHelpers';

const partyRouter = Router();

/**
 * POST /api/parties
 * Creates a new party. Requires Auth0 JWT (admin_email from token sub).
 */
partyRouter.post('/parties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, customizationEnabled, party_date } = req.body as {
      name?: string;
      description?: string;
      customizationEnabled?: boolean;
      party_date?: string;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: { message: 'Party name is required.' } });
      return;
    }
    // Constitution v1.14: read email from the validated access_token JWT payload.
    const adminEmail = getCallerEmail(req, res);
    if (!adminEmail) return;

    const options: { description?: string; customizationEnabled?: boolean; party_date?: string } = {};
    if (description !== undefined) options.description = description;
    if (customizationEnabled !== undefined) options.customizationEnabled = customizationEnabled;
    if (party_date !== undefined) options.party_date = party_date;

    const party = await createParty(name.trim(), adminEmail, options);

    Logger.info(`Party created: ${party.party_id}`);
    res.status(201).json(party);
  } catch (err) {
    Logger.error('Error in POST /api/parties', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

export default partyRouter;
