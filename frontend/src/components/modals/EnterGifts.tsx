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
import { saveGiftBlob } from '../../api/partyApi';

interface EnterGiftsProps {
  open: boolean;
  partyId: string;
  memberEmail: string;
  existingGiftBlob?: string;
  onClose: () => void;
}

function parseGifts(blob?: string): string[] {
  if (!blob) return [''];
  const items = blob.split('\n').filter(Boolean);
  return items.length > 0 ? items : [''];
}

function EnterGifts({
  open,
  partyId,
  memberEmail,
  existingGiftBlob,
  onClose,
}: EnterGiftsProps): React.JSX.Element {
  const [gifts, setGifts] = useState<string[]>(() => parseGifts(existingGiftBlob));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (): void => setGifts((prev) => [...prev, '']);

  const handleRemove = (index: number): void => {
    if (gifts.length <= 1) return;
    setGifts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string): void => {
    setGifts((prev) => prev.map((g, i) => (i === index ? value : g)));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const blob = gifts.filter(Boolean).join('\n');
      await saveGiftBlob(partyId, memberEmail, { giftBlob: blob });
      onClose();
    } catch {
      setError('Failed to save gifts. Please try again.');
    } finally {
      setSaving(false);
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
      <DialogTitle sx={{ pb: 0, typography: 'body2' }}>Edit Gifts</DialogTitle>
      <DialogContent>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Enter Your Gifts
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box display="flex" flexDirection="column" gap={2}>
          {gifts.map((gift, i) => (
            <Box key={i} display="flex" gap={1} alignItems="center">
              <TextField
                label={`Gift #${i + 1}`}
                value={gift}
                onChange={(e) => handleChange(i, e.target.value)}
                fullWidth
                variant="outlined"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleRemove(i)}
                disabled={gifts.length <= 1}
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
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" color="inherit" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Dialog>
  );
}

export default EnterGifts;
