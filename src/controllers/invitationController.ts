import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createInvitation } from '../services/invitationService';
import { Logger } from '../utils/logger';

const invitationRouter = Router();

/**
 * POST /api/parties/:party_id/invitations
 * Sends an invitation to a participant. Requires Auth0 JWT (admin email from token).
 */
invitationRouter.post('/parties/:party_id/invitations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { party_id } = req.params;
    const { email } = req.body as { email?: string };

    if (!party_id || typeof party_id !== 'string' || party_id.trim().length === 0) {
      res.status(400).json({ error: { message: 'party_id is required.' } });
      return;
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: { message: 'A valid email address is required.' } });
      return;
    }

    // Extract admin_email from the Auth0 custom claim set by the Post-Login Action.
    // The bare 'email' claim is not present in access tokens — use 'registered_user_email'.
    const adminEmail = (req as any).auth?.payload?.['registered_user_email'] as string | undefined;
    if (!adminEmail) {
      res.status(401).json({ error: { message: 'Unauthorized: missing email claim in token.' } });
      return;
    }

    const invitation = await createInvitation(party_id.trim(), email.trim().toLowerCase(), adminEmail);

    Logger.info(`Invitation sent to ${email} for party ${party_id} by admin ${adminEmail}`);
    res.status(201).json({
      token: invitation.token,
      party_id: invitation.party_id,
      email: invitation.email,
      status: invitation.status,
      sent_at: invitation.sent_at,
    });
  } catch (err) {
    next(err);
  }
});

export default invitationRouter;
