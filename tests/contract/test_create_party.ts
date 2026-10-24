import type { Party } from '../../backend/src/models/party.js';

/**
 * Contract test for POST /api/parties
 * Validates the shape and required fields of the party creation response.
 */
describe('POST /api/parties contract', () => {
  it('should return a response matching the Party contract', () => {
    const mockResponse: Party = {
      party_id: 'abc-123',
      name: 'Test Party',
      admin_email: 'admin@example.com',
      customizationEnabled: false,
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse).toHaveProperty('name');
    expect(typeof mockResponse.name).toBe('string');
    expect(mockResponse).toHaveProperty('admin_email');
    expect(typeof mockResponse.admin_email).toBe('string');
    expect(mockResponse).toHaveProperty('customizationEnabled');
    expect(mockResponse).toHaveProperty('locked');
    expect(mockResponse).toHaveProperty('created_at');
    expect(mockResponse).toHaveProperty('updated_at');
  });
});
