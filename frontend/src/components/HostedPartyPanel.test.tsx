import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HostedPartyPanel from './HostedPartyPanel';
import type { HostedPartyEntry } from '../types/api';

jest.mock('../api/partyApi', () => ({
  lockParty: jest.fn(),
  unlockParty: jest.fn(),
  createAssignments: jest.fn(),
  emailAllMatches: jest.fn(),
  updateParty: jest.fn(),
}));

jest.mock('./MemberRow', () => ({
  __esModule: true,
  default: ({ member }: { member: { email: string } }) => (
    <div data-testid="member-row">{member.email}</div>
  ),
}));

jest.mock('./modals/InviteMembers', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="invite-modal" /> : null,
}));

import {
  lockParty,
  unlockParty,
  createAssignments,
  emailAllMatches,
  updateParty,
} from '../api/partyApi';

const mockLock = lockParty as jest.MockedFunction<typeof lockParty>;
const mockUnlock = unlockParty as jest.MockedFunction<typeof unlockParty>;
const mockAssign = createAssignments as jest.MockedFunction<typeof createAssignments>;
const mockEmailAll = emailAllMatches as jest.MockedFunction<typeof emailAllMatches>;
const mockUpdate = updateParty as jest.MockedFunction<typeof updateParty>;

const baseParty = {
  party_id: 'p1',
  name: 'Sesame Street Party',
  admin_email: 'admin@example.com',
  customizationEnabled: false,
  locked: false,
  created_at: '',
  updated_at: '',
};

const baseMember = {
  email: 'elmo@example.com',
  party_id: 'p1',
  role: 'member' as const,
  joined_at: '',
};

function makeEntry(overrides: Partial<HostedPartyEntry> = {}): HostedPartyEntry {
  return {
    party: baseParty,
    members: [{ member: baseMember }],
    assigned: false,
    ...overrides,
  };
}

describe('HostedPartyPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the party name', () => {
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    expect(screen.getByText(/Sesame Street Party/)).toBeInTheDocument();
  });

  it('shows "Lock the Party" when the party is unlocked', () => {
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /lock the party/i })).toBeInTheDocument();
  });

  it('shows "Unlock the Party" when the party is locked', () => {
    render(<HostedPartyPanel entry={makeEntry({ party: { ...baseParty, locked: true } })} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /unlock the party/i })).toBeInTheDocument();
  });

  it('calls lockParty and updates button label to "Unlock the Party"', async () => {
    const user = userEvent.setup();
    mockLock.mockResolvedValueOnce({ ...baseParty, locked: true });
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /lock the party/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /unlock the party/i })).toBeInTheDocument()
    );
    expect(mockLock).toHaveBeenCalledWith('p1');
  });

  it('calls unlockParty and updates button label to "Lock the Party"', async () => {
    const user = userEvent.setup();
    mockUnlock.mockResolvedValueOnce({ ...baseParty, locked: false });
    render(<HostedPartyPanel entry={makeEntry({ party: { ...baseParty, locked: true } })} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /unlock the party/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lock the party/i })).toBeInTheDocument()
    );
    expect(mockUnlock).toHaveBeenCalledWith('p1');
  });

  it('shows "Auto-Assign" when not assigned', () => {
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /auto-assign/i })).toBeInTheDocument();
  });

  it('calls createAssignments and switches to "Re-Assign"', async () => {
    const user = userEvent.setup();
    mockAssign.mockResolvedValueOnce([]);
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /auto-assign/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /re-assign/i })).toBeInTheDocument()
    );
    expect(mockAssign).toHaveBeenCalledWith('p1', { mode: 'automatic' });
  });

  it('"Email Members" is disabled when party is not locked', () => {
    render(<HostedPartyPanel entry={makeEntry({ assigned: true })} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /email members/i })).toBeDisabled();
  });

  it('"Email Members" is disabled when party is not assigned', () => {
    render(<HostedPartyPanel entry={makeEntry({ party: { ...baseParty, locked: true } })} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /email members/i })).toBeDisabled();
  });

  it('"Email Members" is enabled when locked AND assigned', async () => {
    const user = userEvent.setup();
    mockEmailAll.mockResolvedValueOnce(undefined);
    render(
      <HostedPartyPanel
        entry={makeEntry({ party: { ...baseParty, locked: true }, assigned: true })}
        onRefresh={jest.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: /email members/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    await waitFor(() => expect(mockEmailAll).toHaveBeenCalledWith('p1'));
  });

  it('shows "Enable Custom" when customization is disabled', () => {
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    expect(screen.getByRole('button', { name: /enable custom/i })).toBeInTheDocument();
  });

  it('calls updateParty and toggles to "Disable Custom"', async () => {
    const user = userEvent.setup();
    mockUpdate.mockResolvedValueOnce({ ...baseParty, customizationEnabled: true });
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /enable custom/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /disable custom/i })).toBeInTheDocument()
    );
    expect(mockUpdate).toHaveBeenCalledWith('p1', { customizationEnabled: true });
  });

  it('renders one MemberRow per member', () => {
    render(<HostedPartyPanel entry={makeEntry({ members: [{ member: baseMember }, { member: { ...baseMember, email: 'cookie@example.com', party_id: 'p1', role: 'member', joined_at: '' } }] })} onRefresh={jest.fn()} />);
    expect(screen.getAllByTestId('member-row')).toHaveLength(2);
  });

  it('shows an error alert when lockParty fails', async () => {
    const user = userEvent.setup();
    mockLock.mockRejectedValueOnce(new Error('fail'));
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /lock the party/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('opens invite modal when "Invite Members" is clicked', async () => {
    const user = userEvent.setup();
    render(<HostedPartyPanel entry={makeEntry()} onRefresh={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /invite members/i }));
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument();
  });
});
