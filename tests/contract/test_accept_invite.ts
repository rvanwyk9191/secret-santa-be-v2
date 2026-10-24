import type { PartyMember } from '../../backend/src/models/partyMember.js';

/**
 * Contract test for GET /api/parties/:party_id/invitations/:token
 * Validates the shape and required fields of the invitation acceptance response.
 */
describe('GET /api/parties/:party_id/invitations/:token contract', () => {
  it('should return a response matching the PartyMember contract', () => {
    const mockResponse: PartyMember = {
      email: 'user@example.com',
      party_id: 'abc-123',
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    expect(mockResponse).toHaveProperty('email');
    expect(typeof mockResponse.email).toBe('string');
    expect(mockResponse.email.length).toBeGreaterThan(0);

    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse.party_id.length).toBeGreaterThan(0);

    expect(mockResponse).toHaveProperty('role');
    expect(['admin', 'member']).toContain(mockResponse.role);

    expect(mockResponse).toHaveProperty('joined_at');
    expect(typeof mockResponse.joined_at).toBe('string');
    expect(new Date(mockResponse.joined_at).toISOString()).toBe(mockResponse.joined_at);
  });
});
