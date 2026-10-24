import express from 'express';
import supertest from 'supertest';
import { updateProfile, getProfile } from '../../backend/src/services/profileService.js';
import { saveGiftBlob } from '../../backend/src/services/giftService.js';
import profileRouter from '../../backend/src/controllers/profileController.js';
import giftRouter from '../../backend/src/controllers/giftController.js';

jest.mock('../../backend/src/utils/dynamodb.js', () => ({
  dynamoClient: { send: jest.fn() },
}));

jest.mock('../../backend/src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { dynamoClient } = jest.requireMock('../../backend/src/utils/dynamodb.js') as {
  dynamoClient: { send: jest.Mock };
};

// ── Helper: build a minimal express app that injects req.auth and mounts both routers ──
function buildTestApp(registeredEmail: string | null) {
  const app = express();
  app.use(express.json());
  // Simulate checkJwt middleware: inject auth payload
  app.use((req, _res, next) => {
    if (registeredEmail !== null) {
      (req as any).auth = { registered_user_email: registeredEmail };
    }
    next();
  });
  app.use(profileRouter);
  app.use(giftRouter);
  // Error handler mirrors the global one in index.ts
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = (err as any).statusCode ?? 500;
      res.status(status).json({ error: { message: (err as Error).message } });
    }
  );
  return app;
}

describe('Profile update integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update blank first_name and last_name', async () => {
    // GetCommand returns member with no first_name or last_name
    dynamoClient.send
      .mockResolvedValueOnce({
        Item: {
          email: 'member@example.com',
          party_id: 'party-123',
          role: 'member',
          joined_at: '2026-01-01T00:00:00.000Z',
        },
      })
      // UpdateCommand succeeds
      .mockResolvedValueOnce({});

    const result = await updateProfile('party-123', 'member@example.com', {
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Doe');
    expect(result.email).toBe('member@example.com');
    expect(result.party_id).toBe('party-123');
  });

  it('should not overwrite existing non-blank first_name', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({
        Item: {
          email: 'member@example.com',
          party_id: 'party-123',
          role: 'member',
          joined_at: '2026-01-01T00:00:00.000Z',
          first_name: 'ExistingName',
        },
      })
      .mockResolvedValueOnce({});

    const result = await updateProfile('party-123', 'member@example.com', {
      firstName: 'NewName',
      lastName: 'Doe',
    });

    // first_name should NOT be overwritten
    expect(result.first_name).toBe('ExistingName');
    // last_name WAS blank, so it gets updated
    expect(result.last_name).toBe('Doe');
  });

  it('should return the member unchanged when no blank fields to update', async () => {
    dynamoClient.send.mockResolvedValueOnce({
      Item: {
        email: 'member@example.com',
        party_id: 'party-123',
        role: 'member',
        joined_at: '2026-01-01T00:00:00.000Z',
        first_name: 'Jane',
        last_name: 'Doe',
      },
    });

    const result = await updateProfile('party-123', 'member@example.com', {
      firstName: 'Ignored',
      lastName: 'Ignored',
    });

    // No UpdateCommand sent — member returned as-is
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Doe');
  });

  it('should throw 404 when member not found', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    await expect(
      updateProfile('party-123', 'missing@example.com', { firstName: 'Jane' })
    ).rejects.toMatchObject({ message: 'Party member not found.', statusCode: 404 });
  });
});

describe('Gift blob integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save a gift blob when customization is enabled', async () => {
    // GetCommand for party
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { party_id: 'party-123', customizationEnabled: true } })
      // GetCommand for member
      .mockResolvedValueOnce({
        Item: {
          email: 'member@example.com',
          party_id: 'party-123',
          role: 'member',
          joined_at: '2026-01-01T00:00:00.000Z',
        },
      })
      // UpdateCommand succeeds
      .mockResolvedValueOnce({});

    const result = await saveGiftBlob('party-123', 'member@example.com', 'I want a telescope');

    expect(result.email).toBe('member@example.com');
    expect(result.party_id).toBe('party-123');
    expect(result.gift_blob).toBe('I want a telescope');
  });

  it('should throw 403 when customization is disabled', async () => {
    dynamoClient.send.mockResolvedValueOnce({
      Item: { party_id: 'party-123', customizationEnabled: false },
    });

    await expect(
      saveGiftBlob('party-123', 'member@example.com', 'I want a book')
    ).rejects.toMatchObject({
      message: 'Gift customization is not enabled for this party.',
      statusCode: 403,
    });
  });

  it('should throw 404 when party not found', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    await expect(
      saveGiftBlob('missing-party', 'member@example.com', 'gift')
    ).rejects.toMatchObject({ message: 'Party not found.', statusCode: 404 });
  });

  it('should throw 404 when member not found', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { party_id: 'party-123', customizationEnabled: true } })
      .mockResolvedValueOnce({ Item: undefined });

    await expect(
      saveGiftBlob('party-123', 'ghost@example.com', 'gift')
    ).rejects.toMatchObject({ message: 'Party member not found.', statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getProfile service integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the full PartyMember record including gift_blob', async () => {
    dynamoClient.send.mockResolvedValueOnce({
      Item: {
        email: 'member@example.com',
        party_id: 'party-123',
        role: 'member',
        joined_at: '2026-01-01T00:00:00.000Z',
        first_name: 'Jane',
        last_name: 'Doe',
        gift_blob: 'I want a telescope',
      },
    });

    const result = await getProfile('party-123', 'member@example.com');

    expect(result.email).toBe('member@example.com');
    expect(result.party_id).toBe('party-123');
    expect(result.role).toBe('member');
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Doe');
    expect(result.gift_blob).toBe('I want a telescope');
  });

  it('should return the member without gift_blob when none has been submitted', async () => {
    dynamoClient.send.mockResolvedValueOnce({
      Item: {
        email: 'member@example.com',
        party_id: 'party-123',
        role: 'member',
        joined_at: '2026-01-01T00:00:00.000Z',
      },
    });

    const result = await getProfile('party-123', 'member@example.com');

    expect(result.gift_blob).toBeUndefined();
  });

  it('should throw 404 when member not found', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    await expect(
      getProfile('party-123', 'ghost@example.com')
    ).rejects.toMatchObject({ message: 'Party member not found.', statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Member Self-Authorization enforcement (constitution v1.15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /profile ──────────────────────────────────────────────────────────

  it('GET profile returns 403 when caller email does not match member_id', async () => {
    const app = buildTestApp('other@example.com');
    const res = await supertest(app)
      .get('/parties/party-123/members/member%40example.com/profile');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Forbidden/);
    // Service must NOT be called
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('GET profile returns 401 when no email claim in token', async () => {
    const app = buildTestApp(null);
    const res = await supertest(app)
      .get('/parties/party-123/members/member%40example.com/profile');

    expect(res.status).toBe(401);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('GET profile returns 200 when caller email matches member_id', async () => {
    dynamoClient.send.mockResolvedValueOnce({
      Item: {
        email: 'member@example.com',
        party_id: 'party-123',
        role: 'member',
        joined_at: '2026-01-01T00:00:00.000Z',
      },
    });

    const app = buildTestApp('member@example.com');
    const res = await supertest(app)
      .get('/parties/party-123/members/member%40example.com/profile');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('member@example.com');
  });

  it('GET profile returns 404 when member does not exist', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    const app = buildTestApp('member@example.com');
    const res = await supertest(app)
      .get('/parties/party-123/members/member%40example.com/profile');

    expect(res.status).toBe(404);
  });

  // ── PUT /profile ──────────────────────────────────────────────────────────

  it('PUT profile returns 403 when caller email does not match member_id', async () => {
    const app = buildTestApp('other@example.com');
    const res = await supertest(app)
      .put('/parties/party-123/members/member%40example.com/profile')
      .send({ firstName: 'Hacker' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Forbidden/);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('PUT profile returns 401 when no email claim in token', async () => {
    const app = buildTestApp(null);
    const res = await supertest(app)
      .put('/parties/party-123/members/member%40example.com/profile')
      .send({ firstName: 'Jane' });

    expect(res.status).toBe(401);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  // ── POST /gifts ───────────────────────────────────────────────────────────

  it('POST gifts returns 403 when caller email does not match member_id', async () => {
    const app = buildTestApp('other@example.com');
    const res = await supertest(app)
      .post('/parties/party-123/members/member%40example.com/gifts')
      .send({ giftBlob: 'a telescope' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Forbidden/);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('POST gifts returns 401 when no email claim in token', async () => {
    const app = buildTestApp(null);
    const res = await supertest(app)
      .post('/parties/party-123/members/member%40example.com/gifts')
      .send({ giftBlob: 'a telescope' });

    expect(res.status).toBe(401);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });
});
