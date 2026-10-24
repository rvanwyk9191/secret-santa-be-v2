import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createInvitation } from '../services/invitationService';
import { Logger } from '../utils/logger';
import { getCallerEmail } from '../utils/requestHelpers';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { serviceError } from '../utils/serviceError.js';

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

    // Constitution v1.14: read email from the validated access_token JWT payload.
    const adminEmail = getCallerEmail(req, res);
    if (!adminEmail) return;

    const invitation = await createInvitation(party_id.trim(), email.trim().toLowerCase());

    Logger.info(`Invitation sent to ${email} for party ${party_id} by admin ${adminEmail}`);
    res.status(201).json({
      token: invitation.token,
      party_id: invitation.party_id,
      email: invitation.email,
      status: invitation.status,
      sent_at: invitation.sent_at,
    });
  } catch (err) {
    Logger.error('Error in POST /api/parties/:party_id/invitations', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

/**
 * DELETE /api/parties/:party_id/invitations/:member_id
 * Revokes a pending invitation. Admin only. member_id is URL-encoded email.
 */
invitationRouter.delete(
  '/parties/:party_id/invitations/:member_id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };
      const inviteeEmail = decodeURIComponent(member_id).toLowerCase();

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      // Verify caller is the party admin
      const partyResult = await dynamoClient.send(
        new GetCommand({ TableName: 'Parties', Key: { party_id } })
      );
      const party = partyResult.Item as Party | undefined;
      if (!party) throw serviceError('Party not found.', 404);
      if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
        throw serviceError('Forbidden: only the party administrator can revoke invitations.', 403);
      }

      // Mark invitation as revoked
      await dynamoClient.send(
        new UpdateCommand({
          TableName: 'Invitations',
          Key: { party_id, email: inviteeEmail },
          UpdateExpression: 'SET #s = :revoked',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':revoked': 'revoked' },
          ConditionExpression: 'attribute_exists(party_id)',
        })
      );

      Logger.info(`invitationController: revoked invitation party='${party_id}' email='${inviteeEmail}'`);
      res.status(204).send();
    } catch (err) {
      Logger.error('Error in DELETE /api/parties/:party_id/invitations/:member_id', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

export default invitationRouter;