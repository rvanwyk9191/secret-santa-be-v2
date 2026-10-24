import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { getMyParties } from './api/partyApi';

// Pages — implemented in Phases 3 and 4
const Landing = React.lazy(() => import('./pages/Landing'));
const MainPage = React.lazy(() => import('./pages/MainPage'));

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function App(): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    getMyParties()
      .then(() => setAuthState('authenticated'))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } }).response?.status;
        // 401 = not logged in; anything else = treat as authenticated (MainPage handles errors)
        setAuthState(status === 401 ? 'unauthenticated' : 'authenticated');
      });
  }, []);

  if (authState === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <React.Suspense
        fallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <CircularProgress />
          </Box>
        }
      >
        <Routes>
          <Route
            path="/"
            element={authState === 'authenticated' ? <MainPage /> : <Landing />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
