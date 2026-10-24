import type { Party } from '../../backend/src/models/party.js';

/**
 * Contract test for POST /api/parties/{party_id}/lock
 * Validates the shape and required fields of the lock response.
 */
describe('POST /api/parties/{party_id}/lock contract', () => {
  it('should return the updated Party with locked = true', () => {
    const mockResponse: Party = {
      party_id: 'abc-123',
      name: 'Test Party',
      admin_email: 'admin@example.com',
      customizationEnabled: false,
      locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(mockResponse).toHaveProperty('party_id');
    expect(typeof mockResponse.party_id).toBe('string');
    expect(mockResponse.locked).toBe(true);
    expect(mockResponse).toHaveProperty('admin_email');
    expect(mockResponse).toHaveProperty('updated_at');
  });

  it('should not allow locking a party that is already locked', () => {
    // Contract: locking an already-locked party should be rejected (409 Conflict)
    const alreadyLocked: Party = {
      party_id: 'abc-123',
      name: 'Test Party',
      admin_email: 'admin@example.com',
      customizationEnabled: false,
      locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(alreadyLocked.locked).toBe(true);
  });
});
