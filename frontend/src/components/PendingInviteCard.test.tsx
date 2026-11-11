import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PendingInviteCard from './PendingInviteCard';
import { acceptPendingInvite, declinePendingInvite } from '../api/partyApi';
import type { PendingInvite } from '../types/api';

jest.mock('../api/partyApi', () => ({
  acceptPendingInvite: jest.fn(),
  declinePendingInvite: jest.fn(),
}));

const mockAccept = acceptPendingInvite as jest.MockedFunction<typeof acceptPendingInvite>;
const mockDecline = declinePendingInvite as jest.MockedFunction<typeof declinePendingInvite>;

const invite: PendingInvite = {
  party_id: 'p1',
  party_name: 'Holiday exchange',
  admin_email: 'host@example.com',
  party_date: '2026-12-24T12:00:00.000Z',
  token: 'invite-token',
  sent_at: '2026-11-01T12:00:00.000Z',
};

describe('PendingInviteCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the invitation details and date', () => {
    render(<PendingInviteCard invite={invite} onRefresh={jest.fn()} />);

    expect(screen.getByText('Holiday exchange')).toBeInTheDocument();
    expect(screen.getByText('Hosted By: host@example.com')).toBeInTheDocument();
    expect(screen.getByText(/^Date:/)).toBeInTheDocument();
  });

  it('accepts an invite and refreshes the party list', async () => {
    const onRefresh = jest.fn();
    mockAccept.mockResolvedValueOnce({
      email: 'member@example.com',
      party_id: 'p1',
      role: 'member',
      joined_at: '',
    });
    render(<PendingInviteCard invite={invite} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith('p1', 'invite-token');
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error when accepting an invite fails', async () => {
    mockAccept.mockRejectedValueOnce(new Error('request failed'));
    render(<PendingInviteCard invite={invite} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to accept invite. Please try again.'
    );
  });

  it('declines an invite and refreshes the party list', async () => {
    const onRefresh = jest.fn();
    mockDecline.mockResolvedValueOnce(undefined);
    render(<PendingInviteCard invite={invite} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    await waitFor(() => {
      expect(mockDecline).toHaveBeenCalledWith('p1', 'invite-token');
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error when declining an invite fails', async () => {
    mockDecline.mockRejectedValueOnce(new Error('request failed'));
    render(<PendingInviteCard invite={invite} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to decline invite. Please try again.'
    );
  });
});