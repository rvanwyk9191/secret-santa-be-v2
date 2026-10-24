import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateAParty from './CreateAParty';

// Mock the DatePicker to a simple text input — avoids needing a full date adapter in tests
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, onChange, slotProps }: {
    label: string;
    onChange: (val: { isValid: () => boolean; toISOString: () => string } | null) => void;
    slotProps?: { textField?: { error?: boolean; helperText?: string } };
  }) => (
    <div>
      <input
        aria-label={label}
        data-testid="date-picker"
        onChange={(e) =>
          onChange(
            e.target.value
              ? { isValid: () => true, toISOString: () => new Date(e.target.value).toISOString() }
              : null
          )
        }
      />
      {slotProps?.textField?.helperText && (
        <span role="note">{slotProps.textField.helperText}</span>
      )}
    </div>
  ),
}));

jest.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@mui/x-date-pickers/AdapterDayjs', () => ({ AdapterDayjs: class {} }));

jest.mock('../../api/partyApi', () => ({
  createParty: jest.fn(),
  createInvitation: jest.fn(),
}));

import React from 'react';
import { createParty, createInvitation } from '../../api/partyApi';
const mockCreateParty = createParty as jest.MockedFunction<typeof createParty>;
const mockCreateInvitation = createInvitation as jest.MockedFunction<typeof createInvitation>;

const partyFixture = {
  party_id: 'p1',
  name: 'Test Party',
  admin_email: 'admin@example.com',
  customizationEnabled: false,
  locked: false,
  created_at: '',
  updated_at: '',
};

describe('CreateAParty', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the modal header and title', () => {
    render(<CreateAParty {...defaultProps} />);
    expect(screen.getByText('Create A Party')).toBeInTheDocument();
    expect(screen.getByText('Enter Party Details')).toBeInTheDocument();
  });

  it('renders all required form fields', () => {
    render(<CreateAParty {...defaultProps} />);
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    expect(screen.getByLabelText(/party name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/short party description/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Secret Santa #1')).toBeInTheDocument();
  });

  it('shows validation error when Party Name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<CreateAParty {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByText('Party name is required')).toBeInTheDocument();
  });

  it('shows validation error when date is empty on submit', async () => {
    const user = userEvent.setup();
    render(<CreateAParty {...defaultProps} />);
    await user.type(screen.getByLabelText(/party name/i), 'My Party');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByRole('note')).toHaveTextContent('Date is required');
  });

  it('adds an email row when Add is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateAParty {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByLabelText('Secret Santa #2')).toBeInTheDocument();
  });

  it('removes an email row when Remove is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateAParty {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /add/i }));
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]!);
    expect(screen.queryByLabelText('Secret Santa #2')).not.toBeInTheDocument();
  });

  it('calls createParty and createInvitation on valid submit', async () => {
    const user = userEvent.setup();
    mockCreateParty.mockResolvedValueOnce(partyFixture);
    mockCreateInvitation.mockResolvedValue(undefined);

    render(<CreateAParty {...defaultProps} />);
    await user.type(screen.getByLabelText(/party name/i), 'Holiday Party');
    await user.type(screen.getByLabelText('Secret Santa #1'), 'a@example.com');
    fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2026-12-25' } });
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(defaultProps.onCreated).toHaveBeenCalled());
    expect(mockCreateParty).toHaveBeenCalledWith({
      name: 'Holiday Party',
      description: undefined,
      customizationEnabled: false,
      party_date: expect.stringContaining('2026-12-25'),
    });
    expect(mockCreateInvitation).toHaveBeenCalledWith('p1', { email: 'a@example.com' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows an error alert when createParty fails', async () => {
    const user = userEvent.setup();
    mockCreateParty.mockRejectedValueOnce(new Error('fail'));

    render(<CreateAParty {...defaultProps} />);
    await user.type(screen.getByLabelText(/party name/i), 'Party');
    fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2026-12-25' } });
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(defaultProps.onCreated).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateAParty {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('is not visible when open is false', () => {
    render(<CreateAParty {...defaultProps} open={false} />);
    expect(screen.queryByText('Create A Party')).not.toBeInTheDocument();
  });
});
