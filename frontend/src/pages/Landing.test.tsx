import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Landing from './Landing';

describe('Landing', () => {
  beforeEach(() => {
    // Reset location mock before each test
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders the Secret Santa heading', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: /secret santa/i })).toBeInTheDocument();
  });

  it('renders a Log In button', () => {
    render(<Landing />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('navigates to /api/auth/login when Log In is clicked', async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(window.location.href).toBe('/api/auth/login');
  });
});
