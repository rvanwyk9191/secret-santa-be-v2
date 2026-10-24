// backend/src/controllers/partyEmailController.ts
// POST /api/parties/:party_id/email-matches
// POST /api/parties/:party_id/members/:member_id/email-match

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import type { Assignment } from '../models/assignment.js';
import type { PartyMember } from '../models/partyMember.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { serviceError } from '../utils/serviceError.js';
import { publishNotification } from '../services/notificationService.js';
import { Logger } from '../utils/logger.js';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';
const ASSIGNMENTS_TABLE = 'Assignments';

const partyEmailRouter = Router();

async function getVerifiedParty(party_id: string, callerEmail: string): Promise<Party> {
  const result = await dynamoClient.send(
    new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id } })
  );
  const party = result.Item as Party | undefined;
  if (!party) throw serviceError('Party not found.', 404);
  if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
    throw serviceError('Forbidden: only the party administrator can send match emails.', 403);
  }
  if (!party.locked) throw serviceError('Party must be locked before sending match emails.', 422);
  return party;
}

/**
 * POST /api/parties/:party_id/email-matches
 * Publishes match notification events for all party members. Admin only.
 * Party must be locked and assigned.
 */
partyEmailRouter.post(
  '/parties/:party_id/email-matches',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id } = req.params as { party_id: string };
      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      const party = await getVerifiedParty(party_id, callerEmail);

      // Fetch all assignments
      const assignRes = await dynamoClient.send(
        new QueryCommand({
          TableName: ASSIGNMENTS_TABLE,
          KeyConditionExpression: 'party_id = :pid',
          ExpressionAttributeValues: { ':pid': party_id },
        })
      );
      const assignments = (assignRes.Items ?? []) as Assignment[];

      if (assignments.length === 0) {
        throw serviceError('Party has no assignments yet.', 422);
      }

      // Publish a notification event per assignment
      await Promise.all(
        assignments.map((a) =>
          publishNotification({
            type: 'assignment_completed',
            party_id,
            recipient_email: a.giver_email,
            data: {
              recipient_email: a.recipient_email,
              party_name: party.name,
            },
          }).catch((err) => {
            Logger.error(`partyEmailController: failed to publish for giver '${a.giver_email}'`, err instanceof Error ? err.message : String(err));
          })
        )
      );

      Logger.info(`partyEmailController: published ${assignments.length} match emails for party '${party_id}'`);
      res.status(200).json({ message: `Match emails queued for ${assignments.length} members.` });
    } catch (err) {
      Logger.error('Error in POST /api/parties/:party_id/email-matches', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

/**
 * POST /api/parties/:party_id/members/:member_id/email-match
 * Publishes a match notification for a single member. Admin only.
 */
partyEmailRouter.post(
  '/parties/:party_id/members/:member_id/email-match',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };
      const memberEmail = decodeURIComponent(member_id).toLowerCase();

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      const party = await getVerifiedParty(party_id, callerEmail);

      // Fetch this member's assignment
      const assignRes = await dynamoClient.send(
        new GetCommand({
          TableName: ASSIGNMENTS_TABLE,
          Key: { party_id, giver_email: memberEmail },
        })
      );
      const assignment = assignRes.Item as Assignment | undefined;

      if (!assignment) throw serviceError(`No assignment found for member '${memberEmail}'.`, 404);

      // Fetch member record to verify they exist
      const memberRes = await dynamoClient.send(
        new GetCommand({
          TableName: PARTY_MEMBERS_TABLE,
          Key: { email: memberEmail, party_id },
        })
      );
      if (!memberRes.Item) throw serviceError('Member not found.', 404);
      const member = memberRes.Item as PartyMember;

      await publishNotification({
        type: 'assignment_completed',
        party_id,
        recipient_email: member.email,
        data: {
          recipient_email: assignment.recipient_email,
          party_name: party.name,
        },
      });

      Logger.info(`partyEmailController: match email sent to '${memberEmail}' for party '${party_id}'`);
      res.status(200).json({ message: 'Match email queued.' });
    } catch (err) {
      Logger.error('Error in POST /api/parties/:party_id/members/:member_id/email-match', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

export default partyEmailRouter;
