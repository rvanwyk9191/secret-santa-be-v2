// src/services/assignmentService.ts
// Assignment service — generates or saves giver/recipient pairs for a party.

import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Assignment } from '../models/assignment';
import type { PartyMember } from '../models/partyMember';
import { Logger } from '../utils/logger';
import { dynamoClient } from '../utils/dynamodb';
import { publishNotification } from './notificationService';
import { serviceError } from '../utils/serviceError';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';
const ASSIGNMENTS_TABLE = 'Assignments';

/**
 * Generates a valid random assignment cycle: each participant gives to exactly one other
 * and receives from exactly one other. No self-assignments are produced.
 * Uses a Fisher-Yates derangement approach.
 */
function generateDerangement(emails: string[]): string[] {
  if (emails.length < 2) {
    throw serviceError('A minimum of 2 members is required to generate assignments.', 422);
  }

  // Attempt up to 100 shuffles to get a valid derangement
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = [...emails];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // swap
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    // A derangement: no element in shuffled[i] equals emails[i]
    const isDerangement = emails.every((email, i) => email !== shuffled[i]);
    if (isDerangement) {
      return shuffled;
    }
  }

  // Fallback: construct a guaranteed derangement by rotating by 1
  const rotated = [...emails.slice(1), emails[0]!];
  return rotated;
}

/**
 * Creates assignments for a party.
 * - Requires the party to be locked (throws 422 if not).
 * - Requires the caller to be the party admin (throws 403).
 * - In 'automatic' mode, generates a random derangement.
 * - In 'manual' mode, validates the provided assignments and persists them as-is.
 * - Publishes an `assignment_completed` SNS event after persisting.
 *
 * @param partyId       - The party to assign
 * @param callerEmail   - The authenticated user's email (must be the admin)
 * @param mode          - 'automatic' or 'manual'
 * @param manualPairs   - Required when mode = 'manual'
 * @returns Array of persisted Assignment records
 */
export async function createAssignments(
  partyId: string,
  callerEmail: string,
  mode: 'automatic' | 'manual',
  manualPairs?: Array<{ giverEmail: string; recipientEmail: string }>
): Promise<Assignment[]> {
  Logger.info(`assignmentService: createAssignments partyId='${partyId}' mode='${mode}'`);

  // Fetch the party
  let party: { admin_email: string; locked: boolean } | undefined;
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: partyId } })
    );
    party = result.Item as typeof party | undefined;
  } catch (err) {
    Logger.error(
      `assignmentService: DynamoDB GetCommand (Parties) failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (!party) {
    throw serviceError('Party not found.', 404);
  }

  if (party.admin_email.toLowerCase() !== callerEmail.toLowerCase()) {
    throw serviceError('Forbidden: only the party administrator can create assignments.', 403);
  }

  if (!party.locked) {
    throw serviceError('Party must be locked before assignments can be created.', 422);
  }

  // Fetch all party members
  let members: PartyMember[] = [];
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: PARTY_MEMBERS_TABLE,
        IndexName: 'party_id-index',
        KeyConditionExpression: 'party_id = :partyId',
        ExpressionAttributeValues: { ':partyId': partyId },
      })
    );
    members = (result.Items ?? []) as PartyMember[];
  } catch (err) {
    Logger.error(
      `assignmentService: DynamoDB QueryCommand (PartyMembers) failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  if (members.length < 2) {
    throw serviceError('A minimum of 2 members is required to generate assignments.', 422);
  }

  const now = new Date().toISOString();
  let assignments: Assignment[];

  if (mode === 'automatic') {
    const emails = members.map(m => m.email);
    const recipients = generateDerangement(emails);
    assignments = emails.map((giverEmail, i) => ({
      party_id: partyId,
      giver_email: giverEmail,
      recipient_email: recipients[i]!,
      assigned_at: now,
    }));
  } else {
    // manual mode — validate the provided pairs
    if (!manualPairs || manualPairs.length === 0) {
      throw serviceError("Assignments must be provided when mode is 'manual'.", 400);
    }

    const memberEmails = new Set(members.map(m => m.email.toLowerCase()));
    for (const pair of manualPairs) {
      if (pair.giverEmail.toLowerCase() === pair.recipientEmail.toLowerCase()) {
        throw serviceError(`Self-assignment is not allowed: '${pair.giverEmail}'.`, 422);
      }
      if (!memberEmails.has(pair.giverEmail.toLowerCase())) {
        throw serviceError(`Giver '${pair.giverEmail}' is not a member of this party.`, 422);
      }
      if (!memberEmails.has(pair.recipientEmail.toLowerCase())) {
        throw serviceError(`Recipient '${pair.recipientEmail}' is not a member of this party.`, 422);
      }
    }

    assignments = manualPairs.map(pair => ({
      party_id: partyId,
      giver_email: pair.giverEmail.toLowerCase(),
      recipient_email: pair.recipientEmail.toLowerCase(),
      assigned_at: now,
    }));
  }

  // Persist all assignment records
  for (const assignment of assignments) {
    try {
      await dynamoClient.send(
        new PutCommand({ TableName: ASSIGNMENTS_TABLE, Item: assignment })
      );
    } catch (err) {
      Logger.error(
        `assignmentService: DynamoDB PutCommand failed for giver='${assignment.giver_email}'`,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }

  // Publish SNS notification (non-fatal on failure)
  try {
    await publishNotification({
      type: 'assignment_completed',
      party_id: partyId,
      recipient_email: party.admin_email,
      data: { admin_email: party.admin_email, count: String(assignments.length) },
    });
  } catch (err) {
    Logger.error(
      `assignmentService: SNS notification failed for partyId='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
  }

  Logger.info(
    `assignmentService: ${assignments.length} assignments created for partyId='${partyId}'`
  );
  return assignments;
}
