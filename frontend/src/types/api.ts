// ─────────────────────────────────────────────────────────────────────────────
// Core domain types (mirror backend models)
// ─────────────────────────────────────────────────────────────────────────────

export interface Party {
  party_id: string;
  name: string;
  description?: string;
  admin_email: string;
  customizationEnabled: boolean;
  locked: boolean;
  party_date?: string;   // ISO date string — "Buy your gifts by" from CreateAParty
  created_at: string;
  updated_at: string;
}

export interface PartyMember {
  email: string;
  party_id: string;
  role: 'admin' | 'member';
  first_name?: string;
  last_name?: string;
  joined_at: string;
  gift_blob?: string;
}

export interface Assignment {
  party_id: string;
  giver_email: string;
  recipient_email: string;
  assigned_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/me/parties
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipientInfo {
  recipient_email: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
  recipient_gift_blob?: string;
}

export interface MemberPartyEntry {
  party: Party;
  member: PartyMember;
  assignment?: RecipientInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/me/hosted-parties
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberWithAssignment {
  member: PartyMember;
  assignment?: {
    recipient_email: string;
    recipient_first_name?: string;
    recipient_last_name?: string;
  };
}

export interface HostedPartyEntry {
  party: Party;
  members: MemberWithAssignment[];
  assigned: boolean;
  pendingInvitees: { email: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePartyPayload {
  name: string;
  description?: string;
  customizationEnabled: boolean;
  party_date?: string;
}

export interface UpdatePartyPayload {
  customizationEnabled?: boolean;
  name?: string;
  description?: string;
}

export interface CreateInvitationPayload {
  email: string;
}

export interface SaveGiftBlobPayload {
  giftBlob: string;
}

export interface CreateAssignmentsPayload {
  mode: 'automatic' | 'manual';
  assignments?: Array<{ giverEmail: string; recipientEmail: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/me/pending-invites
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingInvite {
  party_id: string;
  party_name: string;
  admin_email: string;
  party_date?: string;
  token: string;
  sent_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns "First Last", falling back to email if names are absent. */
export function displayName(
  first: string | undefined,
  last: string | undefined,
  email: string
): string {
  const parts = [first, last].filter(Boolean).join(' ');
  return parts || email;
}
