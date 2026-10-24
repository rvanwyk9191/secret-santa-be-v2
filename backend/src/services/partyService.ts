import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import type { PartyMember } from '../models/partyMember.js';
import { Logger } from '../utils/logger.js';
import { dynamoClient } from '../utils/dynamodb.js';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';

/**
 * Generates an 8-character hex party_id (first segment of a UUID v4, e.g. 'e876dd4f').
 * Queries DynamoDB to ensure uniqueness; retries on collision.
 */
async function generateUniquePartyId(): Promise<string> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = uuidv4().split('-')[0] as string;
    let result;
    try {
      result = await dynamoClient.send(
        new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: candidate } })
      );
    } catch (err) {
      Logger.error(`generateUniquePartyId: DynamoDB GetCommand failed for candidate '${candidate}'`, err instanceof Error ? err.message : String(err));
      throw err;
    }
    if (!result.Item) {
      return candidate;
    }
    Logger.warn(`party_id collision detected for '${candidate}', regenerating`);
  }
}

/**
 * Creates a new party in DynamoDB.
 */
export async function createParty(
  name: string,
  adminEmail: string,
  options?: { description?: string; customizationEnabled?: boolean; party_date?: string }
): Promise<Party> {
  const now = new Date().toISOString();

  // Generate a unique 8-char hex ID, retrying on DynamoDB collision (Phase 3.1).
  const partyId = await generateUniquePartyId();

  const party: Party = {
    party_id: partyId,
    name,
    admin_email: adminEmail,
    ...(options?.description !== undefined ? { description: options.description } : {}),
    ...(options?.party_date !== undefined ? { party_date: options.party_date } : {}),
    customizationEnabled: options?.customizationEnabled ?? false,
    locked: false,
    created_at: now,
    updated_at: now,
  };

  Logger.info(`Creating party: ${party.party_id} for admin: ${adminEmail}`);

  try {
    await dynamoClient.send(new PutCommand({ TableName: PARTIES_TABLE, Item: party }));
  } catch (err) {
    Logger.error(`createParty: DynamoDB PutCommand failed for party_id '${party.party_id}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  // Automatically enrol the admin as a member of their own party so they appear in member lists.
  const adminMember: PartyMember = {
    email: adminEmail,
    party_id: partyId,
    role: 'admin',
    joined_at: now,
  };
  try {
    await dynamoClient.send(new PutCommand({ TableName: PARTY_MEMBERS_TABLE, Item: adminMember }));
  } catch (err) {
    Logger.error(`createParty: PartyMembers PutCommand failed for admin '${adminEmail}' party '${partyId}'`, err instanceof Error ? err.message : String(err));
    // Non-fatal — the party was created; member record can be added manually if needed
  }

  return party;
}

/**
 * Fetches a party by party_id from DynamoDB.
 */
export async function getParty(partyId: string): Promise<Party | undefined> {
  Logger.info(`Fetching party: ${partyId}`);

  let result;
  try {
    result = await dynamoClient.send(
      new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: partyId } })
    );
  } catch (err) {
    Logger.error(`getParty: DynamoDB GetCommand failed for party_id '${partyId}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }

  return result.Item as Party | undefined;
}
