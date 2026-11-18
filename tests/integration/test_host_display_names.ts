import express from 'express';
import request from 'supertest';
import meRouter from '../../backend/src/controllers/meController.js';
import pendingInvitesRouter from '../../backend/src/controllers/pendingInvitesController.js';
import { dynamoClient } from '../../backend/src/utils/dynamodb.js';

jest.mock('../../backend/src/utils/dynamodb.js', () => ({ dynamoClient: { send: jest.fn() } }));
const send = jest.mocked(dynamoClient.send);
const email = 'viewer@example.com';
const host = 'host@example.com';
const server = express();
server.use((req, _res, next) => {
  Object.assign(req, { auth: { payload: { registered_user_email: email } } });
  next();
});
server.use('/api', meRouter, pendingInvitesRouter);

beforeEach(() => send.mockReset());

it('lists the host rather than the member and deduplicates lookups for the same host', async () => {
  send.mockResolvedValueOnce({ Items: [{ email, party_id: 'p1' }, { email, party_id: 'p2' }] })
    .mockResolvedValueOnce({ Item: { party_id: 'p1', admin_email: host } })
    .mockResolvedValueOnce({ Item: { party_id: 'p2', admin_email: host } })
    .mockResolvedValueOnce({}).mockResolvedValueOnce({})
    .mockResolvedValueOnce({ Item: { first_name: 'Kris', last_name: 'Kringle' } });
  const { body } = await request(server).get('/api/me/parties').expect(200);
  expect(body.map((entry: { host_display_name?: string }) => entry.host_display_name)).toEqual(['Kris Kringle', 'Kris Kringle']);
  const profiles = send.mock.calls.filter(([command]) => command.input.TableName === 'UserProfiles');
  expect(profiles).toHaveLength(1);
  expect(profiles[0]?.[0].input).toMatchObject({ Key: { email: host } });
});

it.each(['complete', 'partial', 'failed'])('enriches pending invitations when the host profile is %s', async state => {
  send.mockResolvedValueOnce({ Items: [{ party_id: 'p1', token: 't', sent_at: '' }] })
    .mockResolvedValueOnce({ Item: { name: 'Holiday Party', admin_email: host } });
  if (state === 'complete') send.mockResolvedValueOnce({ Item: { first_name: 'Kris', last_name: 'Kringle' } });
  else if (state === 'partial') send.mockResolvedValueOnce({ Item: { first_name: 'Kris' } }).mockResolvedValueOnce({});
  else send.mockRejectedValueOnce(new Error('Unavailable'));

  const { body } = await request(server).get('/api/me/pending-invites').expect(200);
  expect(body[0]).toMatchObject({ admin_email: host, token: 't' });
  if (state === 'complete') expect(body[0].host_display_name).toBe('Kris Kringle');
  else expect(body[0]).not.toHaveProperty('host_display_name');
});
