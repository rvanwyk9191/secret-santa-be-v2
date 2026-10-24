// backend/src/controllers/partyDeleteController.ts
// DELETE /api/parties/:party_id

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GetCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { serviceError } from '../utils/serviceError.js';
import { Logger } from '../utils/logger.js';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';

const partyDeleteRouter = Router();

/**
 * DELETE /api/parties/:party_id
 * Permanently deletes the party and all its members. Admin only.
 */
partyDeleteRouter.delete(
  '/parties/:party_id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { party_id } = req.params as { party_id: string };

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
        Logger.error(`partyDeleteController: GetCommand failed for '${party_id}'`, err instanceof Error ? err.message : String(err));
        throw err;
      }

      if (!party) throw serviceError('Party not found.', 404);
      if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
        throw serviceError('Forbidden: only the party administrator can delete the party.', 403);
      }

      // Delete all party members first (query by party_id GSI or scan)
      try {
        const membersResult = await dynamoClient.send(
          new QueryCommand({
            TableName: PARTY_MEMBERS_TABLE,
            IndexName: 'party_id-index',
            KeyConditionExpression: 'party_id = :pid',
            ExpressionAttributeValues: { ':pid': party_id },
          })
        );
        const members = membersResult.Items ?? [];
        await Promise.all(
          members.map((m) =>
            dynamoClient.send(
              new DeleteCommand({
                TableName: PARTY_MEMBERS_TABLE,
                Key: { email: m['email'], party_id },
              })
            )
          )
        );
      } catch (err) {
        Logger.warn(`partyDeleteController: failed to clean up members for party '${party_id}'`, err instanceof Error ? err.message : String(err));
        // Non-fatal — proceed to delete the party itself
      }

      // Delete the party record
      try {
        await dynamoClient.send(
          new DeleteCommand({ TableName: PARTIES_TABLE, Key: { party_id } })
        );
      } catch (err) {
        Logger.error(`partyDeleteController: DeleteCommand failed for '${party_id}'`, err instanceof Error ? err.message : String(err));
        throw err;
      }

      Logger.info(`partyDeleteController: deleted party '${party_id}'`);
      res.status(204).send();
    } catch (err) {
      Logger.error('Error in DELETE /api/parties/:party_id', err instanceof Error ? err.message : String(err));
      next(err);
    }
  }
);

export default partyDeleteRouter;
