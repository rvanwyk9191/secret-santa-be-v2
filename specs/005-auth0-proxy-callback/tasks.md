# Tasks: Auth0 OIDC Callback via Frontend Proxy

**Feature**: 005-auth0-proxy-callback  
**Spec**: [spec.md](spec.md)  
**Created**: 2026-08-01  
**Total tasks**: 11  

---

## Dependencies

```
Phase 1 (Setup: localhost cert)
  └─► Phase 2 (Foundational: vite + BASE_URL wiring)
        └─► Phase 3 (US1: Auth0 dashboard + verify login)
              └─► Phase 4 (US2: verify logout)
                    └─► Phase 5 (US3: stable port — already covered by Phase 2)
                          └─► Final (README + docs)
```

US1 must pass before US2 can be verified. All foundational tasks (Phase 2) can be worked in parallel.

---

## Phase 1: Setup

> Generate the TLS certificate that covers `localhost` so the Vite dev server can serve HTTPS from that hostname. The existing cert (`127.0.0.1.pem`) only covers `127.0.0.1` and will be rejected by browsers for `localhost`.

- [x] T001 Generate self-signed TLS certificate for `localhost` in the repo root — run `openssl req -x509 -newkey rsa:2048 -keyout localhost-key.pem -out localhost.pem -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"` from `/Users/rvanwyk/code/secret-santa-v2/secret-santa-v2`

---

## Phase 2: Foundational

> Wire the two config changes that make the rest of the fix coherent: fix the Vite server to use the localhost cert and enforce a stable port, and update the backend's `BASE_URL` default so `express-openid-connect` generates a `redirect_uri` that goes through the proxy.

- [x] T002 [P] Update cert defaults in `frontend/vite.config.ts` — change `127.0.0.1-key.pem` → `localhost-key.pem` and `127.0.0.1.pem` → `localhost.pem` in the `keyPath`/`certPath` fallbacks (lines 7–9)
- [x] T003 [P] Add `strictPort: true` to the `server` block in `frontend/vite.config.ts` so the dev server fails explicitly when port 3000 is occupied instead of silently binding to 3001
- [x] T004 [P] Update the `BASE_URL` fallback in `backend/src/auth/authRouter.ts` from `'https://127.0.0.1:8080'` to `'https://localhost:3000'` (line 57) and update the surrounding JSDoc comment on line 23 to reflect the new default

---

## Phase 3: User Story 1 — Login Succeeds End-to-End

**Story goal**: Developer completes the full Auth0 login flow locally without a cookie error.

**Independent test criteria**: Navigate to `https://localhost:3000`, click "Log In", complete Auth0 Universal Login, and confirm the app dashboard loads in an authenticated state with no `auth_verification` error.

- [x] T005 [US1] Add `https://localhost:3000/api/auth/callback` to the **Allowed Callback URLs** in the Auth0 application dashboard
- [x] T006 [US1] Add `https://localhost:3000` to the **Allowed Logout URLs** in the Auth0 application dashboard
- [x] T007 [US1] Trust the `localhost.pem` certificate in the system/browser keychain so Chrome and Safari accept the HTTPS connection without a security warning (manual step — run `security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db localhost.pem` on macOS, or open the cert in Keychain Access and set "Always Trust")
- [x] T008 [US1] Login verified end-to-end — `[AUTH] GET /api/auth/callback | cookies: auth_verification=✓` confirmed in backend logs

---

## Phase 4: User Story 2 — Logout Clears Session Correctly

**Story goal**: A logged-in developer can log out and all cookies are cleared from the `localhost` origin.

**Independent test criteria**: Log in, trigger logout, confirm the landing page renders and that a direct `GET /api/me/parties` returns 401.

- [x] T009 [US2] Verify `backend/src/controllers/index.ts` logout handler — the `clearCookie` call for `access_token` must specify `path: '/'` so the cookie is cleared from all paths; confirmed `path: '/'` present on line 58, no change required
- [x] T010 [US2] Verify the `appSession` cookie (managed by `express-openid-connect`) is cleared after logout by checking the `Set-Cookie` response headers through the proxy; proxy `proxyRes` handler in `vite.config.ts` already explicitly forwards all `Set-Cookie` headers — no code change required

---

## Final Phase: Documentation

> Update developer-facing documentation so the new `localhost`-based setup is the authoritative local dev guide.

- [x] T011 Update the **Local development** section of `README.md`:
  - Change the cert generation command to use `-subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"` and output file names `localhost-key.pem` / `localhost.pem`
  - Change the `BASE_URL` export example to `https://localhost:3000`
  - Change `SSL_KEY_PATH` / `SSL_CERT_PATH` examples to reference `localhost-key.pem` / `localhost.pem`
  - Add a step to register `https://localhost:3000/api/auth/callback` in the Auth0 dashboard under Allowed Callback URLs
  - Add a step to trust the certificate in the macOS keychain

---

## Parallel Execution

Tasks T002, T003, and T004 have no dependencies on each other and can be applied in parallel:

```
T001 (cert)
  ├─ T002 (vite cert paths)  ─┐
  ├─ T003 (strictPort)        ├─► T005–T008 (US1 verification)
  └─ T004 (BASE_URL default) ─┘
```

T005–T007 are manual steps that can be done in parallel with T002–T004.

---

## Implementation Strategy

**MVP (User Story 1 only)**:  
Complete T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 in order. This is the minimum to unblock all local development.

T009–T010 (logout verification) and T011 (README) are lower risk and can follow once login is confirmed working.
