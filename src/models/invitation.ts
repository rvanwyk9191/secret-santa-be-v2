export interface Invitation {
  party_id: string;
  email: string;
  token: string;
  invited_at: string;
  accepted: boolean;
  accepted_at?: string;
}
