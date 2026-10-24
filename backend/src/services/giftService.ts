// src/services/giftService.ts
// Gift blob service — saves gift details for a party member if customization is enabled.

import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { PartyMember } from '../models/partyMember';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';
import { serviceError } from '../utils/serviceError';

const PARTY_MEMBERS_TABLE = 'PartyMembers';
const PARTIES_TABLE = 'Parties';

/**
 * Saves a gift blob for the given party member.
 * Requires the party to have customizationEnabled = true.
 *
 * @param partyId  - The party the member belongs to
 * @param email    - The member's email address
 * @param giftBlob - Free-form gift details string
 * @returns The updated PartyMember record (email, party_id, gift_blob)
 */
export async function saveGiftBlob(
  partyId: string,
  email: string,
  giftBlob: string
): Promise<Pick<PartyMember, 'email' | 'party_id' | 'gift_blob'>> {
  Logger.info(`giftService: saveGiftBlob partyId='${partyId}' email='${email}'`);

  // Verify the party exists and has customization enabled
  let party: { customizationEnabled?: boolean; customization_enabled?: boolean } | undefined;
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: PARTIES_TABLE,
        Key: { party_id: partyId },
      })
    );
    party = result.Item as typeof party | undefined;
  } catch (err) {
    Logger.error(
      `giftService: DynamoDB GetCommand (Parties) failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!party) {
    throw serviceError('Party not found.', 404);
  }

  // Support both camelCase and snake_case attribute names
  const customizationEnabled = party.customizationEnabled ?? party.customization_enabled ?? false;
  if (!customizationEnabled) {
    throw serviceError('Gift customization is not enabled for this party.', 403);
  }

  // Verify the member exists
  let member: PartyMember | undefined;
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: PARTY_MEMBERS_TABLE,
        Key: { email, party_id: partyId },
      })
    );
    member = result.Item as PartyMember | undefined;
  } catch (err) {
    Logger.error(
      `giftService: DynamoDB GetCommand (PartyMembers) failed for partyId='${partyId}' email='${email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!member) {
    throw serviceError('Party member not found.', 404);
  }

  // Save the gift blob
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: PARTY_MEMBERS_TABLE,
        Key: { email, party_id: partyId },
        UpdateExpression: 'SET gift_blob = :giftBlob',
        ExpressionAttributeValues: { ':giftBlob': giftBlob },
      })
    );
  } catch (err) {
    Logger.error(
      `giftService: DynamoDB UpdateCommand failed for partyId='${partyId}' email='${email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  Logger.info(`giftService: gift blob saved for email='${email}' partyId='${partyId}'`);
  return { email, party_id: partyId, gift_blob: giftBlob };
}
