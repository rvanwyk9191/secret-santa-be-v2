import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberRow from './MemberRow';

jest.mock('../api/partyApi', () => ({
  removeMember: jest.fn(),
  emailMemberMatch: jest.fn(),
}));

import { removeMember, emailMemberMatch } from '../api/partyApi';
const mockRemoveMember = removeMember as jest.MockedFunction<typeof removeMember>;
const mockEmailMemberMatch = emailMemberMatch as jest.MockedFunction<typeof emailMemberMatch>;

const baseMember = {
  email: 'member@example.com',
  party_id: 'p1',
  role: 'member' as const,
  first_name: 'Cookie',
  last_name: 'Monster',
  joined_at: '',
};

const baseAssignment = {
  recipient_email: 'elmo@example.com',
  recipient_first_name: 'Elmo',
  recipient_last_name: 'Red',
};

describe('MemberRow', () => {
  const defaultProps = {
    partyId: 'p1',
    member: baseMember,
    onRemoved: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the member display name', () => {
    render(<MemberRow {...defaultProps} />);
    expect(screen.getByText('Cookie Monster')).toBeInTheDocument();
  });

  it('falls back to email when name is absent', () => {
    const member = { ...baseMember, first_name: undefined, last_name: undefined };
    render(<MemberRow {...defaultProps} member={member} />);
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
  });

  it('does not show Peek when there is no assignment', () => {
    render(<MemberRow {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /peek/i })).not.toBeInTheDocument();
  });

  it('shows Peek button when an assignment is present', () => {
    render(<MemberRow {...defaultProps} assignment={baseAssignment} />);
    expect(screen.getByRole('button', { name: /peek/i })).toBeInTheDocument();
  });

  it('toggles match name display when Peek/Hide is clicked', async () => {
    const user = userEvent.setup();
    render(<MemberRow {...defaultProps} assignment={baseAssignment} />);

    await user.click(screen.getByRole('button', { name: /peek/i }));
    expect(screen.getByText('Cookie Monster – Match is Elmo Red')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide/i }));
    expect(screen.getByText('Cookie Monster')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /peek/i })).toBeInTheDocument();
  });

  it('calls removeMember and onRemoved when Remove is clicked', async () => {
    const user = userEvent.setup();
    mockRemoveMember.mockResolvedValueOnce(undefined);
    render(<MemberRow {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(defaultProps.onRemoved).toHaveBeenCalled());
    expect(mockRemoveMember).toHaveBeenCalledWith('p1', 'member@example.com');
  });

  it('calls emailMemberMatch when Email Match is clicked', async () => {
    const user = userEvent.setup();
    mockEmailMemberMatch.mockResolvedValueOnce(undefined);
    render(<MemberRow {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /email match/i }));
    await waitFor(() => expect(mockEmailMemberMatch).toHaveBeenCalledWith('p1', 'member@example.com'));
  });

  it('shows an error alert when emailMemberMatch fails', async () => {
    const user = userEvent.setup();
    mockEmailMemberMatch.mockRejectedValueOnce(new Error('fail'));
    render(<MemberRow {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /email match/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
