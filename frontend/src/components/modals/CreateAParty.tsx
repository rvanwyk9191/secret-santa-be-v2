import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Dayjs } from 'dayjs';
import { createParty, createInvitation } from '../../api/partyApi';

interface CreateAPartyProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateAParty({ open, onClose, onCreated }: CreateAPartyProps): React.JSX.Element {
  const [partyDate, setPartyDate] = useState<Dayjs | null>(null);
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [emails, setEmails] = useState<string[]>(['']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [dateError, setDateError] = useState(false);

  const handleAddEmail = (): void => setEmails((prev) => [...prev, '']);

  const handleRemoveEmail = (index: number): void => {
    if (emails.length <= 1) return;
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string): void => {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };

  const handleCreate = async (): Promise<void> => {
    const nameValid = partyName.trim().length > 0;
    const dateValid = partyDate !== null;
    setNameError(!nameValid);
    setDateError(!dateValid);
    if (!nameValid || !dateValid) return;

    setCreating(true);
    setError(null);
    try {
      const party = await createParty({
        name: partyName.trim(),
        description: description.trim() || undefined,
        customizationEnabled: false,
        party_date: partyDate.toISOString(),
      });
      const toInvite = emails.filter(Boolean);
      await Promise.all(toInvite.map((email) => createInvitation(party.party_id, { email })));
      onCreated();
      onClose();
    } catch {
      setError('Failed to create party. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = (): void => {
    if (creating) return;
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#ede7f6', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 0, typography: 'body2' }}>Create A Party</DialogTitle>
        <DialogContent>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Enter Party Details
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box display="flex" flexDirection="column" gap={2}>
            <DatePicker
              label="Buy your gifts by"
              value={partyDate}
              onChange={(val) => { setPartyDate(val); setDateError(false); }}
              slotProps={{
                textField: {
                  error: dateError,
                  helperText: dateError ? 'Date is required' : undefined,
                  fullWidth: true,
                },
              }}
            />
            <TextField
              label="Party Name"
              value={partyName}
              onChange={(e) => { setPartyName(e.target.value); setNameError(false); }}
              error={nameError}
              helperText={nameError ? 'Party name is required' : undefined}
              fullWidth
              variant="outlined"
              required
            />
            <TextField
              label="Short Party Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              variant="outlined"
              multiline
              rows={2}
            />
            {emails.map((email, i) => (
              <Box key={i} display="flex" gap={1} alignItems="center">
                <TextField
                  label={`Secret Santa #${i + 1}`}
                  value={email}
                  onChange={(e) => handleEmailChange(i, e.target.value)}
                  type="email"
                  fullWidth
                  variant="outlined"
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleRemoveEmail(i)}
                  disabled={emails.length <= 1}
                >
                  Remove
                </Button>
              </Box>
            ))}
            <Box>
              <Button variant="outlined" size="small" onClick={handleAddEmail}>
                Add
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <Box display="flex" justifyContent="flex-end" gap={1} px={3} pb={2}>
          <Button variant="outlined" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" color="inherit" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </Box>
      </Dialog>
    </LocalizationProvider>
  );
}

export default CreateAParty;
