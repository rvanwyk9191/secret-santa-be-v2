import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { getMyParties, getMyHostedParties, getMyPendingInvites, getMyProfile } from '../api/partyApi';
import type { AccountProfile, MemberPartyEntry, HostedPartyEntry, PendingInvite } from '../types/api';
import PartyMemberCard from '../components/PartyMemberCard';
import PendingInviteCard from '../components/PendingInviteCard';
import CompleteProfile from '../components/modals/CompleteProfile';

const HostedPartyPanel = React.lazy(() => import('../components/HostedPartyPanel'));
const CreateAParty = React.lazy(() => import('../components/modals/CreateAParty'));

function MainPage(): React.JSX.Element {
  const [memberParties, setMemberParties] = useState<MemberPartyEntry[]>([]);
  const [hostedParties, setHostedParties] = useState<HostedPartyEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  const fetchProfile = async (): Promise<void> => {
    setProfileError(false);
    try {
      setProfile(await getMyProfile());
    } catch {
      setProfileError(true);
    }
  };
  const fetchData = (silent = false): void => {
    if (!silent) setLoading(true);
    setError(null);
    Promise.all([getMyParties(), getMyHostedParties(), getMyPendingInvites()])
      .then(([member, hosted, pending]) => {
        setMemberParties(member);
        setHostedParties(hosted);
        setPendingInvites(pending);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        if (!silent) {
          setError('Failed to load party data. Please try refreshing the page.');
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    fetchData();
    void fetchProfile();
  }, []);

  const handleSignOut = (): void => {
    window.location.href = '/api/auth/logout';
  };

  const fullName = profile?.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : null;
  const greetingName = fullName ?? profile?.email;
  const callerHostName = (hostEmail: string): string | undefined =>
    fullName && hostEmail.toLowerCase() === profile?.email ? fullName : undefined;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 4,
          py: 2,
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="body1">
          {greetingName ? `Ho, Ho, Ho...${greetingName}` : 'Ho, Ho, Ho...'}
        </Typography>
        <Button variant="contained" color="inherit" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Box>

      {/* Main content */}
      <Box sx={{ px: 4, py: 4 }}>
        {profileError && (
          <Alert severity="error" sx={{ mb: 4 }} action={<Button onClick={fetchProfile}>Retry profile</Button>}>
            Could not load your profile.
          </Alert>
        )}
        {loading && (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {/* ── Pending Invites ── */}
            {pendingInvites.length > 0 && (
              <>
                <Typography variant="h3" component="h2" fontWeight="bold" gutterBottom>
                  Pending Invites
                </Typography>
                <Grid container spacing={2} sx={{ mb: 6 }}>
                  {pendingInvites.map((invite) => (
                    <Grid item xs={12} sm={6} md={4} key={invite.party_id}>
                      <PendingInviteCard
                        invite={{ ...invite, host_display_name: callerHostName(invite.admin_email) ?? invite.host_display_name }}
                        onRefresh={() => fetchData(true)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            )}

            {/* ── Parties You Are Part Of ── */}
            <Typography variant="h3" component="h2" fontWeight="bold" gutterBottom>
              Parties You Are Part Of
            </Typography>

            {memberParties.length === 0 ? (
              <Typography color="text.secondary" sx={{ mb: 6 }}>
                You haven't joined any parties yet.
              </Typography>
            ) : (
              <Grid container spacing={2} sx={{ mb: 6 }}>
                {memberParties.map((entry) => (
                  <Grid item xs={12} sm={6} md={4} key={`${entry.party.party_id}-${entry.member.email}`}>
                    <PartyMemberCard
                      entry={{ ...entry, host_display_name: callerHostName(entry.party.admin_email) ?? entry.host_display_name }}
                      onRefresh={() => fetchData(true)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            {/* ── Parties You Host ── */}
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h3" component="h2" fontWeight="bold">
                Parties You Host
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => setCreatePartyOpen(true)}
              >
                Create A Party
              </Button>
            </Box>

            {hostedParties.length === 0 ? (
              <Typography color="text.secondary">
                You haven't created any parties yet.
              </Typography>
            ) : (
              <React.Suspense fallback={<CircularProgress />}>
                {hostedParties.map((entry) => (
                  <HostedPartyPanel
                    key={entry.party.party_id}
                    entry={entry}
                    onRefresh={() => fetchData(true)}
                  />
                ))}
              </React.Suspense>
            )}
          </>
        )}
      </Box>

      {profile && !fullName && (
        <CompleteProfile
          profile={profile}
          onSaved={setProfile}
          onReload={async () => {
            const latest = await getMyProfile();
            setProfile(latest);
            return latest;
          }}
        />
      )}

      {/* Create A Party modal */}
      <React.Suspense fallback={null}>
        <CreateAParty
          open={createPartyOpen}
          onClose={() => setCreatePartyOpen(false)}
          onCreated={fetchData}
        />
      </React.Suspense>
    </Box>
  );
}

export default MainPage;
