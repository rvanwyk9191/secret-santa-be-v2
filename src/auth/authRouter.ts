// src/auth/authRouter.ts
// Auth0 Authorization Code Flow — Auth0 credentials sourced from AWS SSM Parameter Store

import { Router } from 'express';
import { auth } from 'express-openid-connect';
import type { Request, Response, RequestHandler } from 'express';
import { getConfigParam } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const SSM_AUTH0_PREFIX = '/secret-santa/auth0';

/**
 * Creates the express-openid-connect middleware.
 *
 * SSM paths used (Auth0 credentials):
 *   /secret-santa/auth0/domain          — Auth0 tenant domain
 *   /secret-santa/auth0/client_id       — OAuth client ID
 *   /secret-santa/auth0/client_secret   — OAuth client secret (SecureString)
 *   /secret-santa/auth0/audience        — API audience identifier
 *
 * Environment variables used (app config):
 *   SESSION_SECRET  — Cookie session encryption secret (required)
 *   BASE_URL        — Application base URL (default: https://127.0.0.1:3000); MUST use https://; Auth0 does not allow 'localhost'
 *
 * Login flow (browser-based):
 *   1. GET /api/auth/login    → redirects to Auth0 Universal Login
 *   2. GET /api/auth/callback → exchanges authorization code for tokens, stores in session
 *   3. GET /api/auth/token    → returns access_token for use as Authorization: Bearer header
 *   4. GET /api/auth/logout   → clears session and redirects to Auth0 logout
 */
export async function createAuthMiddleware(): Promise<RequestHandler> {
  Logger.info('authRouter: loading configuration from SSM Parameter Store');

  let domain: string | undefined;
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let audience: string | undefined;
  try {
    [domain, clientId, clientSecret, audience] = await Promise.all([
      getConfigParam(`${SSM_AUTH0_PREFIX}/domain`),
      getConfigParam(`${SSM_AUTH0_PREFIX}/client_id`),
      getConfigParam(`${SSM_AUTH0_PREFIX}/client_secret`, { decrypt: true }),
      getConfigParam(`${SSM_AUTH0_PREFIX}/audience`),
    ]);
  } catch (err) {
    Logger.error('authRouter: failed to load SSM configuration', err instanceof Error ? err.message : String(err));
    throw err;
  }

  if (!domain) throw new Error('SSM param missing: /secret-santa/auth0/domain');
  if (!clientId) throw new Error('SSM param missing: /secret-santa/auth0/client_id');
  if (!clientSecret) throw new Error('SSM param missing: /secret-santa/auth0/client_secret');
  if (!audience) throw new Error('SSM param missing: /secret-santa/auth0/audience');

  const sessionSecret = process.env['SESSION_SECRET'];
  const baseURL = process.env['BASE_URL'] ?? 'https://127.0.0.1:3000';

  if (!sessionSecret) throw new Error('Environment variable SESSION_SECRET is required');

  // Constitution v1.4: HTTPS required for all environments, including local dev.
  // Auth0 does not allow 'localhost' as a callback URL — use 127.0.0.1.
  if (!baseURL.startsWith('https://')) {
    throw new Error('BASE_URL must use HTTPS in all environments (constitution v1.4)');
  }

  Logger.info('authRouter: SSM configuration loaded, creating OIDC middleware');

  const middleware = auth({
    authRequired: false,
    auth0Logout: true,
    secret: sessionSecret,
    baseURL,
    clientID: clientId,
    issuerBaseURL: `https://${domain}`,
    clientSecret,
    authorizationParams: {
      response_type: 'code',
      scope: 'openid profile email',
      audience,
    },
    routes: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      callback: '/api/auth/callback',
    },
    // SameSite=None;Secure required so the auth_verification transaction cookie
    // survives the cross-site redirect back from Auth0 (Phase 4.8 fix).
    transactionCookie: {
      sameSite: 'None',
    },
    session: {
      cookie: {
        sameSite: 'None',
        secure: true,
      },
    },
  });

  Logger.info('authRouter: OIDC middleware ready; flows at /api/auth/login, /api/auth/callback, /api/auth/logout');
  return middleware;
}

/**
 * Router for auth utility endpoints (no JWT required).
 * Mount at /api to expose GET /api/auth/token.
 *
 * GET /api/auth/token
 *   Returns the access_token and id_token from the active OIDC session.
 *   Requires the user to have completed the login flow (/api/auth/login) first.
 *   Use the returned access_token as a Bearer token for all protected API calls.
 */
export const authRouter = Router();

authRouter.get('/auth/token', (req: Request, res: Response) => {
  Logger.info('authRouter: token endpoint requested');

  if (!req.oidc.isAuthenticated()) {
    Logger.warn('authRouter: token requested but user is not authenticated');
    res.status(401).json({ error: 'Not authenticated. Visit /api/auth/login to authenticate.' });
    return;
  }

  Logger.info('authRouter: returning tokens for authenticated user');
  res.json({
    access_token: req.oidc.accessToken?.access_token,
    id_token: req.oidc.idToken,
  });
});
