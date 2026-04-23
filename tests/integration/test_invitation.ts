import { createInvitation } from '../../src/services/invitationService';

jest.mock('../../src/services/notificationService', () => ({
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));

describe('Invitation creation integration', () => {
  it('should create an invitation with a token and pending status', async () => {
    const invitation = await createInvitation('party-123', 'participant@example.com', 'admin@example.com');

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
