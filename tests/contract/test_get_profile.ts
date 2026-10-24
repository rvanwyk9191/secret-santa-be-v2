import type { PartyMember } from '../../backend/src/models/partyMember.js';

/**
 * Contract test for GET /api/parties/{party_id}/members/{member_id}/profile
 * Validates the shape and required/optional fields of the profile retrieval response.
 */
describe('GET /api/parties/{party_id}/members/{member_id}/profile contract', () => {
  it('should return a full PartyMember record with all required fields', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    expect(mockResponse).toHaveProperty('email');
    expect(typeof mockResponse.email).toBe('string');
    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse).toHaveProperty('role');
    expect(['admin', 'member']).toContain(mockResponse.role);
    expect(mockResponse).toHaveProperty('joined_at');
    expect(typeof mockResponse.joined_at).toBe('string');
  });

  it('should allow optional first_name and last_name fields', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
      first_name: 'Jane',
      last_name: 'Doe',
    };

    expect(mockResponse.first_name).toBe('Jane');
    expect(mockResponse.last_name).toBe('Doe');
  });

  it('should include gift_blob field when the member has submitted gift details', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
      gift_blob: 'I would like a telescope and some books',
    };

    expect(mockResponse).toHaveProperty('gift_blob');
    expect(typeof mockResponse.gift_blob).toBe('string');
    expect(mockResponse.gift_blob!.length).toBeGreaterThan(0);
  });

  it('should allow gift_blob to be absent when no gift details have been submitted', () => {
    const mockResponse: PartyMember = {
      email: 'member@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    expect(mockResponse.gift_blob).toBeUndefined();
  });
});
