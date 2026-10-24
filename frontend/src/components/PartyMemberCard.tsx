import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import type { MemberPartyEntry } from '../types/api';
import { displayName } from '../types/api';

// Modals implemented in Phases 6 and 7 — lazy-imported to keep card bundle small
const SeeMatch = React.lazy(() => import('./modals/SeeMatch'));
const EnterGifts = React.lazy(() => import('./modals/EnterGifts'));

interface PartyMemberCardProps {
  entry: MemberPartyEntry;
  onRefresh?: () => void;
}

function PartyMemberCard({ entry, onRefresh }: PartyMemberCardProps): React.JSX.Element {
  const { party, member, assignment } = entry;
  const [seeMatchOpen, setSeeMatchOpen] = useState(false);
  const [editGiftsOpen, setEditGiftsOpen] = useState(false);

  const showSeeMatch = Boolean(assignment);
  const showEditGifts = !party.locked && party.customizationEnabled;

  const hostName = party.admin_email;

  return (
    <>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {party.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Hosted By: {hostName}
          </Typography>

          <Box display="flex" gap={1} mt={1} flexWrap="wrap">
            {showSeeMatch && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSeeMatchOpen(true)}
              >
                See Match
              </Button>
            )}
            {showEditGifts && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setEditGiftsOpen(true)}
              >
                Edit Gifts
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Modals — only mounted when open */}
      {seeMatchOpen && assignment && (
        <React.Suspense fallback={null}>
          <SeeMatch
            open={seeMatchOpen}
            assignment={assignment}
            onClose={() => setSeeMatchOpen(false)}
          />
        </React.Suspense>
      )}

      {editGiftsOpen && (
        <React.Suspense fallback={null}>
          <EnterGifts
            open={editGiftsOpen}
            partyId={party.party_id}
            memberEmail={member.email}
            existingGiftBlob={member.gift_blob}
            onClose={() => {
              setEditGiftsOpen(false);
              onRefresh?.();
            }}
          />
        </React.Suspense>
      )}
    </>
  );
}

export default PartyMemberCard;
