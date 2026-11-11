import { render, screen } from '@testing-library/react';
import App from './App';
import { getMyParties } from './api/partyApi';

jest.mock('./api/partyApi', () => ({
  getMyParties: jest.fn(),
}));

jest.mock('./pages/Landing', () => ({
  __esModule: true,
  default: () => 'Landing page',
}));

jest.mock('./pages/MainPage', () => ({
  __esModule: true,
  default: () => 'Main page',
}));

const mockGetMyParties = getMyParties as jest.MockedFunction<typeof getMyParties>;

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('shows a loading indicator while checking authentication', () => {
    mockGetMyParties.mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the main page when the session request succeeds', async () => {
    mockGetMyParties.mockResolvedValueOnce([]);

    render(<App />);

    expect(await screen.findByText('Main page')).toBeInTheDocument();
  });

  it('renders the landing page for an unauthenticated session', async () => {
    mockGetMyParties.mockRejectedValueOnce({ response: { status: 401 } });

    render(<App />);

    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });

  it('lets the main page handle non-authentication request failures', async () => {
    mockGetMyParties.mockRejectedValueOnce({ response: { status: 500 } });

    render(<App />);

    expect(await screen.findByText('Main page')).toBeInTheDocument();
  });

  it('redirects unknown routes to the root route', async () => {
    window.history.replaceState({}, '', '/unknown');
    mockGetMyParties.mockResolvedValueOnce([]);

    render(<App />);

    expect(await screen.findByText('Main page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});