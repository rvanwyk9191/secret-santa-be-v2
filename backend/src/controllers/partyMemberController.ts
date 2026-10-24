// backend/src/controllers/partyMemberController.ts
// DELETE /api/parties/:party_id/members/:member_id

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { serviceError } from '../utils/serviceError.js';
import { Logger } from '../utils/logger.js';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';

const partyMemberRouter = Router();

/**
 * DELETE /api/parties/:party_id/members/:member_id
 * Removes an accepted member from the party. Admin only.
 * member_id is the URL-encoded email of the member to remove.
 */
partyMemberRouter.delete(
  '/parties/:party_id/members/:member_id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id, member_id } = req.params as { party_id: string; member_id: string };
      const memberEmail = decodeURIComponent(member_id).toLowerCase();

      const callerEmail = getCallerEmail(req, res);
      if (!callerEmail) return;

      // Verify caller is the party admin
      let party: Party | undefined;
      try {
        const result = await dynamoClient.send(
          new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id } })
        );
        party = result.Item as Party | undefined;
      } catch (err) {
        Logger.error(`partyMemberController: GetCommand failed for '${party_id}'`, err instanceof Error ? err.message : String(err));
        throw err;
      }

      if (!party) throw serviceError('Party not found.', 404);
      if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
        throw serviceError('Forbidden: only the party administrator can remove members.', 403);
      }

      try {
        await dynamoClient.send(
          new DeleteCommand({
            TableName: PARTY_MEMBERS_TABLE,
            Key: { email: memberEmail, party_id },
          })
        );
      } catch (err) {
        Logger.error(`partyMemberController: DeleteCommand failed for email='${memberEmail}' party='${party_id}'`, err instanceof Error ? err.message : String(err));
        throw err;
      }

      Logger.info(`partyMemberController: removed member '${memberEmail}' from party '${party_id}'`);
      res.status(204).send();
    } catch (err) {
      Logger.error('Error in DELETE /api/parties/:party_id/members/:member_id', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

export default partyMemberRouter;
