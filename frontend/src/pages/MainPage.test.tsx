import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainPage from './MainPage';

// Mock the API module
jest.mock('../api/partyApi', () => ({
  getMyParties: jest.fn(),
  getMyHostedParties: jest.fn(),
  getMyPendingInvites: jest.fn(),
  getMyProfile: jest.fn(),
  saveMyProfile: jest.fn(),
}));

// Mock child components to isolate MainPage logic
jest.mock('../components/PartyMemberCard', () => ({
  __esModule: true,
  default: ({ entry }: { entry: { party: { name: string }; host_display_name?: string } }) => (
    <div data-testid="party-member-card">{entry.party.name}{entry.host_display_name && `: ${entry.host_display_name}`}</div>
  ),
}));

jest.mock('../components/HostedPartyPanel', () => ({
  __esModule: true,
  default: ({ entry }: { entry: { party: { name: string } } }) => (
    <div data-testid="hosted-party-panel">{entry.party.name}</div>
  ),
}));

jest.mock('../components/modals/CreateAParty', () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-party-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

import { getMyParties, getMyHostedParties, getMyPendingInvites, getMyProfile, saveMyProfile } from '../api/partyApi';

const mockGetMyParties = getMyParties as jest.MockedFunction<typeof getMyParties>;
const mockGetMyHostedParties = getMyHostedParties as jest.MockedFunction<typeof getMyHostedParties>;
const mockGetMyPendingInvites = getMyPendingInvites as jest.MockedFunction<typeof getMyPendingInvites>;

const memberPartyFixture = [
  {
    party: {
      party_id: 'p1',
      name: 'Sesame Street Party',
      admin_email: 'admin@example.com',
      customizationEnabled: true,
      locked: false,
      created_at: '',
      updated_at: '',
    },
    member: {
      email: 'user@example.com',
      party_id: 'p1',
      role: 'member' as const,
      first_name: 'Reinhardt',
      last_name: 'van Wyk',
      joined_at: '',
    },
  },
];

const hostedPartyFixture = [
  {
    party: {
      party_id: 'p2',
      name: 'McDonald Theme Party',
      admin_email: 'user@example.com',
      customizationEnabled: false,
      locked: false,
      created_at: '',
      updated_at: '',
    },
    members: [],
    assigned: false,
    pendingInvitees: [],
  },
];

describe('MainPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyPendingInvites.mockResolvedValue([]);
    jest.mocked(getMyProfile).mockResolvedValue({ email: 'user@example.com', first_name: 'Reinhardt', last_name: 'van Wyk' });
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
  });

  it('shows a loading spinner while data is being fetched', () => {
    // Never resolves — keeps loading state
    mockGetMyParties.mockReturnValue(new Promise(() => {}));
    mockGetMyHostedParties.mockReturnValue(new Promise(() => {}));

    render(<MainPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders both section headers after data loads', async () => {
    mockGetMyParties.mockResolvedValueOnce(memberPartyFixture);
    mockGetMyHostedParties.mockResolvedValueOnce(hostedPartyFixture);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByText('Parties You Are Part Of')).toBeInTheDocument();
      expect(screen.getByText('Parties You Host')).toBeInTheDocument();
    });
  });

  it('shows placeholder when member party list is empty', async () => {
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByText(/haven't joined any parties yet/i)).toBeInTheDocument();
    });
  });

  it('shows placeholder when hosted party list is empty', async () => {
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByText(/haven't created any parties yet/i)).toBeInTheDocument();
    });
  });

  it('renders a card for each member party', async () => {
    mockGetMyParties.mockResolvedValueOnce(memberPartyFixture);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('party-member-card')).toHaveLength(1);
    });
  });

  it('renders a panel for each hosted party', async () => {
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce(hostedPartyFixture);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('hosted-party-panel')).toHaveLength(1);
    });
  });

  it('shows an error alert when the fetch fails', async () => {
    mockGetMyParties.mockRejectedValueOnce(new Error('Network error'));
    mockGetMyHostedParties.mockRejectedValueOnce(new Error('Network error'));

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('greets a user with a complete profile and no parties without prompting', async () => {
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ho, Ho, Ho...Reinhardt van Wyk/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prefills the known name, keeps input after a failed save, and updates the header after retry', async () => {
    const user = userEvent.setup();
    const profile = { email: 'user@example.com', first_name: 'Reinhardt', last_name: null };
    jest.mocked(getMyProfile).mockResolvedValueOnce(profile);
    jest.mocked(saveMyProfile).mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ ...profile, last_name: 'van Wyk' });
    const [other] = memberPartyFixture;
    mockGetMyParties.mockResolvedValueOnce([
      { ...other!, host_display_name: 'Kris Kringle' },
      { ...other!, party: { ...other!.party, party_id: 'p3', name: 'My Party', admin_email: profile.email } },
    ]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);
    await screen.findByRole('dialog');
    expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('Reinhardt');
    const lastName = screen.getByRole('textbox', { name: /last name/i });
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    expect(screen.getByText('Enter your last name.')).toBeInTheDocument();
    expect(saveMyProfile).not.toHaveBeenCalled();
    await user.type(lastName, 'van Wyk');
    await user.click(save);
    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(lastName).toHaveValue('van Wyk');
    await user.click(save);
    expect(await screen.findByText(/Ho, Ho, Ho...Reinhardt van Wyk/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('My Party: Reinhardt van Wyk')).toBeInTheDocument();
    expect(screen.getByText('Sesame Street Party: Kris Kringle')).toBeInTheDocument();
  });

  it('distinguishes a failed profile load from an incomplete profile', async () => {
    jest.mocked(getMyProfile).mockRejectedValueOnce(new Error('Unavailable'));
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);
    render(<MainPage />);
    expect(await screen.findByText(/could not load your profile/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry profile' }));
    expect(await screen.findByText(/Ho, Ho, Ho...Reinhardt van Wyk/)).toBeInTheDocument();
  });

  it('navigates to /api/auth/logout when Sign Out is clicked', async () => {
    const user = userEvent.setup();
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => screen.getByRole('button', { name: /sign out/i }));
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(window.location.href).toBe('/api/auth/logout');
  });

  it('opens Create A Party modal when "Create A Party" is clicked', async () => {
    const user = userEvent.setup();
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => screen.getByRole('button', { name: /create a party/i }));
    await user.click(screen.getByRole('button', { name: /create a party/i }));

    expect(screen.getByTestId('create-party-modal')).toBeInTheDocument();
  });

  it('closes Create A Party modal when onClose is called', async () => {
    const user = userEvent.setup();
    mockGetMyParties.mockResolvedValueOnce([]);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => screen.getByRole('button', { name: /create a party/i }));
    await user.click(screen.getByRole('button', { name: /create a party/i }));
    await user.click(screen.getByRole('button', { name: /close modal/i }));

    expect(screen.queryByTestId('create-party-modal')).not.toBeInTheDocument();
  });
});
