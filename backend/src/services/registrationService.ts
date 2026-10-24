import { QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Invitation } from '../models/invitation';
import type { PartyMember } from '../models/partyMember';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';
import { serviceError } from '../utils/serviceError';

const INVITATIONS_TABLE = 'Invitations';
const PARTY_MEMBERS_TABLE = 'PartyMembers';

/**
 * Accepts a pending invitation for the given user, marks it accepted in DynamoDB,
 * and creates a PartyMember record. Throws a structured error (with statusCode) for
 * controlled business failures: 404 not found, 403 email mismatch, 409 not pending.
 */
export async function acceptInvitation(
  partyId: string,
  token: string,
  userEmail: string
): Promise<PartyMember> {
  Logger.info(
    `registrationService: acceptInvitation partyId='${partyId}' userEmail='${userEmail}'`
  );

  // Query the Invitations table by party_id (PK) and filter by token
  let invitation: Invitation | undefined;
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: INVITATIONS_TABLE,
        KeyConditionExpression: 'party_id = :partyId',
        FilterExpression: '#token = :token',
        ExpressionAttributeNames: { '#token': 'token' },
        ExpressionAttributeValues: { ':partyId': partyId, ':token': token },
      })
    );
    invitation = result.Items?.[0] as Invitation | undefined;
  } catch (err) {
    Logger.error(
      `registrationService: DynamoDB QueryCommand failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!invitation) {
    throw serviceError('Invitation not found.', 404);
  }

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw serviceError('Invitation does not belong to this user.', 403);
  }

  if (invitation.status !== 'pending') {
    throw serviceError(`Invitation is not pending (status: ${invitation.status}).`, 409);
  }

  const now = new Date().toISOString();

  // Mark invitation as accepted
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: INVITATIONS_TABLE,
        Key: { party_id: partyId, email: invitation.email },
        UpdateExpression: 'SET #s = :accepted, accepted_at = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':accepted': 'accepted', ':now': now },
      })
    );
  } catch (err) {
    Logger.error(
      `registrationService: DynamoDB UpdateCommand failed for partyId='${partyId}' email='${invitation.email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  // Create PartyMember record
  const member: PartyMember = {
    email: invitation.email,
    party_id: partyId,
    role: 'member',
    joined_at: now,
  };

  try {
    await dynamoClient.send(
      new PutCommand({ TableName: PARTY_MEMBERS_TABLE, Item: member })
    );
  } catch (err) {
    Logger.error(
      `registrationService: DynamoDB PutCommand failed for partyId='${partyId}' email='${invitation.email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  Logger.info(
    `registrationService: invitation accepted partyId='${partyId}' email='${invitation.email}'`
  );
  return member;
}
