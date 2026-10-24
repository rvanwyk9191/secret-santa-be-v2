// backend/src/services/meService.ts
// Business logic for GET /api/me/parties and GET /api/me/hosted-parties

import { QueryCommand, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Party } from '../models/party.js';
import type { PartyMember } from '../models/partyMember.js';
import type { Assignment } from '../models/assignment.js';
import type { Invitation } from '../models/invitation.js';
import { Logger } from '../utils/logger.js';
import { dynamoClient } from '../utils/dynamodb.js';

const PARTIES_TABLE = 'Parties';
const PARTY_MEMBERS_TABLE = 'PartyMembers';
const ASSIGNMENTS_TABLE = 'Assignments';
const INVITATIONS_TABLE = 'Invitations';

export interface MemberPartyEntry {
  party: Party;
  member: PartyMember;
  assignment?: {
    recipient_email: string;
    recipient_first_name?: string;
    recipient_last_name?: string;
    recipient_gift_blob?: string;
  };
}

export interface HostedPartyEntry {
  party: Party;
  members: Array<{
    member: PartyMember;
    assignment?: { recipient_email: string; recipient_first_name?: string; recipient_last_name?: string };
  }>;
  assigned: boolean;
  pendingInvitees: { email: string }[];
}

/**
 * Returns all parties the caller is an accepted member of, enriched with party
 * details and their assignment (if one exists).
 */
export async function getMyParties(callerEmail: string): Promise<MemberPartyEntry[]> {
  Logger.info(`meService: getMyParties caller='${callerEmail}'`);

  // 1. Query all PartyMember records for this email (email is the PK)
  let memberItems: PartyMember[];
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: PARTY_MEMBERS_TABLE,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': callerEmail.toLowerCase() },
      })
    );
    memberItems = (result.Items ?? []) as PartyMember[];
  } catch (err) {
    Logger.error('meService: QueryCommand (PartyMembers by email) failed', err instanceof Error ? err.message : String(err));
    throw err;
  }

  // 2. Enrich each membership with party data and assignment
  const entries = await Promise.all(
    memberItems.map(async (member): Promise<MemberPartyEntry | null> => {
      let party: Party | undefined;
      try {
        const res = await dynamoClient.send(
          new GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: member.party_id } })
        );
        party = res.Item as Party | undefined;
      } catch (err) {
        Logger.error(`meService: GetCommand (Party ${member.party_id}) failed`, err instanceof Error ? err.message : String(err));
        return null;
      }
      if (!party) return null;

      let assignment: MemberPartyEntry['assignment'];
      try {
        const res = await dynamoClient.send(
          new GetCommand({
            TableName: ASSIGNMENTS_TABLE,
            Key: { party_id: member.party_id, giver_email: member.email },
          })
        );
        if (res.Item) {
          const a = res.Item as Assignment;
          // Fetch recipient's member record to get their name and gift blob
          const recipientRes = await dynamoClient.send(
            new GetCommand({
              TableName: PARTY_MEMBERS_TABLE,
              Key: { email: a.recipient_email, party_id: member.party_id },
            })
          );
          const recipient = recipientRes.Item as PartyMember | undefined;
          assignment = {
            recipient_email: a.recipient_email,
            ...(recipient?.first_name !== undefined && { recipient_first_name: recipient.first_name }),
            ...(recipient?.last_name !== undefined && { recipient_last_name: recipient.last_name }),
            ...(recipient?.gift_blob !== undefined && { recipient_gift_blob: recipient.gift_blob }),
          };
        }
      } catch {
        // Assignment lookup failure is non-fatal — just return no assignment
      }

      return { party, member, ...(assignment !== undefined && { assignment }) };
    })
  );

  return entries.filter((e): e is MemberPartyEntry => e !== null);
}

/**
 * Returns all parties the caller is hosting (admin), enriched with member lists
 * and assignment status.
 */
export async function getMyHostedParties(callerEmail: string): Promise<HostedPartyEntry[]> {
  Logger.info(`meService: getMyHostedParties caller='${callerEmail}'`);

  // 1. Scan Parties table for all parties with admin_email = callerEmail
  let parties: Party[];
  try {
    const result = await dynamoClient.send(
      new ScanCommand({
        TableName: PARTIES_TABLE,
        FilterExpression: 'admin_email = :email',
        ExpressionAttributeValues: { ':email': callerEmail.toLowerCase() },
      })
    );
    parties = (result.Items ?? []) as Party[];
  } catch (err) {
    Logger.error('meService: ScanCommand (Parties by admin_email) failed', err instanceof Error ? err.message : String(err));
    throw err;
  }

  // 2. Enrich each party with members and their assignments
  const entries = await Promise.all(
    parties.map(async (party): Promise<HostedPartyEntry> => {
      // Fetch all members using party_id-index GSI
      let memberItems: PartyMember[] = [];
      try {
        const res = await dynamoClient.send(
          new QueryCommand({
            TableName: PARTY_MEMBERS_TABLE,
            IndexName: 'party_id-index',
            KeyConditionExpression: 'party_id = :partyId',
            ExpressionAttributeValues: { ':partyId': party.party_id },
          })
        );
        memberItems = (res.Items ?? []) as PartyMember[];
      } catch (err) {
        Logger.error(`meService: QueryCommand (PartyMembers for ${party.party_id}) failed`, err instanceof Error ? err.message : String(err));
      }

      // Fetch all assignments for this party in one query
      let assignmentMap: Map<string, Assignment> = new Map();
      try {
        const res = await dynamoClient.send(
          new QueryCommand({
            TableName: ASSIGNMENTS_TABLE,
            KeyConditionExpression: 'party_id = :partyId',
            ExpressionAttributeValues: { ':partyId': party.party_id },
          })
        );
        for (const item of res.Items ?? []) {
          const a = item as Assignment;
          assignmentMap.set(a.giver_email.toLowerCase(), a);
        }
      } catch {
        // Non-fatal
      }

      const members = memberItems.map((member) => {
        const a = assignmentMap.get(member.email.toLowerCase());
        return a
          ? { member, assignment: { recipient_email: a.recipient_email } }
          : { member };
      });

      const assigned = memberItems.length > 0 && memberItems.every((m) => assignmentMap.has(m.email.toLowerCase()));

      // Fetch pending invitations for this party
      let pendingInvitees: { email: string }[] = [];
      try {
        const invResult = await dynamoClient.send(
          new QueryCommand({
            TableName: INVITATIONS_TABLE,
            KeyConditionExpression: 'party_id = :partyId',
            FilterExpression: '#s = :pending',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':partyId': party.party_id, ':pending': 'pending' },
          })
        );
        pendingInvitees = ((invResult.Items ?? []) as Invitation[]).map((inv) => ({ email: inv.email }));
      } catch {
        // Non-fatal — omit pending invitees if the query fails
      }

      return { party, members, assigned, pendingInvitees };
    })
  );

  return entries;
}
