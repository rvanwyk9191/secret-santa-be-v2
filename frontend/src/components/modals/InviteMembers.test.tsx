import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InviteMembers from './InviteMembers';

jest.mock('../../api/partyApi', () => ({
  createInvitation: jest.fn(),
}));

import { createInvitation } from '../../api/partyApi';
const mockCreateInvitation = createInvitation as jest.MockedFunction<typeof createInvitation>;

describe('InviteMembers', () => {
  const defaultProps = {
    open: true,
    partyId: 'p1',
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header and title', () => {
    render(<InviteMembers {...defaultProps} />);
    expect(screen.getByText('Invite Members')).toBeInTheDocument();
    expect(screen.getByText('Invite Members to the Party')).toBeInTheDocument();
  });

  it('renders one email field by default', () => {
    render(<InviteMembers {...defaultProps} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('Secret Santa #1')).toBeInTheDocument();
  });

  it('adds a new field when Add is clicked', async () => {
    const user = userEvent.setup();
    render(<InviteMembers {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByLabelText('Secret Santa #2')).toBeInTheDocument();
  });

  it('removes a field when Remove is clicked with multiple rows', async () => {
    const user = userEvent.setup();
    render(<InviteMembers {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /add/i }));
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]!);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('disables Remove when only one row remains', () => {
    render(<InviteMembers {...defaultProps} />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
  });

  it('calls createInvitation once per non-empty email on Invite', async () => {
    const user = userEvent.setup();
    mockCreateInvitation.mockResolvedValue(undefined);
    render(<InviteMembers {...defaultProps} />);
    await user.type(screen.getByLabelText('Secret Santa #1'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: /add/i }));
    await user.type(screen.getByLabelText('Secret Santa #2'), 'b@example.com');
    await user.click(screen.getByRole('button', { name: /^invite$/i }));
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
    expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
    expect(mockCreateInvitation).toHaveBeenCalledWith('p1', { email: 'a@example.com' });
    expect(mockCreateInvitation).toHaveBeenCalledWith('p1', { email: 'b@example.com' });
  });

  it('shows an error when an invitation fails', async () => {
    const user = userEvent.setup();
    mockCreateInvitation.mockRejectedValueOnce(new Error('fail'));
    render(<InviteMembers {...defaultProps} />);
    await user.type(screen.getByLabelText('Secret Santa #1'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: /^invite$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose without API call when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<InviteMembers {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('is not visible when open is false', () => {
    render(<InviteMembers {...defaultProps} open={false} />);
    expect(screen.queryByText('Invite Members')).not.toBeInTheDocument();
  });
});
