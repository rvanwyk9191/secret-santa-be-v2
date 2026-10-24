# Feature Specification: Auth0 OIDC Callback via Frontend Proxy

**Feature Branch**: `005-auth0-proxy-callback`  
**Created**: 2026-08-01  
**Status**: Draft  

## Background

The local development environment has a split-origin problem: the Auth0 login flow starts through the Vite dev server (`localhost`) but Auth0's callback redirects directly to the backend (`127.0.0.1:8080`), bypassing the proxy. Because browsers treat `localhost` and `127.0.0.1` as different cookie domains, the `auth_verification` transaction cookie set during login is absent when the callback is processed, causing authentication to fail in every local login attempt.

## User Scenarios & Testing

### User Story 1 — Local Login Succeeds End-to-End (Priority: P1)

A developer running both servers locally can click "Log In", authenticate with Auth0, and arrive back at the application in an authenticated state — without encountering a cookie error or any manual workaround.

**Why this priority**: The entire application requires authentication. If login is broken locally, no feature can be developed or tested end-to-end.

**Independent Test**: Start both servers, navigate to the frontend, click "Log In", complete Auth0 login, and confirm the dashboard loads with the user's party list.

**Acceptance Scenarios**:

1. **Given** both servers are running and a developer navigates to the frontend, **When** they click "Log In" and complete the Auth0 Universal Login, **Then** they are redirected back to the frontend in an authenticated state with no error.
2. **Given** a completed login, **When** the developer makes any authenticated API call, **Then** the call succeeds (no 401 or cookie-related error).
3. **Given** the login flow is in progress, **When** Auth0 performs the callback redirect, **Then** the `auth_verification` transaction cookie is present and the SDK validates it successfully.

---

### User Story 2 — Logout Clears Session Correctly (Priority: P2)

A developer who has logged in can log out and be returned to the landing page with all session state cleared.

**Why this priority**: Broken logout causes stale session issues that interfere with testing multiple user scenarios locally.

**Independent Test**: Log in, click logout, confirm redirection to landing page, confirm protected API calls return 401.

**Acceptance Scenarios**:

1. **Given** an authenticated session, **When** the developer triggers logout, **Then** all session cookies are cleared and the frontend shows the unauthenticated landing page.
2. **Given** a cleared session, **When** the developer navigates to a protected route, **Then** they are redirected to login rather than seeing an error or stale data.

---

### User Story 3 — Stable Dev Server URL (Priority: P3)

The frontend dev server always starts on the same port so the Auth0 callback URL registered in the Auth0 dashboard remains valid across restarts without manual reconfiguration.

**Why this priority**: If the port changes on each restart, the Auth0 allowed-callback URL becomes stale and login breaks again.

**Independent Test**: Stop and restart the frontend dev server five times; confirm it binds to the same port each time.

**Acceptance Scenarios**:

1. **Given** the frontend dev server is stopped, **When** it is restarted, **Then** it binds to the same port as the previous run.
2. **Given** another process occupies the default port, **When** the dev server starts, **Then** it fails with a clear error rather than silently choosing a different port.

---

### Edge Cases

- What happens when the developer accesses the callback URL directly (without initiating login first)?  
  → The SDK must return a clear error; it must not crash the server.
- What happens when Auth0 returns an error response at the callback (e.g. user denies consent)?  
  → The application must redirect to the landing page with an appropriate message rather than hanging.
- What happens when the TLS certificate presented by the frontend dev server does not cover the origin the browser is using?  
  → The browser will block the request. The certificate must cover the exact hostname used to access the dev server.

## Requirements

### Functional Requirements

- **FR-001**: The frontend dev server MUST bind to a fixed, configurable port that does not change between restarts.
- **FR-002**: The backend MUST construct the Auth0 `redirect_uri` using the frontend proxy origin, so that Auth0 redirects the browser back through the proxy rather than directly to the backend.
- **FR-003**: The Auth0 application's Allowed Callback URLs MUST include the frontend proxy origin's callback path (e.g. `https://localhost:<port>/api/auth/callback`).
- **FR-004**: The Vite proxy MUST forward the `/api/auth/callback` request to the backend with all incoming cookies intact, so the backend can read the `auth_verification` cookie.
- **FR-005**: The TLS certificate used by the frontend dev server MUST be valid for the hostname developers use to access the dev server (`localhost`), so browsers accept the HTTPS connection without bypassing security warnings.
- **FR-006**: After a successful callback, the `access_token` cookie MUST be scoped to the frontend proxy origin so that all subsequent proxied API calls include it automatically.
- **FR-007**: The logout flow MUST clear all session-related cookies on the frontend origin, not only on the backend origin.

### Key Entities

- **Frontend proxy origin**: The base URL (`scheme://host:port`) from which the developer accesses the application. All Auth0 redirects must target this origin.
- **Auth0 Allowed Callback URL**: The URL registered in the Auth0 dashboard that Auth0 is permitted to redirect to after login. Must match the frontend proxy origin's callback path exactly.
- **`auth_verification` cookie**: A short-lived transaction cookie set by `express-openid-connect` during the login redirect. Must be present — and on the same origin — when the callback is processed.
- **`access_token` cookie**: The HttpOnly cookie storing the JWT after login. Must be scoped to the frontend proxy origin to be included in proxied requests.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer can complete the full login flow (landing page → Auth0 → authenticated app) in under 60 seconds with zero manual steps beyond entering credentials.
- **SC-002**: Zero occurrences of the `auth_verification cookie not found` error during normal login across 10 consecutive attempts.
- **SC-003**: The frontend dev server port is identical on 5 consecutive restarts.
- **SC-004**: Logout results in a 401 response on all protected endpoints within 5 seconds of the logout action completing.

## Assumptions

- Both servers are started before the login flow is attempted; the spec does not address sequencing or dependency startup.
- The developer has valid Auth0 credentials and access to the Auth0 dashboard to update the Allowed Callback URLs.
- The Auth0 tenant is already provisioned with the correct API audience and Post-Login Action; only the callback URL needs updating.
- The self-signed TLS certificate for `localhost` can be generated locally using standard tooling and trusted in the developer's browser or system keychain.
- The Vite proxy's cookie-forwarding behaviour (already implemented) is sufficient once the redirect_uri points through the proxy; no additional proxy changes are required for cookie forwarding.
- Production environments are out of scope; this fix applies only to the local development configuration.
