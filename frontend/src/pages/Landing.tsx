import React from 'react';
import { Box, Button, Typography } from '@mui/material';

function Landing(): React.JSX.Element {
  const handleLogin = (): void => {
    window.location.href = '/api/auth/login';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        padding: 3,
        minHeight: '100vh',
      }}
    >
      {/* Log In button — top right */}
      <Button variant="contained" color="inherit" onClick={handleLogin} sx={{ mb: 12 }}>
        Log In
      </Button>

      {/* Secret Santa title — right-aligned */}
      <Typography variant="h2" component="h1" fontWeight="bold">
        Secret Santa
      </Typography>
    </Box>
  );
}

export default Landing;
