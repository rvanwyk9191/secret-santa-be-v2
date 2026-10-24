import React, { useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import type { PartyMember } from '../types/api';
import { displayName } from '../types/api';
import { removeMember, emailMemberMatch, revokeInvitation } from '../api/partyApi';

interface MemberRowAssignment {
  recipient_email: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
}

interface MemberRowProps {
  partyId: string;
  member: PartyMember;
  assignment?: MemberRowAssignment;
  onRemoved: () => void;
  isPending?: boolean;
}

function MemberRow({ partyId, member, assignment, onRemoved, isPending }: MemberRowProps): React.JSX.Element {
  const [peeking, setPeeking] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const memberName = displayName(member.first_name, member.last_name, member.email);

  const recipientName = assignment
    ? displayName(assignment.recipient_first_name, assignment.recipient_last_name, assignment.recipient_email)
    : '';

  const displayText = peeking && assignment ? `${memberName} – Match is ${recipientName}` : memberName;

  const handleRemove = async (): Promise<void> => {
    try {
      if (isPending) {
        await revokeInvitation(partyId, member.email);
      } else {
        await removeMember(partyId, member.email);
      }
      onRemoved();
    } catch {
      // removal errors surface via the parent refresh failing — no local UI needed
    }
  };

  const handleEmailMatch = async (): Promise<void> => {
    setEmailError(null);
    try {
      await emailMemberMatch(partyId, member.email);
    } catch {
      setEmailError('Failed to send email. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        border: '1px solid #d0d0d0',
        borderRadius: 1,
        p: 1.5,
        bgcolor: '#f5f5f5',
      }}
    >
      <Typography variant="body2" fontWeight="medium" gutterBottom>
        {displayText}{isPending ? ' (Invited)' : ''}
      </Typography>
      {emailError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {emailError}
        </Alert>
      )}
      <Box display="flex" gap={1} flexWrap="wrap">
        <Button size="small" variant="outlined" color="error" onClick={handleRemove}>
          Remove
        </Button>
        {!isPending && assignment && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setPeeking((prev) => !prev)}
          >
            {peeking ? 'Hide' : 'Peek'}
          </Button>
        )}
        {!isPending && (
          <Button size="small" variant="outlined" onClick={handleEmailMatch}>
            Email Match
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default MemberRow;
