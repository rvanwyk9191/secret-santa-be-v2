export type MemberRole = 'admin' | 'member';

export interface PartyMember {
  email: string;
  party_id: string;
  role: MemberRole;
  first_name?: string;
  last_name?: string;
  joined_at: string;
  gift_blob?: string;
}
