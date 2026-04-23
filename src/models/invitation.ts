export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface Invitation {
  party_id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  sent_at: string;
  accepted_at?: string;
}
