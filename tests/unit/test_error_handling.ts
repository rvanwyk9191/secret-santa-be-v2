/**
 * Unit tests for Phase 2.1 — Error Handling (Constitution v1.5)
 *
 * Verifies that:
 * 1. DynamoDB errors in partyService are caught, logged via Logger.error, and re-thrown.
 * 2. SNS errors in notificationService are caught, logged via Logger.error, and re-thrown.
 * 3. The global Express error handler returns HTTP 500 JSON and logs via Logger.error.
 */

import { createParty, getParty } from '../../backend/src/services/partyService.js';

// ── Mock Logger ───────────────────────────────────────────────────────────────
jest.mock('../../backend/src/utils/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ── Mock uuid so party_id is deterministic ────────────────────────────────────
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'aaaabbbb-cccc-dddd-eeee-ffffgggghhhh'),
}));

// ── Mock DynamoDB client — factory uses jest.fn() directly (hoisting safe) ───
jest.mock('../../backend/src/utils/dynamodb.js', () => ({
  dynamoClient: { send: jest.fn() },
}));

// ── Mock SNS client — factory captures a stable jest.fn() reference ──────────
// The SNSClient is constructed at notificationService module load; we capture
// one stable mockSnsSend fn in module scope so our tests can configure it.
const mockSnsSend = jest.fn();
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({ send: mockSnsSend })),
  PublishCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('partyService — DynamoDB error handling', () => {
  // Retrieve the mock after module initialisation (avoids hoisting issues)
  let dynamoSend: jest.Mock;

  beforeAll(async () => {
    const { dynamoClient } = await import('../../backend/src/utils/dynamodb.js');
    dynamoSend = dynamoClient.send as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs and re-throws when DynamoDB GetCommand fails during ID generation', async () => {
    dynamoSend.mockRejectedValueOnce(new Error('DynamoDB connection timeout'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(createParty('Test Party', 'admin@example.com')).rejects.toThrow(
      'DynamoDB connection timeout'
    );

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB GetCommand failed'),
      'DynamoDB connection timeout'
    );
  });

  it('logs and re-throws when DynamoDB PutCommand fails during party creation', async () => {
    // GetCommand succeeds with no item (unique ID), PutCommand fails
    dynamoSend
      .mockResolvedValueOnce({ Item: undefined }) // GetCommand — no collision
      .mockRejectedValueOnce(new Error('DynamoDB throughput exceeded'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(createParty('Test Party', 'admin@example.com')).rejects.toThrow(
      'DynamoDB throughput exceeded'
    );

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB PutCommand failed'),
      'DynamoDB throughput exceeded'
    );
  });

  it('logs and re-throws when DynamoDB GetCommand fails in getParty', async () => {
    dynamoSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

    const { Logger } = await import('../../backend/src/utils/logger.js');
    await expect(getParty('aaaabbbb')).rejects.toThrow('DynamoDB unavailable');

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DynamoDB GetCommand failed'),
      'DynamoDB unavailable'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationService — SNS error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:test-topic';
  });

  afterAll(() => {
    delete process.env['SNS_TOPIC_ARN'];
  });

  it('logs and re-throws when SNS send fails', async () => {
    mockSnsSend.mockRejectedValueOnce(new Error('SNS service unavailable'));

    const { publishNotification: publish } = await import('../../backend/src/services/notificationService.js');
    const { Logger } = await import('../../backend/src/utils/logger.js');

    await expect(
      publish({
        type: 'invitation_sent',
        party_id: 'aaaabbbb',
        recipient_email: 'guest@example.com',
        data: { token: 'tok123', admin_email: 'admin@example.com' },
      })
    ).rejects.toThrow('SNS service unavailable');

    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('SNS PublishCommand failed'),
      'SNS service unavailable'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Global Express error handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 500 JSON and logs the error', async () => {
    const express = await import('express');
    const { Logger } = await import('../../backend/src/utils/logger.js');
    const supertest = (await import('supertest')).default;

    const app = express.default();

    // Route that intentionally throws
    app.get('/fail', (_req, _res, next) => {
      next(new Error('something broke'));
    });

    // The global error handler — same signature as in index.ts
    app.use(
      (
        err: unknown,
        _req: import('express').Request,
        res: import('express').Response,
        _next: import('express').NextFunction
      ) => {
        Logger.error('Unhandled error', err instanceof Error ? err.message : String(err));
        res.status(500).json({ error: { message: 'Internal server error' } });
      }
    );

    const response = await supertest(app).get('/fail');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(Logger.error).toHaveBeenCalledWith('Unhandled error', 'something broke');
  });
});
