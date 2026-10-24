// Unit tests for partyResolver service (Constitution v1.8: all AWS SDK calls MUST be mocked)

const mockDynamoSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockDynamoSend })),
  GetItemCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { resolvePartyName } from '../../src/services/partyResolver.js';
import { Logger } from '../../src/utils/logger.js';

describe('partyResolver', () => {
  beforeEach(() => {
    mockDynamoSend.mockReset();
    (Logger.info as jest.Mock).mockReset();
    (Logger.warn as jest.Mock).mockReset();
    (Logger.error as jest.Mock).mockReset();
  });

  it('returns the party name when the DynamoDB item is found', async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { party_id: { S: 'party-123' }, name: { S: 'Winter Wonderland' } },
    });

    const result = await resolvePartyName('party-123');

    expect(result).toBe('Winter Wonderland');
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining('resolved party name'),
      expect.stringContaining('Winter Wonderland')
    );
  });

  it('returns an empty string and warns when the item has no name field', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: { party_id: { S: 'party-456' } } });

    const result = await resolvePartyName('party-456');

    expect(result).toBe('');
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('party name not found')
    );
  });

  it('returns an empty string and warns when no item is found', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });

    const result = await resolvePartyName('party-999');

    expect(result).toBe('');
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('party name not found')
    );
  });

  it('logs error and re-throws when DynamoDB GetItem rejects', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('ResourceNotFoundException'));

    await expect(resolvePartyName('party-123')).rejects.toThrow('ResourceNotFoundException');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB GetItem failed'),
      expect.stringContaining('ResourceNotFoundException')
    );
  });
});
