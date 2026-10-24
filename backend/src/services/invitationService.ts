import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Invitation } from '../models/invitation';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';

const INVITATIONS_TABLE = 'Invitations';

/**
 * Creates a new invitation for a participant and persists it to DynamoDB.
 * Email delivery is handled automatically by the event-driven emailer Lambda
 * triggered via DynamoDB Streams — the web app does not publish notifications directly.
 */
export async function createInvitation(
  partyId: string,
  email: string
): Promise<Invitation> {
  const now = new Date().toISOString();
  const invitation: Invitation = {
    party_id: partyId,
    email,
    token: uuidv4(),
    status: 'pending',
    sent_at: now,
  };

  Logger.info(`Creating invitation for ${email} in party ${partyId}`);

  try {
    await dynamoClient.send(new PutCommand({ TableName: INVITATIONS_TABLE, Item: invitation }));
  } catch (err) {
    Logger.error(`createInvitation: DynamoDB PutCommand failed for party '${partyId}' recipient '${email}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  return invitation;
}

/**
 * Fetches an invitation by party_id and email.
 */
export async function getInvitation(
  partyId: string,
  email: string
): Promise<Invitation | undefined> {
  Logger.info(`Fetching invitation for ${email} in party ${partyId}`);

  let result;
  try {
    result = await dynamoClient.send(
      new GetCommand({ TableName: INVITATIONS_TABLE, Key: { party_id: partyId, email } })
    );
  } catch (err) {
    Logger.error(`getInvitation: DynamoDB GetCommand failed for party '${partyId}' email '${email}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  return result.Item as Invitation | undefined;
}
