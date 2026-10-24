// src/services/profileService.ts
// Profile update service — updates blank first_name / last_name on a PartyMember record.

import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { PartyMember } from '../models/partyMember';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';
import { serviceError } from '../utils/serviceError';

const PARTY_MEMBERS_TABLE = 'PartyMembers';

/**
 * Updates blank profile fields (first_name, last_name) for a party member.
 * Only fields that are currently blank (undefined or empty string) will be updated;
 * non-blank existing values are never overwritten.
 *
 * @param partyId  - The party the member belongs to (SK in PartyMembers)
 * @param email    - The member's email address (PK in PartyMembers)
 * @param fields   - Fields to potentially set: { firstName?, lastName? }
 * @returns The updated PartyMember record
 */
export async function updateProfile(
  partyId: string,
  email: string,
  fields: { firstName?: string; lastName?: string }
): Promise<PartyMember> {
  Logger.info(`profileService: updateProfile partyId='${partyId}' email='${email}'`);

  // Fetch the existing member record
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
      `profileService: DynamoDB GetCommand failed for partyId='${partyId}' email='${email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!member) {
    throw serviceError('Party member not found.', 404);
  }

  // Build update expression for only blank fields
  const setClauses: string[] = [];
  const expressionValues: Record<string, string> = {};

  if (fields.firstName !== undefined && !member.first_name?.trim()) {
    setClauses.push('first_name = :firstName');
    expressionValues[':firstName'] = fields.firstName.trim();
  }
  if (fields.lastName !== undefined && !member.last_name?.trim()) {
    setClauses.push('last_name = :lastName');
    expressionValues[':lastName'] = fields.lastName.trim();
  }

  if (setClauses.length === 0) {
    Logger.info(`profileService: no blank fields to update for email='${email}'`);
    return member;
  }

  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: PARTY_MEMBERS_TABLE,
        Key: { email, party_id: partyId },
        UpdateExpression: `SET ${setClauses.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      })
    );
  } catch (err) {
    Logger.error(
      `profileService: DynamoDB UpdateCommand failed for partyId='${partyId}' email='${email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  const updated: PartyMember = {
    ...member,
    ...(expressionValues[':firstName'] !== undefined && { first_name: expressionValues[':firstName'] }),
    ...(expressionValues[':lastName'] !== undefined && { last_name: expressionValues[':lastName'] }),
  };

  Logger.info(`profileService: profile updated for email='${email}' partyId='${partyId}'`);
  return updated;
}

/**
 * Retrieves the full profile for a party member.
 *
 * @param partyId - The party the member belongs to
 * @param email   - The member's email address
 * @returns The PartyMember record, including gift_blob if present
 */
export async function getProfile(partyId: string, email: string): Promise<PartyMember> {
  Logger.info(`profileService: getProfile partyId='${partyId}' email='${email}'`);

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
      `profileService: DynamoDB GetCommand (getProfile) failed for partyId='${partyId}' email='${email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!member) {
    throw serviceError('Party member not found.', 404);
  }

  return member;
}
