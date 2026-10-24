import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartyMemberCard from './PartyMemberCard';
import type { MemberPartyEntry } from '../types/api';

// Stub modals so we don't need their full implementation
jest.mock('./modals/SeeMatch', () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label="See Match"><button onClick={onClose}>Close</button></div> : null,
}));

jest.mock('./modals/EnterGifts', () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label="Edit Gifts"><button onClick={onClose}>Cancel</button></div> : null,
}));

const baseParty = {
  party_id: 'p1',
  name: 'Sesame Street Party',
  admin_email: 'admin@example.com',
  customizationEnabled: true,
  locked: false,
  created_at: '',
  updated_at: '',
};

const baseMember = {
  email: 'user@example.com',
  party_id: 'p1',
  role: 'member' as const,
  joined_at: '',
};

function makeEntry(overrides: Partial<MemberPartyEntry> = {}): MemberPartyEntry {
  return {
    party: { ...baseParty, ...((overrides.party as object | undefined) ?? {}) },
    member: { ...baseMember, ...((overrides.member as object | undefined) ?? {}) },
    ...overrides,
  };
}

describe('PartyMemberCard', () => {
  it('renders the party name', () => {
    render(<PartyMemberCard entry={makeEntry()} />);
    expect(screen.getByText('Sesame Street Party')).toBeInTheDocument();
  });

  it('renders the host email as fallback', () => {
    render(<PartyMemberCard entry={makeEntry()} />);
    expect(screen.getByText(/Hosted By: admin@example.com/)).toBeInTheDocument();
  });

  it('does not show See Match when there is no assignment', () => {
    render(<PartyMemberCard entry={makeEntry()} />);
    expect(screen.queryByRole('button', { name: /see match/i })).not.toBeInTheDocument();
  });

  it('shows See Match when an assignment is present', () => {
    const entry = makeEntry({
      assignment: {
        recipient_email: 'recipient@example.com',
        recipient_first_name: 'Cookie',
        recipient_last_name: 'Monster',
      },
    });
    render(<PartyMemberCard entry={entry} />);
    expect(screen.getByRole('button', { name: /see match/i })).toBeInTheDocument();
  });

  it('does not show Edit Gifts when party is locked', () => {
    const entry = makeEntry({ party: { ...baseParty, locked: true } });
    render(<PartyMemberCard entry={entry} />);
    expect(screen.queryByRole('button', { name: /edit gifts/i })).not.toBeInTheDocument();
  });

  it('does not show Edit Gifts when customization is disabled', () => {
    const entry = makeEntry({ party: { ...baseParty, customizationEnabled: false } });
    render(<PartyMemberCard entry={entry} />);
    expect(screen.queryByRole('button', { name: /edit gifts/i })).not.toBeInTheDocument();
  });

  it('shows Edit Gifts when party is unlocked and customization is enabled', () => {
    render(<PartyMemberCard entry={makeEntry()} />);
    expect(screen.getByRole('button', { name: /edit gifts/i })).toBeInTheDocument();
  });

  it('opens See Match modal when See Match button is clicked', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({
      assignment: { recipient_email: 'r@example.com' },
    });
    render(<PartyMemberCard entry={entry} />);

    await user.click(screen.getByRole('button', { name: /see match/i }));

    expect(screen.getByRole('dialog', { name: /see match/i })).toBeInTheDocument();
  });

  it('opens Edit Gifts modal when Edit Gifts button is clicked', async () => {
    const user = userEvent.setup();
    render(<PartyMemberCard entry={makeEntry()} />);

    await user.click(screen.getByRole('button', { name: /edit gifts/i }));

    expect(screen.getByRole('dialog', { name: /edit gifts/i })).toBeInTheDocument();
  });

  it('closes See Match modal when Close is clicked', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ assignment: { recipient_email: 'r@example.com' } });
    render(<PartyMemberCard entry={entry} />);

    await user.click(screen.getByRole('button', { name: /see match/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog', { name: /see match/i })).not.toBeInTheDocument();
  });
});
