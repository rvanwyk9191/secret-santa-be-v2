import client from './client';
import {
  acceptPendingInvite,
  createAssignments,
  createInvitation,
  createParty,
  declinePendingInvite,
  deleteParty,
  emailAllMatches,
  emailMemberMatch,
  getMyHostedParties,
  getMyParties,
  getMyPendingInvites,
  lockParty,
  removeMember,
  revokeInvitation,
  saveGiftBlob,
  unlockParty,
  updateParty,
} from './partyApi';

jest.mock('./client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockClient = client as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

describe('party API requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ data: [] });
    mockClient.post.mockResolvedValue({ data: { party_id: 'p1' } });
    mockClient.patch.mockResolvedValue({ data: { party_id: 'p1' } });
    mockClient.delete.mockResolvedValue({ data: undefined });
  });

  it('fetches member, hosted, and pending invitation lists', async () => {
    await getMyParties();
    await getMyHostedParties();
    await getMyPendingInvites();

    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/me/parties');
    expect(mockClient.get).toHaveBeenNthCalledWith(2, '/me/hosted-parties');
    expect(mockClient.get).toHaveBeenNthCalledWith(3, '/me/pending-invites');
  });

  it('forwards party lifecycle requests and returns response data', async () => {
    const party = { party_id: 'p1' };
    const createPayload = { name: 'Holiday exchange', customizationEnabled: true };
    const updatePayload = { name: 'Updated exchange' };
    mockClient.post.mockResolvedValue({ data: party });
    mockClient.patch.mockResolvedValue({ data: party });

    await expect(createParty(createPayload)).resolves.toBe(party);
    await expect(updateParty('p1', updatePayload)).resolves.toBe(party);
    await expect(lockParty('p1')).resolves.toBe(party);
    await expect(unlockParty('p1')).resolves.toBe(party);

    expect(mockClient.post).toHaveBeenNthCalledWith(1, '/parties', createPayload);
    expect(mockClient.patch).toHaveBeenCalledWith('/parties/p1', updatePayload);
    expect(mockClient.post).toHaveBeenNthCalledWith(2, '/parties/p1/lock');
    expect(mockClient.post).toHaveBeenNthCalledWith(3, '/parties/p1/unlock');
  });

  it('accepts and declines invitations and sends party invitations', async () => {
    const member = { email: 'member@example.com', party_id: 'p1', role: 'member' as const, joined_at: '' };
    const invitation = { email: 'invitee@example.com' };
    mockClient.post.mockResolvedValue({ data: member });

    await expect(acceptPendingInvite('p1', 'token-1')).resolves.toBe(member);
    await declinePendingInvite('p1', 'token-2');
    await createInvitation('p1', invitation);

    expect(mockClient.post).toHaveBeenNthCalledWith(1, '/parties/p1/invitations/token-1/accept');
    expect(mockClient.post).toHaveBeenNthCalledWith(2, '/parties/p1/invitations/token-2/decline');
    expect(mockClient.post).toHaveBeenNthCalledWith(3, '/parties/p1/invitations', invitation);
  });

  it('removes members, revokes invitations, and deletes parties', async () => {
    await removeMember('p1', 'member+tag@example.com');
    await revokeInvitation('p1', 'invitee+tag@example.com');
    await deleteParty('p1');

    expect(mockClient.delete).toHaveBeenNthCalledWith(
      1,
      '/parties/p1/members/member%2Btag%40example.com'
    );
    expect(mockClient.delete).toHaveBeenNthCalledWith(
      2,
      '/parties/p1/invitations/invitee%2Btag%40example.com'
    );
    expect(mockClient.delete).toHaveBeenNthCalledWith(3, '/parties/p1');
  });

  it('saves gifts and creates assignments with their payloads', async () => {
    const member = { email: 'member@example.com', party_id: 'p1', role: 'member' as const, joined_at: '' };
    const giftPayload = { giftBlob: 'A book' };
    const assignmentPayload = {
      mode: 'manual' as const,
      assignments: [{ giverEmail: 'member@example.com', recipientEmail: 'other@example.com' }],
    };
    mockClient.post
      .mockResolvedValueOnce({ data: member })
      .mockResolvedValueOnce({ data: [] });

    await expect(saveGiftBlob('p1', 'member+tag@example.com', giftPayload)).resolves.toBe(member);
    await expect(createAssignments('p1', assignmentPayload)).resolves.toEqual([]);

    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/parties/p1/members/member%2Btag%40example.com/gifts',
      giftPayload
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/parties/p1/assignments',
      assignmentPayload
    );
  });

  it('sends match emails to all members or an encoded individual member', async () => {
    await emailAllMatches('p1');
    await emailMemberMatch('p1', 'member+tag@example.com');

    expect(mockClient.post).toHaveBeenNthCalledWith(1, '/parties/p1/email-matches');
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/parties/p1/members/member%2Btag%40example.com/email-match'
    );
  });
});