// src/services/partyLockService.ts
// Party locking service — marks a party as locked and publishes an SNS event.

import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';
import { publishNotification } from './notificationService';
import { serviceError } from '../utils/serviceError';

const PARTIES_TABLE = 'Parties';

/**
 * Locks a party.
 * - Fetches the party; throws 404 if not found.
 * - Requires the caller to be the party admin; throws 403 otherwise.
 * - Throws 409 if the party is already locked.
 * - Sets `locked = true` and updates `updated_at`.
 * - Publishes a `party_locked` SNS event.
 *
 * @param partyId    - The party to lock
 * @param callerEmail - The authenticated user's email (must be the admin)
 * @returns The updated Party record
 */
export async function lockParty(partyId: string, callerEmail: string): Promise<Party> {
  Logger.info(`partyLockService: lockParty partyId='${partyId}' caller='${callerEmail}'`);

  // Fetch the party
  let party: Party | undefined;
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: partyId } })
    );
    party = result.Item as Party | undefined;
  } catch (err) {
    Logger.error(
      `partyLockService: DynamoDB GetCommand failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!party) {
    throw serviceError('Party not found.', 404);
  }

  if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
    throw serviceError('Forbidden: only the party administrator can lock the party.', 403);
  }

  if (party.locked) {
    throw serviceError('Party is already locked.', 409);
  }

  const now = new Date().toISOString();

  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: PARTIES_TABLE,
        Key: { party_id: partyId },
        UpdateExpression: 'SET locked = :locked, updated_at = :updatedAt',
        ExpressionAttributeValues: { ':locked': true, ':updatedAt': now },
      })
    );
  } catch (err) {
    Logger.error(
      `partyLockService: DynamoDB UpdateCommand failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  const updated: Party = { ...party, locked: true, updated_at: now };

  try {
    await publishNotification({
      type: 'party_locked',
      party_id: partyId,
      recipient_email: party.admin_email,
      data: { admin_email: party.admin_email },
    });
  } catch (err) {
    // SNS failure is logged but does not fail the lock operation
    Logger.error(
      `partyLockService: SNS notification failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
  }

  Logger.info(`partyLockService: party '${partyId}' locked successfully`);
  return updated;
}

/**
 * Unlocks a party.
 * - Fetches the party; throws 404 if not found.
 * - Requires the caller to be the party admin; throws 403 otherwise.
 * - Throws 409 if the party is already unlocked.
 * - Sets `locked = false` and updates `updated_at`.
 */
export async function unlockParty(partyId: string, callerEmail: string): Promise<Party> {
  Logger.info(`partyLockService: unlockParty partyId='${partyId}' caller='${callerEmail}'`);

  let party: Party | undefined;
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: partyId } })
    );
    party = result.Item as Party | undefined;
  } catch (err) {
    Logger.error(`partyLockService: DynamoDB GetCommand failed for partyId='${partyId}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  if (!party) throw serviceError('Party not found.', 404);
  if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
    throw serviceError('Forbidden: only the party administrator can unlock the party.', 403);
  }
  if (!party.locked) throw serviceError('Party is not locked.', 409);

  const now = new Date().toISOString();

  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: PARTIES_TABLE,
        Key: { party_id: partyId },
        UpdateExpression: 'SET locked = :locked, updated_at = :updatedAt',
        ExpressionAttributeValues: { ':locked': false, ':updatedAt': now },
      })
    );
  } catch (err) {
    Logger.error(`partyLockService: DynamoDB UpdateCommand (unlock) failed for partyId='${partyId}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  const updated: Party = { ...party, locked: false, updated_at: now };
  Logger.info(`partyLockService: party '${partyId}' unlocked successfully`);
  return updated;
}
