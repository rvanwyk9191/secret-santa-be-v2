import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeeMatch from './SeeMatch';

const baseAssignment = {
  recipient_email: 'hamburgler@example.com',
  recipient_first_name: 'Ham',
  recipient_last_name: 'Burgler',
  recipient_gift_blob: 'Books\nBoard games\nCoffee',
};

describe('SeeMatch', () => {
  it('renders the modal header', () => {
    render(<SeeMatch open assignment={baseAssignment} onClose={jest.fn()} />);
    expect(screen.getByText('See Match')).toBeInTheDocument();
  });

  it('renders the Matched With line using first and last name', () => {
    render(<SeeMatch open assignment={baseAssignment} onClose={jest.fn()} />);
    expect(screen.getByText('Matched With: Ham Burgler')).toBeInTheDocument();
  });

  it('falls back to email when recipient names are absent', () => {
    render(
      <SeeMatch open assignment={{ recipient_email: 'x@x.com' }} onClose={jest.fn()} />
    );
    expect(screen.getByText('Matched With: x@x.com')).toBeInTheDocument();
  });

  it('renders one read-only field per gift', () => {
    render(<SeeMatch open assignment={baseAssignment} onClose={jest.fn()} />);
    expect(screen.getByDisplayValue('Books')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Board games')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('renders no gift fields when gift_blob is absent', () => {
    render(
      <SeeMatch open assignment={{ recipient_email: 'x@x.com' }} onClose={jest.fn()} />
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<SeeMatch open assignment={baseAssignment} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is not visible when open is false', () => {
    render(<SeeMatch open={false} assignment={baseAssignment} onClose={jest.fn()} />);
    expect(screen.queryByText('See Match')).not.toBeInTheDocument();
  });
});
