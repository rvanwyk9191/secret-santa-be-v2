import { v4 as uuidv4 } from 'uuid';
import type { Party } from '../models/party.js';
import { Logger } from '../utils/logger.js';

/**
 * Creates a new party in DynamoDB.
 */
export async function createParty(
  name: string,
  adminEmail: string,
  options?: { description?: string; customizationEnabled?: boolean }
): Promise<Party> {
  const now = new Date().toISOString();
  const party: Party = {
    party_id: uuidv4(),
    name,
    admin_email: adminEmail,
    ...(options?.description !== undefined ? { description: options.description } : {}),
    customizationEnabled: options?.customizationEnabled ?? false,
    locked: false,
    created_at: now,
    updated_at: now,
  };

  Logger.info(`Creating party: ${party.party_id} for admin: ${adminEmail}`);

  // TODO: persist to DynamoDB
  // await dynamoClient.put({ TableName: 'Parties', Item: party }).promise();

  return party;
}

/**
 * Fetches a party by party_id from DynamoDB.
 */
export async function getParty(partyId: string): Promise<Party | undefined> {
  Logger.info(`Fetching party: ${partyId}`);

  // TODO: fetch from DynamoDB
  // const result = await dynamoClient.get({ TableName: 'Parties', Key: { party_id: partyId } }).promise();
  // return result.Item as Party | undefined;

  return undefined;
}
