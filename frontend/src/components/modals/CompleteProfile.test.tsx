import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveMyProfile } from '../../api/partyApi';
import type { AccountProfile } from '../../types/api';
import CompleteProfile from './CompleteProfile';

jest.mock('../../api/partyApi', () => ({ saveMyProfile: jest.fn() }));
const save = jest.mocked(saveMyProfile);
const profile = { email: 'user@example.com', first_name: 'Kris', last_name: null };
const complete = { ...profile, last_name: 'Kringle' };

beforeEach(() => save.mockReset());

it('does not send another save while the first is pending', async () => {
  const user = userEvent.setup();
  let resolveSave: ((value: AccountProfile) => void) | undefined;
  save.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
  const onSaved = jest.fn();
  render(<CompleteProfile profile={profile} onSaved={onSaved} onReload={jest.fn()} />);
  await user.type(screen.getByRole('textbox', { name: /last name/i }), 'Kringle');
  const button = screen.getByRole('button', { name: 'Save' });
  await user.click(button);
  expect(button).toBeDisabled();
  const form = button.closest('form');
  if (!form) throw new Error('Save button is outside the profile form');
  fireEvent.submit(form);
  expect(save).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  resolveSave?.(complete);
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(complete));
});

it('offers a reload after a competing completion without discarding entered names', async () => {
  const user = userEvent.setup();
  save.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
  const onReload = jest.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(complete);
  render(<CompleteProfile profile={profile} onSaved={jest.fn()} onReload={onReload} />);
  const lastName = screen.getByRole('textbox', { name: /last name/i });
  await user.type(lastName, 'Claus');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const reload = await screen.findByRole('button', { name: 'Reload profile' });
  expect(lastName).toHaveValue('Claus');
  await user.click(reload);
  expect(await screen.findByText(/could not reload/i)).toBeInTheDocument();
  await user.click(reload);
  expect(onReload).toHaveBeenCalledTimes(2);
});
