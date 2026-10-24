import client from './client';
import type {
  MemberPartyEntry,
  HostedPartyEntry,
  Party,
  PartyMember,
  Assignment,
  CreatePartyPayload,
  UpdatePartyPayload,
  CreateInvitationPayload,
  SaveGiftBlobPayload,
  CreateAssignmentsPayload,
  PendingInvite,
} from '../types/api';

// ─────────────────────────────────────────────────────────────────────────────
// Current-user party lookups
// ─────────────────────────────────────────────────────────────────────────────

/** Returns all parties where the authenticated user is an accepted member. */
export async function getMyParties(): Promise<MemberPartyEntry[]> {
  const res = await client.get<MemberPartyEntry[]>('/me/parties');
  return res.data;
}

/** Returns all parties where the authenticated user is the admin. */
export async function getMyHostedParties(): Promise<HostedPartyEntry[]> {
  const res = await client.get<HostedPartyEntry[]>('/me/hosted-parties');
  return res.data;
}

/** Returns all pending invitations for the authenticated user. */
export async function getMyPendingInvites(): Promise<PendingInvite[]> {
  const res = await client.get<PendingInvite[]>('/me/pending-invites');
  return res.data;
}

/** Accepts a pending invitation. */
export async function acceptPendingInvite(partyId: string, token: string): Promise<PartyMember> {
  const res = await client.post<PartyMember>(`/parties/${partyId}/invitations/${token}/accept`);
  return res.data;
}

/** Declines a pending invitation. */
export async function declinePendingInvite(partyId: string, token: string): Promise<void> {
  await client.post(`/parties/${partyId}/invitations/${token}/decline`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Party lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/** Creates a new party. Returns the created Party record. */
export async function createParty(payload: CreatePartyPayload): Promise<Party> {
  const res = await client.post<Party>('/parties', payload);
  return res.data;
}

/** Updates mutable party fields (customizationEnabled, name, description). Admin only. */
export async function updateParty(partyId: string, payload: UpdatePartyPayload): Promise<Party> {
  const res = await client.patch<Party>(`/parties/${partyId}`, payload);
  return res.data;
}

/** Locks the party. Admin only. */
export async function lockParty(partyId: string): Promise<Party> {
  const res = await client.post<Party>(`/parties/${partyId}/lock`);
  return res.data;
}

/** Unlocks the party. Admin only. */
export async function unlockParty(partyId: string): Promise<Party> {
  const res = await client.post<Party>(`/parties/${partyId}/unlock`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────────────────────

/** Sends an invitation email to a single address. Admin only. */
export async function createInvitation(
  partyId: string,
  payload: CreateInvitationPayload
): Promise<void> {
  await client.post(`/parties/${partyId}/invitations`, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────────────────

/** Removes an accepted member from the party. Admin only. */
export async function removeMember(partyId: string, memberEmail: string): Promise<void> {
  await client.delete(`/parties/${partyId}/members/${encodeURIComponent(memberEmail)}`);
}

/** Revokes a pending invitation. Admin only. */
export async function revokeInvitation(partyId: string, inviteeEmail: string): Promise<void> {
  await client.delete(`/parties/${partyId}/invitations/${encodeURIComponent(inviteeEmail)}`);
}

/** Permanently deletes the party and all its members. Admin only. */
export async function deleteParty(partyId: string): Promise<void> {
  await client.delete(`/parties/${partyId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gifts
// ─────────────────────────────────────────────────────────────────────────────

/** Saves the authenticated member's gift wish-list blob. */
export async function saveGiftBlob(
  partyId: string,
  memberEmail: string,
  payload: SaveGiftBlobPayload
): Promise<PartyMember> {
  const res = await client.post<PartyMember>(
    `/parties/${partyId}/members/${encodeURIComponent(memberEmail)}/gifts`,
    payload
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────────────────────────────

/** Creates automatic or manual gift assignments. Party must be locked. Admin only. */
export async function createAssignments(
  partyId: string,
  payload: CreateAssignmentsPayload
): Promise<Assignment[]> {
  const res = await client.post<Assignment[]>(`/parties/${partyId}/assignments`, payload);
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────────────────────

/** Emails all members their match assignment. Party must be locked and assigned. Admin only. */
export async function emailAllMatches(partyId: string): Promise<void> {
  await client.post(`/parties/${partyId}/email-matches`);
}

/** Emails a single member their match assignment. Admin only. */
export async function emailMemberMatch(partyId: string, memberEmail: string): Promise<void> {
  await client.post(
    `/parties/${partyId}/members/${encodeURIComponent(memberEmail)}/email-match`
  );
}
