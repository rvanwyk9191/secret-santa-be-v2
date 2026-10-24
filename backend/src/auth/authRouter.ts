// src/auth/authRouter.ts
// Auth0 Authorization Code Flow — Auth0 credentials sourced from AWS SSM Parameter Store

import { Router } from 'express';
import { auth } from 'express-openid-connect';
import type { Session } from 'express-openid-connect';
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
 *   BASE_URL        — Application base URL (default: https://localhost:3000); MUST use https://
 *
 * Login flow (browser-based):
 *   1. GET /api/auth/login    → redirects to Auth0 Universal Login
 *   2. GET /api/auth/callback → exchanges authorization code for tokens, stores in session,
 *                               and sets the access_token as an HttpOnly cookie (constitution v1.13)
 *   3. GET /api/auth/logout   → clears session and redirects to Auth0 logout
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
  const baseURL = process.env['BASE_URL'] ?? 'https://localhost:3000';

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
      prompt: 'select_account',
    },
    routes: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      callback: '/api/auth/callback',
    },
    // SameSite=Lax is correct for Authorization Code Flow (GET callback).
    // Lax cookies are sent on top-level cross-site GET navigations (Auth0 redirect),
    // which avoids Chrome's restrictions on SameSite=None cookies from IP origins.
    // The library automatically switches to SameSite=None when response_mode=form_post.
    transactionCookie: {
      sameSite: 'Lax',
    },
    session: {
      cookie: {
        sameSite: 'None',
        secure: true,
        // Explicit path=/ ensures the session and transaction cookies are
        // available on all paths, not just the /api/auth/ subtree inferred
        // from the login request URL when Path is omitted.
        path: '/',
      },
    },
    // Constitution v1.13: store the access_token as an HttpOnly cookie after login
    // so all subsequent authenticated requests use the cookie, not a Bearer header.
    afterCallback: async (_req: Request, res: Response, session: Session) => {
      const accessToken = session.access_token;
      if (accessToken) {
        res.cookie('access_token', accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        });
        Logger.info('authRouter: access_token cookie set after callback');
      } else {
        Logger.warn('authRouter: no access_token in session after callback');
      }
      return session;
    },
  });

  Logger.info('authRouter: OIDC middleware ready; flows at /api/auth/login, /api/auth/callback, /api/auth/logout');
  return middleware;
}

/**
 * Router for auth utility endpoints (no JWT required).
 */
export const authRouter = Router();

// GET /api/auth/logout — handled by express-openid-connect directly
// GET /api/auth/token endpoint removed (constitution v1.13): access_token is delivered as
// an HttpOnly cookie after the callback and MUST NOT be returned in a JSON response body.
