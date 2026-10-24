import React, { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Grid, Typography } from '@mui/material';
import type { HostedPartyEntry } from '../types/api';
import {
  lockParty,
  unlockParty,
  createAssignments,
  emailAllMatches,
  updateParty,
  deleteParty,
} from '../api/partyApi';
import MemberRow from './MemberRow';
import InviteMembers from './modals/InviteMembers';

interface HostedPartyPanelProps {
  entry: HostedPartyEntry;
  onRefresh: () => void;
}

function formatPartyDate(isoDate?: string): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-US');
}

function HostedPartyPanel({ entry, onRefresh }: HostedPartyPanelProps): React.JSX.Element {
  // Read directly from entry (parent refetches after every action via onRefresh)
  const { party, assigned } = entry;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const run = async (action: () => Promise<void>, errorMsg: string): Promise<void> => {
    setLoading(true);
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLockToggle = (): Promise<void> =>
    run(async () => {
      party.locked ? await unlockParty(party.party_id) : await lockParty(party.party_id);
      onRefresh();
    }, 'Failed to update party lock status.');

  const handleAutoAssign = (): Promise<void> =>
    run(async () => {
      await createAssignments(party.party_id, { mode: 'automatic' });
      onRefresh();
    }, 'Failed to create assignments.');

  const handleEmailAll = (): Promise<void> =>
    run(() => emailAllMatches(party.party_id), 'Failed to send match emails.');

  const handleCustomToggle = (): Promise<void> =>
    run(async () => {
      await updateParty(party.party_id, { customizationEnabled: !party.customizationEnabled });
      onRefresh();
    }, 'Failed to update customization setting.');

  const handleInviteClose = (): void => {
    setInviteOpen(false);
    onRefresh();
  };

  const handleDeleteConfirm = (): Promise<void> =>
    run(async () => {
      await deleteParty(party.party_id);
      setDeleteConfirmOpen(false);
      onRefresh();
    }, 'Failed to delete party.');

  const dateDisplay = formatPartyDate(party.party_date);
  const emailMembersDisabled = loading || !party.locked || !assigned;

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 3, mb: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        {party.name}
        {dateDisplay ? ` ${dateDisplay}` : ''}
      </Typography>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          onClick={handleLockToggle}
        >
          {party.locked ? 'Unlock the Party' : 'Lock the Party'}
        </Button>

        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          onClick={handleAutoAssign}
        >
          {assigned ? 'Re-Assign' : 'Auto-Assign'}
        </Button>

        <Button
          variant="outlined"
          size="small"
          disabled={emailMembersDisabled}
          onClick={handleEmailAll}
        >
          Email Members
        </Button>

        <Button
          variant="outlined"
          size="small"
          onClick={() => setInviteOpen(true)}
        >
          Invite Members
        </Button>

        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          onClick={handleCustomToggle}
        >
          {party.customizationEnabled ? 'Disable Custom' : 'Enable Custom'}
        </Button>

        <Button
          variant="outlined"
          size="small"
          color="error"
          disabled={loading}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          Delete Party
        </Button>
      </Box>

      <Grid container spacing={2}>
        {entry.members.map(({ member, assignment }) => (
          <Grid item xs={12} sm={6} md={4} key={member.email}>
            <MemberRow
              partyId={party.party_id}
              member={member}
              assignment={assignment}
              onRemoved={onRefresh}
            />
          </Grid>
        ))}
        {entry.pendingInvitees.map(({ email }) => (
          <Grid item xs={12} sm={6} md={4} key={`pending-${email}`}>
            <MemberRow
              partyId={party.party_id}
              member={{ email, party_id: party.party_id, role: 'member', joined_at: '' }}
              onRemoved={onRefresh}
              isPending
            />
          </Grid>
        ))}
      </Grid>

      <InviteMembers
        open={inviteOpen}
        partyId={party.party_id}
        onClose={handleInviteClose}
      />

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#ede7f6', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 0, typography: 'body2' }}>Delete Party</DialogTitle>
        <DialogContent>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Delete &quot;{party.name}&quot;?
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will permanently delete the party and all its members. This action cannot be undone.
          </Typography>
          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionError}
            </Alert>
          )}
        </DialogContent>
        <Box display="flex" justifyContent="flex-end" gap={1} px={3} pb={2}>
          <Button
            variant="outlined"
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="inherit"
            onClick={handleDeleteConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}

export default HostedPartyPanel;
