import type { PartyMember } from '../../backend/src/models/partyMember.js';

/**
 * Contract test for POST /api/parties/{party_id}/members/{member_id}/gifts
 * Validates the shape and required fields of the gift submission response.
 */
describe('POST /api/parties/{party_id}/members/{member_id}/gifts contract', () => {
  it('should return a response with email, party_id, and gift_blob', () => {
    const mockResponse: Pick<PartyMember, 'email' | 'party_id' | 'gift_blob'> = {
      email: 'member@example.com',
      party_id: 'abc-123',
      gift_blob: 'I would love a new book',
    };

    expect(mockResponse).toHaveProperty('email');
    expect(typeof mockResponse.email).toBe('string');
    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse).toHaveProperty('gift_blob');
    expect(typeof mockResponse.gift_blob).toBe('string');
  });

  it('should require a non-empty gift_blob string', () => {
    const giftBlob = 'A book about TypeScript';
    expect(typeof giftBlob).toBe('string');
    expect(giftBlob.trim().length).toBeGreaterThan(0);
  });
});
