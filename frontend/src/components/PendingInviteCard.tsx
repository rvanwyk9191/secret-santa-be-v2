import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import type { PendingInvite } from '../types/api';
import { acceptPendingInvite, declinePendingInvite } from '../api/partyApi';

interface PendingInviteCardProps {
  invite: PendingInvite;
  onRefresh: () => void;
}

function formatPartyDate(isoDate?: string): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-US');
}

function PendingInviteCard({ invite, onRefresh }: PendingInviteCardProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateDisplay = formatPartyDate(invite.party_date);

  const handleAccept = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await acceptPendingInvite(invite.party_id, invite.token);
      onRefresh();
    } catch {
      setError('Failed to accept invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await declinePendingInvite(invite.party_id, invite.token);
      onRefresh();
    } catch {
      setError('Failed to decline invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {invite.party_name}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Hosted By: {invite.admin_email}
        </Typography>
        {dateDisplay && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Date: {dateDisplay}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
            {error}
          </Alert>
        )}

        <Box display="flex" gap={1} mt={2}>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={loading}
            onClick={handleDeny}
          >
            Deny
          </Button>
          <Button
            size="small"
            variant="contained"
            color="inherit"
            disabled={loading}
            onClick={handleAccept}
          >
            Accept
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default PendingInviteCard;
