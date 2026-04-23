import { createParty } from '../../src/services/partyService.js';

// Mock uuid for a deterministic party_id (constitution v1.6: no real network calls in tests)
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'aabbccdd-0000-0000-0000-000000000000'),
}));

// Mock DynamoDB — GetCommand returns no item (no collision), PutCommand succeeds
jest.mock('../../src/utils/dynamodb.js', () => ({
  dynamoClient: {
    send: jest.fn().mockImplementation(() => Promise.resolve({ Item: undefined })),
  },
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Integration test for party creation.
 */
describe('Party creation integration', () => {
  it('should create a party and return valid party_id and admin_email', async () => {
    const party = await createParty('Holiday Party', 'admin@example.com', {
      description: 'Annual gift exchange',
      customizationEnabled: true,
    });

    expect(party.party_id).toBeDefined();
    expect(typeof party.party_id).toBe('string');
    expect(party.party_id.length).toBeGreaterThan(0);
    expect(party.admin_email).toBe('admin@example.com');
    expect(party.name).toBe('Holiday Party');
    expect(party.locked).toBe(false);
    expect(party.customizationEnabled).toBe(true);
    expect(party.created_at).toBeDefined();
    expect(party.updated_at).toBeDefined();
  });
});
