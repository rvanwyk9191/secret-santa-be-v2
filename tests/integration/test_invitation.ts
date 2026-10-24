import { createInvitation } from '../../backend/src/services/invitationService';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-token-uuid-1234'),
}));

jest.mock('../../backend/src/utils/dynamodb.js', () => ({
  dynamoClient: { send: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../../backend/src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Invitation creation integration', () => {
  it('should create an invitation with a token and pending status', async () => {
    const invitation = await createInvitation('party-123', 'participant@example.com');

    expect(invitation.party_id).toBe('party-123');
    expect(invitation.email).toBe('participant@example.com');
    expect(invitation.token).toBeDefined();
    expect(typeof invitation.token).toBe('string');
    expect(invitation.token.length).toBeGreaterThan(0);
    expect(invitation.status).toBe('pending');
    expect(invitation.sent_at).toBeDefined();
    expect(invitation.accepted_at).toBeUndefined();
  });
});
