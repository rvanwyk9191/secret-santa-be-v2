import express from 'express';
import type { ErrorRequestHandler } from 'express';
import request from 'supertest';
import meRouter from '../../backend/src/controllers/meController.js';
import { getAccountProfile, completeAccountProfile } from '../../backend/src/services/accountProfileService.js';

jest.mock('../../backend/src/services/accountProfileService.js', () => ({
  getAccountProfile: jest.fn(), completeAccountProfile: jest.fn(),
}));
jest.mock('../../backend/src/utils/dynamodb.js', () => ({ dynamoClient: { send: jest.fn() } }));

const email = 'santa@example.com';
const profile = { email, first_name: 'Santa', last_name: 'Claus' };
const payload = { firstName: 'Santa', lastName: 'Claus' };
const route = '/api/me/profile';

function app(authenticated = true) {
  const server = express();
  server.use(express.json(), (req, _res, next) => {
    if (authenticated) Object.assign(req, { auth: { payload: { registered_user_email: email } } });
    next();
  });
  server.use('/api', meRouter);
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.statusCode ?? error.status ?? 500;
    res.status(status).json({ error: { message: status === 500 ? 'Internal server error' : error.message } });
  };
  server.use(errors);
  return server;
}

beforeEach(() => jest.clearAllMocks());

it('returns only the caller profile, including explicit nulls, without caching', async () => {
  const incomplete = { email, first_name: null, last_name: null };
  jest.mocked(getAccountProfile).mockResolvedValueOnce(incomplete);
  await request(app()).get(route).expect('Cache-Control', 'no-store').expect(200, incomplete);
  expect(getAccountProfile).toHaveBeenCalledWith(email);
});

it('returns a controlled failure when profile storage is unavailable', async () => {
  jest.mocked(getAccountProfile).mockRejectedValueOnce(new Error('Unavailable'));
  await request(app()).get(route).expect(500, { error: { message: 'Internal server error' } });
});

it.each(['https://localhost:3000', 'https://santa.example.com'])('accepts Save from the configured browser origin %s', async origin => {
  const env = jest.replaceProperty(process, 'env', { ...process.env, BASE_URL: origin });
  try {
    jest.mocked(completeAccountProfile).mockResolvedValueOnce(profile);
    await request(app()).put(route).set('Origin', origin).set('Host', '127.0.0.1:8080')
      .send(payload).expect('Cache-Control', 'no-store').expect(200, profile);
    expect(completeAccountProfile).toHaveBeenCalledWith(email, 'Santa', 'Claus');
  } finally {
    env.restore();
  }
});

it('rejects missing identity, foreign origins, and payloads specifying another account', async () => {
  const origin = 'https://localhost:3000';
  const env = jest.replaceProperty(process, 'env', { ...process.env, BASE_URL: origin });
  try {
    await request(app(false)).put(route).set('Origin', origin).send(payload).expect(401);
    await request(app()).put(route).set('Origin', 'https://other.example.com').send(payload).expect(403);
    await request(app()).put(route).set('Origin', origin).type('text').send('Santa Claus').expect(415);
    await request(app()).put(route).set('Origin', origin).send({ ...payload, email: 'other@example.com' }).expect(400);
    await request(app()).put(route).set('Origin', origin).send({ ...payload, firstName: '  ' }).expect(400);
    expect(completeAccountProfile).not.toHaveBeenCalled();
  } finally {
    env.restore();
  }
});
