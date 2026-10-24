import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainPage from './MainPage';

// Mock the API module
jest.mock('../api/partyApi', () => ({
  getMyParties: jest.fn(),
  getMyHostedParties: jest.fn(),
}));

// Mock child components to isolate MainPage logic
jest.mock('../components/PartyMemberCard', () => ({
  __esModule: true,
  default: ({ entry }: { entry: { party: { name: string } } }) => (
    <div data-testid="party-member-card">{entry.party.name}</div>
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

import { getMyParties, getMyHostedParties } from '../api/partyApi';

const mockGetMyParties = getMyParties as jest.MockedFunction<typeof getMyParties>;
const mockGetMyHostedParties = getMyHostedParties as jest.MockedFunction<typeof getMyHostedParties>;

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
  },
];

describe('MainPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('shows the greeting using the first member name', async () => {
    mockGetMyParties.mockResolvedValueOnce(memberPartyFixture);
    mockGetMyHostedParties.mockResolvedValueOnce([]);

    render(<MainPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ho, Ho, Ho...Reinhardt van Wyk/)).toBeInTheDocument();
    });
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
