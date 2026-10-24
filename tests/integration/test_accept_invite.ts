import { acceptInvitation } from '../../backend/src/services/registrationService.js';

jest.mock('../../backend/src/utils/dynamodb.js', () => ({
  dynamoClient: { send: jest.fn() },
}));

jest.mock('../../backend/src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pendingInvitation = {
  party_id: 'party-abc',
  email: 'user@example.com',
  token: 'valid-token-uuid',
  status: 'pending',
  sent_at: '2026-01-01T00:00:00.000Z',
};

describe('Registration — acceptInvitation integration', () => {
  let dynamoSend: jest.Mock;

  beforeAll(async () => {
    const { dynamoClient } = await import('../../backend/src/utils/dynamodb.js');
    dynamoSend = dynamoClient.send as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept a valid pending invitation and return a PartyMember', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Items: [pendingInvitation] }) // QueryCommand
      .mockResolvedValueOnce({})                             // UpdateCommand
      .mockResolvedValueOnce({});                            // PutCommand

    const member = await acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com');

    expect(member.email).toBe('user@example.com');
    expect(member.party_id).toBe('party-abc');
    expect(member.role).toBe('member');
    expect(typeof member.joined_at).toBe('string');
    expect(new Date(member.joined_at).toISOString()).toBe(member.joined_at);
  });

  it('should be case-insensitive when matching user email to invitation email', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Items: [pendingInvitation] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const member = await acceptInvitation('party-abc', 'valid-token-uuid', 'USER@EXAMPLE.COM');

    expect(member.email).toBe('user@example.com');
  });

  it('should throw 404 when no invitation matches the token', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [] });

    await expect(
      acceptInvitation('party-abc', 'wrong-token', 'user@example.com')
    ).rejects.toMatchObject({ message: 'Invitation not found.', statusCode: 404 });
  });

  it('should throw 403 when the authenticated user email does not match the invitation', async () => {
    const wrongUserInvitation = { ...pendingInvitation, email: 'other@example.com' };
    dynamoSend.mockResolvedValueOnce({ Items: [wrongUserInvitation] });

    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toMatchObject({
      message: 'Invitation does not belong to this user.',
      statusCode: 403,
    });
  });

  it('should throw 409 when invitation has already been accepted', async () => {
    const acceptedInvitation = { ...pendingInvitation, status: 'accepted' };
    dynamoSend.mockResolvedValueOnce({ Items: [acceptedInvitation] });

    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should throw 409 when invitation has been revoked', async () => {
    const revokedInvitation = { ...pendingInvitation, status: 'revoked' };
    dynamoSend.mockResolvedValueOnce({ Items: [revokedInvitation] });

    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should log and re-throw when DynamoDB QueryCommand fails', async () => {
    dynamoSend.mockRejectedValueOnce(new Error('DynamoDB connection error'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toThrow('DynamoDB connection error');

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB QueryCommand failed'),
      'DynamoDB connection error'
    );
  });

  it('should log and re-throw when DynamoDB UpdateCommand fails', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Items: [pendingInvitation] })
      .mockRejectedValueOnce(new Error('UpdateCommand failure'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toThrow('UpdateCommand failure');

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB UpdateCommand failed'),
      'UpdateCommand failure'
    );
  });

  it('should log and re-throw when DynamoDB PutCommand fails', async () => {
    dynamoSend
      .mockResolvedValueOnce({ Items: [pendingInvitation] })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('PutCommand failure'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(
      acceptInvitation('party-abc', 'valid-token-uuid', 'user@example.com')
    ).rejects.toThrow('PutCommand failure');

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB PutCommand failed'),
      'PutCommand failure'
    );
  });
});
