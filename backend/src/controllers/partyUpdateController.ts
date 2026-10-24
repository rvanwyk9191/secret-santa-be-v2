// backend/src/controllers/partyUpdateController.ts
// PATCH /api/parties/:party_id  — update mutable party fields (admin only)

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import { dynamoClient } from '../utils/dynamodb.js';
import { getCallerEmail } from '../utils/requestHelpers.js';
import { serviceError } from '../utils/serviceError.js';
import { Logger } from '../utils/logger.js';

const PARTIES_TABLE = 'Parties';

const partyUpdateRouter = Router();

/**
 * PATCH /api/parties/:party_id
 * Updates mutable party fields. Only the party administrator may call this.
 * Accepted body fields: customizationEnabled, name, description.
 */
partyUpdateRouter.patch('/parties/:party_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { party_id } = req.params as { party_id: string };
    const { customizationEnabled, name, description } = req.body as {
      customizationEnabled?: boolean;
      name?: string;
      description?: string;
    };

    const callerEmail = getCallerEmail(req, res);
    if (!callerEmail) return;

    // Fetch party to verify admin
    let party: Party | undefined;
    try {
      const result = await dynamoClient.send(
        new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id } })
      );
      party = result.Item as Party | undefined;
    } catch (err) {
      Logger.error(`partyUpdateController: GetCommand failed for '${party_id}'`, err instanceof Error ? err.message : String(err));
      throw err;
    }

    if (!party) throw serviceError('Party not found.', 404);
    if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
      throw serviceError('Forbidden: only the party administrator can update the party.', 403);
    }

    const setClauses: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const now = new Date().toISOString();

    if (customizationEnabled !== undefined) {
      setClauses.push('#ce = :ce');
      names['#ce'] = 'customizationEnabled';
      values[':ce'] = customizationEnabled;
    }
    if (name !== undefined) {
      setClauses.push('#n = :n');
      names['#n'] = 'name';
      values[':n'] = name;
    }
    if (description !== undefined) {
      setClauses.push('#d = :d');
      names['#d'] = 'description';
      values[':d'] = description;
    }

    if (setClauses.length === 0) {
      res.status(200).json(party);
      return;
    }

    setClauses.push('updated_at = :ua');
    values[':ua'] = now;

    try {
      await dynamoClient.send(
        new UpdateCommand({
          TableName: PARTIES_TABLE,
          Key: { party_id },
          UpdateExpression: `SET ${setClauses.join(', ')}`,
          ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
          ExpressionAttributeValues: values,
        })
      );
    } catch (err) {
      Logger.error(`partyUpdateController: UpdateCommand failed for '${party_id}'`, err instanceof Error ? err.message : String(err));
      throw err;
    }

    const updated: Party = {
      ...party,
      ...(customizationEnabled !== undefined && { customizationEnabled }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      updated_at: now,
    };

    Logger.info(`partyUpdateController: party '${party_id}' updated by '${callerEmail}'`);
    res.status(200).json(updated);
  } catch (err) {
    Logger.error('Error in PATCH /api/parties/:party_id', err instanceof Error ? err.message : String(err));
    next(err);
  }
});

export default partyUpdateRouter;
