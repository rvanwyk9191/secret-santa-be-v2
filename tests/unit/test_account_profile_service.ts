import { getAccountProfile, completeAccountProfile } from '../../backend/src/services/accountProfileService.js';
import { dynamoClient } from '../../backend/src/utils/dynamodb.js';

jest.mock('../../backend/src/utils/dynamodb.js', () => ({ dynamoClient: { send: jest.fn() } }));
const send = jest.mocked(dynamoClient.send);
const email = 'santa@example.com';

beforeEach(() => send.mockReset());

it('resolves each legacy name independently across all pages without writing', async () => {
  const key = { email, party_id: 'p1' };
  send.mockResolvedValueOnce({ Item: { email, first_name: ' Santa ' } })
    .mockResolvedValueOnce({ Items: [{ first_name: 'Different', last_name: ' Claus ' }], LastEvaluatedKey: key })
    .mockResolvedValueOnce({ Items: [{ last_name: 'Claus' }] });
  await expect(getAccountProfile(email.toUpperCase())).resolves.toEqual({ email, first_name: 'Santa', last_name: 'Claus' });
  expect(send.mock.calls[2]?.[0].input).toMatchObject({ ExclusiveStartKey: key });
  expect(send).toHaveBeenCalledTimes(3);
});

it('does not guess between conflicting legacy names', async () => {
  send.mockResolvedValueOnce({}).mockResolvedValueOnce({ Items: [{ first_name: 'Santa' }, { first_name: 'Kris' }] });
  await expect(getAccountProfile(email)).resolves.toEqual({ email, first_name: null, last_name: null });
});

it('writes a complete profile for a user with no parties', async () => {
  send.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
  const item = { email, first_name: 'Élodie', last_name: "O’Neil" };
  await expect(completeAccountProfile(email, ' Élodie ', " O’Neil ")).resolves.toEqual(item);
  expect(send.mock.calls[2]?.[0].input).toMatchObject({ Item: item, ConditionExpression: 'attribute_not_exists(email)' });
});

it('guards the observed fields of a partially stored profile and skips writes once complete', async () => {
  const partial = { email, first_name: 'Kris' };
  const completed = { ...partial, last_name: 'Kringle' };
  send.mockResolvedValueOnce({ Item: partial }).mockResolvedValueOnce({}).mockResolvedValueOnce({})
    .mockResolvedValueOnce({ Item: completed });
  await expect(completeAccountProfile(email, 'Kris', 'Kringle')).resolves.toEqual(completed);
  expect(send.mock.calls[2]?.[0].input).toMatchObject({
    Item: completed,
    ConditionExpression: 'attribute_exists(email) AND first_name = :first_name AND attribute_not_exists(last_name)',
    ExpressionAttributeValues: { ':first_name': 'Kris' },
  });
  await expect(completeAccountProfile(email, 'Kris', 'Kringle')).resolves.toEqual(completed);
  expect(send).toHaveBeenCalledTimes(4);
});

it.each([true, false])('handles competing saves (same names: %s)', async (same) => {
  const item = { email, first_name: 'Santa', last_name: same ? 'Claus' : 'Other' };
  send.mockResolvedValueOnce({}).mockResolvedValueOnce({})
    .mockRejectedValueOnce(Object.assign(new Error('conflict'), { name: 'ConditionalCheckFailedException' }))
    .mockResolvedValueOnce({ Item: item });
  const saving = completeAccountProfile(email, 'Santa', 'Claus');
  if (same) await expect(saving).resolves.toEqual(item);
  else await expect(saving).rejects.toMatchObject({ statusCode: 409 });
});

it('does not treat a failed database read as missing data', async () => {
  send.mockRejectedValueOnce(new Error('storage offline'));
  await expect(getAccountProfile(email)).rejects.toThrow('storage offline');
  expect(send).toHaveBeenCalledTimes(1);
});
