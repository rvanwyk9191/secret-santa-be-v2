import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnterGifts from './EnterGifts';

jest.mock('../../api/partyApi', () => ({
  saveGiftBlob: jest.fn(),
}));

import { saveGiftBlob } from '../../api/partyApi';
const mockSaveGiftBlob = saveGiftBlob as jest.MockedFunction<typeof saveGiftBlob>;

describe('EnterGifts', () => {
  const defaultProps = {
    open: true,
    partyId: 'p1',
    memberEmail: 'user@example.com',
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal header and title', () => {
    render(<EnterGifts {...defaultProps} />);
    expect(screen.getByText('Edit Gifts')).toBeInTheDocument();
    expect(screen.getByText('Enter Your Gifts')).toBeInTheDocument();
  });

  it('renders one empty field by default', () => {
    render(<EnterGifts {...defaultProps} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('pre-populates fields from existingGiftBlob', () => {
    render(<EnterGifts {...defaultProps} existingGiftBlob={"Books\nGames\nCoffee"} />);
    expect(screen.getByDisplayValue('Books')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Games')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('adds a new empty field when Add is clicked', async () => {
    const user = userEvent.setup();
    render(<EnterGifts {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('removes a field when Remove is clicked (with multiple rows)', async () => {
    const user = userEvent.setup();
    render(<EnterGifts {...defaultProps} existingGiftBlob={"Books\nGames"} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]!);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('disables Remove when only one row remains', () => {
    render(<EnterGifts {...defaultProps} />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
  });

  it('calls saveGiftBlob and onClose when Save is clicked', async () => {
    const user = userEvent.setup();
    mockSaveGiftBlob.mockResolvedValueOnce({
      email: 'user@example.com',
      party_id: 'p1',
      role: 'member',
      joined_at: '',
    });
    render(<EnterGifts {...defaultProps} existingGiftBlob="Books" />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
    expect(mockSaveGiftBlob).toHaveBeenCalledWith('p1', 'user@example.com', { giftBlob: 'Books' });
  });

  it('shows an error alert when saveGiftBlob fails', async () => {
    const user = userEvent.setup();
    mockSaveGiftBlob.mockRejectedValueOnce(new Error('Network error'));
    render(<EnterGifts {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked without saving', async () => {
    const user = userEvent.setup();
    render(<EnterGifts {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(mockSaveGiftBlob).not.toHaveBeenCalled();
  });

  it('is not visible when open is false', () => {
    render(<EnterGifts {...defaultProps} open={false} />);
    expect(screen.queryByText('Edit Gifts')).not.toBeInTheDocument();
  });
});
