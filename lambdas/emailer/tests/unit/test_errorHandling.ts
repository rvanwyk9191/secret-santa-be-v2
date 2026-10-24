// T016 — error scenario tests for all three modules (Constitution v1.8: all AWS SDK calls MUST be mocked)

// ── contentResolver mocks ──────────────────────────────────────────────────
const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn().mockImplementation((input) => input),
}));

// ── emailSender mocks ──────────────────────────────────────────────────────
const mockSesSend = jest.fn();

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

// ── partyResolver mocks ────────────────────────────────────────────────────
const mockDynamoSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockDynamoSend })),
  GetItemCommand: jest.fn().mockImplementation((input) => input),
}));

// ── logger mock ────────────────────────────────────────────────────────────
jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Real implementations are used — no mocks for contentResolver, emailSender, or partyResolver
import { resolveContent } from '../../src/services/contentResolver.js';
import { sendEmail } from '../../src/services/emailSender.js';
import { resolvePartyName } from '../../src/services/partyResolver.js';
import { handler } from '../../src/handler.js';
import { Logger } from '../../src/utils/logger.js';

describe('error handling', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    mockSesSend.mockReset();
    mockDynamoSend.mockReset();
    (Logger.error as jest.Mock).mockReset();
    (Logger.info as jest.Mock).mockReset();
    (Logger.warn as jest.Mock).mockReset();
  });

  describe('contentResolver: S3 send rejects', () => {
    it('logs error and re-throws the S3 error', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchBucket'));

      await expect(
        resolveContent({ bucket: 'my-bucket', object: 'invite.json' })
      ).rejects.toThrow('NoSuchBucket');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('S3 GetObjectCommand failed'),
        expect.stringContaining('NoSuchBucket')
      );
    });
  });

  describe('contentResolver: malformed JSON body from S3', () => {
    it('logs parse error and throws EmailContent JSON parse failed', async () => {
      mockS3Send.mockResolvedValueOnce({
        Body: { transformToString: async () => 'NOT_VALID_JSON{{' },
      });

      await expect(
        resolveContent({ bucket: 'my-bucket', object: 'invite.json' })
      ).rejects.toThrow(/EmailContent JSON parse failed/);

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EmailContent JSON parse failed'),
        expect.any(String)
      );
    });
  });

  describe('handler: missing or empty event fields', () => {
    it('throws and logs validation error when email is an empty string', async () => {
      const badEvent = { email: '', messageObject: { bucket: 'b', object: 'k' } };

      await expect(handler([badEvent] as never)).rejects.toThrow(/invalid event — email must be a non-empty string/);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid event — email must be a non-empty string')
      );
    });

    it('throws and logs validation error when messageObject.bucket is empty', async () => {
      const badEvent = { email: 'a@b.com', messageObject: { bucket: '', object: 'k' } };

      await expect(handler([badEvent] as never)).rejects.toThrow(/invalid event — messageObject.bucket must be a non-empty string/);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid event — messageObject.bucket must be a non-empty string')
      );
    });

    it('throws and logs validation error when messageObject.object is empty', async () => {
      const badEvent = { email: 'a@b.com', messageObject: { bucket: 'b', object: '' } };

      await expect(handler([badEvent] as never)).rejects.toThrow(/invalid event — messageObject.object must be a non-empty string/);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid event — messageObject.object must be a non-empty string')
      );
    });
  });

  describe('emailSender: SES send rejects', () => {
    it('logs error and re-throws the SES error', async () => {
      mockSesSend.mockRejectedValueOnce(new Error('MessageRejected'));

      await expect(
        sendEmail('to@example.com', 'Subject', 'Body')
      ).rejects.toThrow('MessageRejected');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SES SendEmailCommand failed'),
        expect.stringContaining('MessageRejected')
      );
    });

    it('logs String(err) when SES throws a non-Error value', async () => {
      mockSesSend.mockRejectedValueOnce('quota-string-error');

      await expect(sendEmail('to@example.com', 'Subject', 'Body')).rejects.toBe('quota-string-error');
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SES SendEmailCommand failed'),
        'quota-string-error'
      );
    });
  });

  describe('contentResolver: non-Error thrown by S3', () => {
    it('logs String(err) when S3 throws a non-Error value', async () => {
      mockS3Send.mockRejectedValueOnce('s3-string-error');

      await expect(
        resolveContent({ bucket: 'my-bucket', object: 'invite.json' })
      ).rejects.toBe('s3-string-error');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('S3 GetObjectCommand failed'),
        's3-string-error'
      );
    });
  });

  describe('handler: non-Error thrown by downstream service', () => {
    it('logs String(err) when resolveContent throws a non-Error value', async () => {
      // Drive through real contentResolver — S3 rejects with a plain string
      mockS3Send.mockRejectedValueOnce('downstream-string-error');

      await expect(
        handler([{ email: 'a@b.com', messageObject: { bucket: 'b', object: 'k' } }])
      ).rejects.toBe('downstream-string-error');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed to dispatch invitation email'),
        'downstream-string-error'
      );
    });
  });

  describe('partyResolver: DynamoDB GetItem rejects', () => {
    it('logs error and re-throws the DynamoDB error', async () => {
      mockDynamoSend.mockRejectedValueOnce(new Error('ResourceNotFoundException'));

      await expect(resolvePartyName('party-123')).rejects.toThrow('ResourceNotFoundException');
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('DynamoDB GetItem failed'),
        expect.stringContaining('ResourceNotFoundException')
      );
    });

    it('logs String(err) when DynamoDB throws a non-Error value', async () => {
      mockDynamoSend.mockRejectedValueOnce('dynamo-string-error');

      await expect(resolvePartyName('party-123')).rejects.toBe('dynamo-string-error');
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('DynamoDB GetItem failed'),
        'dynamo-string-error'
      );
    });
  });

  describe('handler: partyResolver rejects when eventIdentifier is set', () => {
    it('logs error and re-throws when DynamoDB fails during enrichment', async () => {
      // S3 returns valid content, then DynamoDB fails
      mockS3Send.mockResolvedValueOnce({
        Body: {
          transformToString: async () =>
            JSON.stringify({
              subject: "You've been invited to join <placeholder for the party name>",
              message: 'Body',
            }),
        },
      });
      mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

      await expect(
        handler([{
          email: 'a@b.com',
          messageObject: { bucket: 'secret-santa-rvw-emails', object: 'invitation.json' },
          eventIdentifier: 'party-abc',
        }])
      ).rejects.toThrow('DynamoDB unavailable');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed to dispatch invitation email'),
        expect.stringContaining('DynamoDB unavailable')
      );
    });
  });
});
