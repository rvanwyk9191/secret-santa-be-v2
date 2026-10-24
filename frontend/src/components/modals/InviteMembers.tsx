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
import { createInvitation } from '../../api/partyApi';

interface InviteMembersProps {
  open: boolean;
  partyId: string;
  onClose: () => void;
}

function InviteMembers({ open, partyId, onClose }: InviteMembersProps): React.JSX.Element {
  const [emails, setEmails] = useState<string[]>(['']);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (): void => setEmails((prev) => [...prev, '']);

  const handleRemove = (index: number): void => {
    if (emails.length <= 1) return;
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string): void => {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };

  const handleInvite = async (): Promise<void> => {
    setInviting(true);
    setError(null);
    const toInvite = emails.filter(Boolean);
    try {
      await Promise.all(toInvite.map((email) => createInvitation(partyId, { email })));
      setEmails(['']);
      onClose();
    } catch {
      setError('One or more invitations failed to send. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#ede7f6', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 0, typography: 'body2' }}>Invite Members</DialogTitle>
      <DialogContent>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Invite Members to the Party
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box display="flex" flexDirection="column" gap={2}>
          {emails.map((email, i) => (
            <Box key={i} display="flex" gap={1} alignItems="center">
              <TextField
                label={`Secret Santa #${i + 1}`}
                value={email}
                onChange={(e) => handleChange(i, e.target.value)}
                type="email"
                fullWidth
                variant="outlined"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleRemove(i)}
                disabled={emails.length <= 1}
              >
                Remove
              </Button>
            </Box>
          ))}
        </Box>
        <Button variant="outlined" size="small" onClick={handleAdd} sx={{ mt: 2 }}>
          Add
        </Button>
      </DialogContent>
      <Box display="flex" justifyContent="flex-end" gap={1} px={3} pb={2}>
        <Button variant="outlined" onClick={onClose} disabled={inviting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="inherit"
          onClick={handleInvite}
          disabled={inviting}
        >
          {inviting ? 'Inviting...' : 'Invite'}
        </Button>
      </Box>
    </Dialog>
  );
}

export default InviteMembers;
