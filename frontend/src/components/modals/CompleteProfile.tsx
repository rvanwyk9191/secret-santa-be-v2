import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { isAxiosError } from 'axios';
import { saveMyProfile } from '../../api/partyApi';
import type { AccountProfile } from '../../types/api';

interface Props {
  profile: AccountProfile;
  onSaved: (profile: AccountProfile) => void;
  onReload: () => Promise<AccountProfile>;
}

export default function CompleteProfile({ profile, onSaved, onReload }: Props) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'conflict' | 'save' | null>(null);
  const [reloadError, setReloadError] = useState(false);
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || error === 'conflict') return;
    setAttempted(true);
    if (!firstName.trim() || !lastName.trim()) return;

    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveMyProfile({ firstName: firstName.trim(), lastName: lastName.trim() }));
    } catch (failure) {
      setError(isAxiosError(failure) && failure.response?.status === 409 ? 'conflict' : 'save');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function reload() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setReloadError(false);
    try {
      const latest = await onReload();
      if (!latest.first_name || !latest.last_name) setError(null);
    } catch {
      setReloadError(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open aria-labelledby="complete-profile-title" fullWidth maxWidth="xs">
      <DialogTitle id="complete-profile-title">Complete your profile</DialogTitle>
      <form noValidate onSubmit={submit}>
        <DialogContent>
          {error === 'save' && <Alert severity="error">Could not save your name. Please try again.</Alert>}
          {error === 'conflict' && (
            <Alert severity="warning" action={<Button onClick={reload} disabled={saving}>Reload profile</Button>}>
              {reloadError ? 'Could not reload your profile. Please try again.' : 'Your profile changed. Reload it to see the saved names.'}
            </Alert>
          )}
          <TextField
            autoFocus={!profile.first_name}
            autoComplete="given-name"
            label="First Name"
            value={firstName}
            onChange={event => setFirstName(event.target.value)}
            error={attempted && !firstName.trim()}
            helperText={attempted && !firstName.trim() ? 'Enter your first name.' : undefined}
            margin="dense"
            required
            fullWidth
            disabled={saving}
          />
          <TextField
            autoFocus={Boolean(profile.first_name)}
            autoComplete="family-name"
            label="Last Name"
            value={lastName}
            onChange={event => setLastName(event.target.value)}
            error={attempted && !lastName.trim()}
            helperText={attempted && !lastName.trim() ? 'Enter your last name.' : undefined}
            margin="dense"
            required
            fullWidth
            disabled={saving}
          />
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" disabled={saving || error === 'conflict'}>Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
