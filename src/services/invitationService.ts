import { v4 as uuidv4 } from 'uuid';
import type { Invitation } from '../models/invitation';
import { Logger } from '../utils/logger';
import { publishNotification } from './notificationService';

/**
 * Creates a new invitation for a participant and publishes an SNS notification.
 */
export async function createInvitation(
  partyId: string,
  email: string,
  adminEmail: string
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

  // TODO: persist to DynamoDB
  // await dynamoClient.put({ TableName: 'Invitations', Item: invitation }).promise();

  try {
    await publishNotification({
      type: 'invitation_sent',
      party_id: partyId,
      recipient_email: email,
      data: {
        token: invitation.token,
        admin_email: adminEmail,
      },
    });
  } catch (err) {
    Logger.error(`createInvitation: failed to publish SNS notification for party '${partyId}' recipient '${email}'`, err instanceof Error ? err.message : String(err));
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

  // TODO: fetch from DynamoDB
  // const result = await dynamoClient.get({
  //   TableName: 'Invitations',
  //   Key: { party_id: partyId, email },
  // }).promise();
  // return result.Item as Invitation | undefined;

  return undefined;
}
