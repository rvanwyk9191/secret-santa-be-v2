export interface Party {
  party_id: string;
  name: string;
  description?: string;
  admin_email: string;
  customizationEnabled: boolean;
  locked: boolean;
  party_date?: string;
  created_at: string;
  updated_at: string;
}
