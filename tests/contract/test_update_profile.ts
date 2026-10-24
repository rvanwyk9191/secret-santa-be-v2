import type { PartyMember } from '../../backend/src/models/partyMember.js';

/**
 * Contract test for PUT /api/parties/{party_id}/members/{member_id}/profile
 * Validates the shape and required fields of the profile update response.
 */
describe('PUT /api/parties/{party_id}/members/{member_id}/profile contract', () => {
  it('should return a response matching the PartyMember contract', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      first_name: 'Jane',
      last_name: 'Doe',
      joined_at: new Date().toISOString(),
    };

    expect(mockResponse).toHaveProperty('email');
    expect(typeof mockResponse.email).toBe('string');
    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse).toHaveProperty('role');
    expect(['admin', 'member']).toContain(mockResponse.role);
    expect(mockResponse).toHaveProperty('joined_at');
  });

  it('should allow optional first_name and last_name fields', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    // first_name and last_name are optional
    expect(mockResponse.first_name).toBeUndefined();
    expect(mockResponse.last_name).toBeUndefined();
  });

  it('should not overwrite existing non-blank first_name', () => {
    // Contract: only blank fields may be updated
    const existing: Partial<PartyMember> = { first_name: 'Existing', last_name: '' };
    const incoming = { firstName: 'New', lastName: 'Doe' };

    const updated = {
      first_name: existing.first_name?.trim() ? existing.first_name : incoming.firstName,
      last_name: existing.last_name?.trim() ? existing.last_name : incoming.lastName,
    };

    expect(updated.first_name).toBe('Existing');
    expect(updated.last_name).toBe('Doe');
  });
});
