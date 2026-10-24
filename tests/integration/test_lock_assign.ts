import express from 'express';
import supertest from 'supertest';
import { lockParty } from '../../backend/src/services/partyLockService.js';
import { createAssignments } from '../../backend/src/services/assignmentService.js';
import partyLockRouter from '../../backend/src/controllers/partyLockController.js';
import assignmentRouter from '../../backend/src/controllers/assignmentController.js';

jest.mock('../../backend/src/utils/dynamodb.js', () => ({
  dynamoClient: { send: jest.fn() },
}));

jest.mock('../../backend/src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../backend/src/services/notificationService.js', () => ({
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));

const { dynamoClient } = jest.requireMock('../../backend/src/utils/dynamodb.js') as {
  dynamoClient: { send: jest.Mock };
};

const { publishNotification } = jest.requireMock(
  '../../backend/src/services/notificationService.js'
) as { publishNotification: jest.Mock };

// ── Helper: build a minimal express app that injects req.auth ──
function buildTestApp(registeredEmail: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (registeredEmail !== null) {
      (req as any).auth = { registered_user_email: registeredEmail };
    }
    next();
  });
  app.use(partyLockRouter);
  app.use(assignmentRouter);
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

const lockedParty = {
  party_id: 'party-abc',
  name: 'Test Party',
  admin_email: 'admin@example.com',
  customizationEnabled: false,
  locked: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('lockParty service integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should lock an unlocked party and return the updated record', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty } }) // GetCommand
      .mockResolvedValueOnce({});                          // UpdateCommand

    const result = await lockParty('party-abc', 'admin@example.com');

    expect(result.locked).toBe(true);
    expect(result.party_id).toBe('party-abc');
    expect(publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'party_locked', party_id: 'party-abc' })
    );
  });

  it('should throw 403 when caller is not the admin', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty } });

    await expect(
      lockParty('party-abc', 'notadmin@example.com')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('should throw 409 when party is already locked', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } });

    await expect(
      lockParty('party-abc', 'admin@example.com')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should throw 404 when party does not exist', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    await expect(
      lockParty('missing-party', 'admin@example.com')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/parties/:party_id/lock controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with locked party', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty } })
      .mockResolvedValueOnce({});

    const app = buildTestApp('admin@example.com');
    const res = await supertest(app).post('/parties/party-abc/lock');

    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
  });

  it('should return 401 when no auth claim', async () => {
    const app = buildTestApp(null);
    const res = await supertest(app).post('/parties/party-abc/lock');
    expect(res.status).toBe(401);
  });

  it('should return 403 when caller is not admin', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty } });

    const app = buildTestApp('other@example.com');
    const res = await supertest(app).post('/parties/party-abc/lock');
    expect(res.status).toBe(403);
  });

  it('should return 409 when party is already locked', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } });

    const app = buildTestApp('admin@example.com');
    const res = await supertest(app).post('/parties/party-abc/lock');
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const members = [
  { email: 'alice@example.com', party_id: 'party-abc', role: 'member', joined_at: '2026-01-01T00:00:00.000Z' },
  { email: 'bob@example.com', party_id: 'party-abc', role: 'member', joined_at: '2026-01-01T00:00:00.000Z' },
  { email: 'carol@example.com', party_id: 'party-abc', role: 'member', joined_at: '2026-01-01T00:00:00.000Z' },
];

describe('createAssignments service integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create automatic assignments for a locked party', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } }) // GetCommand (party)
      .mockResolvedValueOnce({ Items: members })                          // QueryCommand (members)
      .mockResolvedValue({});                                             // PutCommand x3

    const result = await createAssignments('party-abc', 'admin@example.com', 'automatic');

    expect(result).toHaveLength(3);
    const givers = result.map(a => a.giver_email);
    const recipients = result.map(a => a.recipient_email);
    // All unique givers and recipients
    expect(new Set(givers).size).toBe(3);
    expect(new Set(recipients).size).toBe(3);
    // No self-assignments
    result.forEach(a => expect(a.giver_email).not.toBe(a.recipient_email));
    expect(publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'assignment_completed' })
    );
  });

  it('should create manual assignments when valid pairs are provided', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } })
      .mockResolvedValueOnce({ Items: members })
      .mockResolvedValue({});

    const result = await createAssignments('party-abc', 'admin@example.com', 'manual', [
      { giverEmail: 'alice@example.com', recipientEmail: 'bob@example.com' },
      { giverEmail: 'bob@example.com', recipientEmail: 'carol@example.com' },
      { giverEmail: 'carol@example.com', recipientEmail: 'alice@example.com' },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]!.giver_email).toBe('alice@example.com');
    expect(result[0]!.recipient_email).toBe('bob@example.com');
  });

  it('should throw 422 when party is not locked', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty, locked: false } });

    await expect(
      createAssignments('party-abc', 'admin@example.com', 'automatic')
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('should throw 403 when caller is not the admin', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } });

    await expect(
      createAssignments('party-abc', 'other@example.com', 'automatic')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('should throw 404 when party not found', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: undefined });

    await expect(
      createAssignments('missing', 'admin@example.com', 'automatic')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw 422 on self-assignment in manual mode', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } })
      .mockResolvedValueOnce({ Items: members });

    await expect(
      createAssignments('party-abc', 'admin@example.com', 'manual', [
        { giverEmail: 'alice@example.com', recipientEmail: 'alice@example.com' },
      ])
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/parties/:party_id/assignments controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 201 with assignments array', async () => {
    dynamoClient.send
      .mockResolvedValueOnce({ Item: { ...lockedParty, locked: true } })
      .mockResolvedValueOnce({ Items: members })
      .mockResolvedValue({});

    const app = buildTestApp('admin@example.com');
    const res = await supertest(app)
      .post('/parties/party-abc/assignments')
      .send({ mode: 'automatic' });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('should return 400 when mode is invalid', async () => {
    const app = buildTestApp('admin@example.com');
    const res = await supertest(app)
      .post('/parties/party-abc/assignments')
      .send({ mode: 'random' });

    expect(res.status).toBe(400);
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('should return 401 when no auth claim', async () => {
    const app = buildTestApp(null);
    const res = await supertest(app)
      .post('/parties/party-abc/assignments')
      .send({ mode: 'automatic' });
    expect(res.status).toBe(401);
  });

  it('should return 422 when party is not locked', async () => {
    dynamoClient.send.mockResolvedValueOnce({ Item: { ...lockedParty, locked: false } });

    const app = buildTestApp('admin@example.com');
    const res = await supertest(app)
      .post('/parties/party-abc/assignments')
      .send({ mode: 'automatic' });
    expect(res.status).toBe(422);
  });
});
