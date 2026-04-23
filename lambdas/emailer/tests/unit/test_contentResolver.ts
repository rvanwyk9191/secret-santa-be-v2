// Constitution v1.8: all AWS SDK calls MUST be mocked — no real S3 calls

const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { resolveContent } from '../../src/services/contentResolver.js';
import { Logger } from '../../src/utils/logger.js';

describe('contentResolver', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    (Logger.error as jest.Mock).mockReset();
    (Logger.info as jest.Mock).mockReset();
  });

  it('calls GetObjectCommand with correct Bucket and Key', async () => {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify({ subject: 'Hello', message: 'World' }) },
    });

    await resolveContent({ bucket: 'my-bucket', object: 'templates/invite.json' });

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'templates/invite.json',
    });
  });

  it('returns parsed EmailContent from S3 JSON body', async () => {
    mockS3Send.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify({ subject: 'You are invited!', message: 'Join the party.' }) },
    });

    const result = await resolveContent({ bucket: 'my-bucket', object: 'templates/invite.json' });

    expect(result).toEqual({ subject: 'You are invited!', message: 'Join the party.' });
  });

  it('logs error and re-throws when S3 send rejects', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(resolveContent({ bucket: 'my-bucket', object: 'templates/invite.json' })).rejects.toThrow('S3 unavailable');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('S3 GetObjectCommand failed'),
      expect.stringContaining('S3 unavailable')
    );
  });
});
