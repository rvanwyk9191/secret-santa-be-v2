// backend/src/controllers/pendingInvitesController.ts
// GET  /api/me/pending-invites                              — list caller's pending invitations
// POST /api/parties/:party_id/invitations/:token/accept     — accept an invitation (JWT-authenticated)
// POST /api/parties/:party_id/invitations/:token/decline    — decline an invitation (JWT-authenticated)

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  ScanCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Invitation } from '../models/invitation.js';
import type { Party } from '../models/party.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { serviceError } from '../utils/serviceError.js';
import { acceptInvitation } from '../services/registrationService.js';
import { Logger } from '../utils/logger.js';

const INVITATIONS_TABLE = 'Invitations';
const PARTIES_TABLE = 'Parties';

const pendingInvitesRouter = Router();

export interface PendingInvite {
  party_id: string;
  party_name: string;
  admin_email: string;
  party_date?: string;
  token: string;
  sent_at: string;
}

/**
 * GET /api/me/pending-invites
 * Returns all pending invitations for the authenticated user, enriched with party details.
 */
pendingInvitesRouter.get(
  '/me/pending-invites',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      // Scan Invitations for pending items belonging to this user
      let invitations: Invitation[] = [];
      try {
        const result = await dynamoClient.send(
          new ScanCommand({
            TableName: INVITATIONS_TABLE,
            FilterExpression: 'email = :email AND #s = :pending',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':email': callerEmail.toLowerCase(),
              ':pending': 'pending',
            },
          })
        );
        invitations = (result.Items ?? []) as Invitation[];
      } catch (err) {
        Logger.error('pendingInvitesController: ScanCommand failed', err instanceof Error ? err.message : String(err));
        throw err;
      }

      // Enrich each invitation with party details
      const pending: PendingInvite[] = await Promise.all(
        invitations.map(async (inv) => {
          try {
            const partyResult = await dynamoClient.send(
              new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: inv.party_id } })
            );
            const party = partyResult.Item as Party | undefined;
            return {
              party_id: inv.party_id,
              party_name: party?.name ?? inv.party_id,
              admin_email: party?.admin_email ?? '',
              party_date: party?.party_date,
              token: inv.token,
              sent_at: inv.sent_at,
            };
          } catch {
            // If party fetch fails, return with minimal info
            return {
              party_id: inv.party_id,
              party_name: inv.party_id,
              admin_email: '',
              token: inv.token,
              sent_at: inv.sent_at,
            };
          }
        })
      );

      res.json(pending);
    } catch (err) {
      Logger.error('Error in GET /api/me/pending-invites', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

/**
 * POST /api/parties/:party_id/invitations/:token/accept
 * Accepts the invitation for the authenticated user.
 * Reuses the acceptInvitation service (same logic as the unauthenticated GET flow).
 */
pendingInvitesRouter.post(
  '/parties/:party_id/invitations/:token/accept',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, token } = req.params as { party_id: string; token: string };

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      const member = await acceptInvitation(party_id.trim(), token.trim(), callerEmail);
      res.status(200).json(member);
    } catch (err) {
      Logger.error('Error in POST /api/parties/:party_id/invitations/:token/accept', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

/**
 * POST /api/parties/:party_id/invitations/:token/decline
 * Marks the invitation as 'declined' for the authenticated user.
 */
pendingInvitesRouter.post(
  '/parties/:party_id/invitations/:token/decline',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, token } = req.params as { party_id: string; token: string };

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      // Find the invitation by party_id + token
      let invitation: Invitation | undefined;
      try {
        const result = await dynamoClient.send(
          new QueryCommand({
            TableName: INVITATIONS_TABLE,
            KeyConditionExpression: 'party_id = :partyId',
            FilterExpression: '#token = :token',
            ExpressionAttributeNames: { '#token': 'token' },
            ExpressionAttributeValues: { ':partyId': party_id, ':token': token },
          })
        );
        invitation = result.Items?.[0] as Invitation | undefined;
      } catch (err) {
        Logger.error('pendingInvitesController: QueryCommand failed', err instanceof Error ? err.message : String(err));
        throw err;
      }

      if (!invitation) throw serviceError('Invitation not found.', 404);
      if (invitation.email.toLowerCase() !== callerEmail.toLowerCase()) {
        throw serviceError('Invitation does not belong to this user.', 403);
      }
      if (invitation.status !== 'pending') {
        throw serviceError(`Invitation is not pending (status: ${invitation.status}).`, 409);
      }

      // Mark as declined
      try {
        await dynamoClient.send(
          new UpdateCommand({
            TableName: INVITATIONS_TABLE,
            Key: { party_id, email: invitation.email },
            UpdateExpression: 'SET #s = :declined',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':declined': 'declined' },
          })
        );
      } catch (err) {
        Logger.error('pendingInvitesController: UpdateCommand failed', err instanceof Error ? err.message : String(err));
        throw err;
      }

      Logger.info(`pendingInvitesController: invitation declined for party '${party_id}' by '${callerEmail}'`);
      res.status(204).send();
    } catch (err) {
      Logger.error('Error in POST /api/parties/:party_id/invitations/:token/decline', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

export default pendingInvitesRouter;
