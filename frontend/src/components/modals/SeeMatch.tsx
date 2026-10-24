import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import type { RecipientInfo } from '../../types/api';
import { displayName } from '../../types/api';

interface SeeMatchProps {
  open: boolean;
  assignment: RecipientInfo;
  onClose: () => void;
}

function SeeMatch({ open, assignment, onClose }: SeeMatchProps): React.JSX.Element {
  const recipientName = displayName(
    assignment.recipient_first_name,
    assignment.recipient_last_name,
    assignment.recipient_email
  );

  const gifts = assignment.recipient_gift_blob
    ? assignment.recipient_gift_blob.split('\n').filter(Boolean)
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#ede7f6', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 0, typography: 'body2' }}>See Match</DialogTitle>
      <DialogContent>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Matched With: {recipientName}
        </Typography>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {gifts.map((gift, i) => (
            <TextField
              key={i}
              label={`Gift #${i + 1}`}
              value={gift}
              InputProps={{ readOnly: true }}
              variant="outlined"
              fullWidth
            />
          ))}
        </Box>
      </DialogContent>
      <Box display="flex" justifyContent="flex-end" px={3} pb={2}>
        <Button variant="contained" color="inherit" onClick={onClose}>
          Close
        </Button>
      </Box>
    </Dialog>
  );
}

export default SeeMatch;
