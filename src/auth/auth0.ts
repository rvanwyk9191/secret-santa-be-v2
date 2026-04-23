// src/auth/auth0.ts
// Auth0 JWT middleware - configuration sourced from AWS SSM Parameter Store

import { expressjwt } from 'express-jwt';
import type { GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import type { RequestHandler } from 'express';
import { getConfigParam } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const SSM_AUTH0_PREFIX = '/secret-santa/auth0';

/**
 * Creates the Auth0 JWT validation middleware by retrieving all required
 * configuration values from AWS SSM Parameter Store.
 *
 * SSM paths used:
 *   /secret-santa/auth0/domain       — Auth0 tenant domain
 *   /secret-santa/auth0/audience     — API audience identifier
 *   /secret-santa/auth0/client_id    — OAuth client ID
 *   /secret-santa/auth0/client_secret — OAuth client secret (SecureString)
 *
 * Must be called during application startup before routes are registered.
 * Environment variables MUST NOT be used as the credential source.
 */
export async function createCheckJwt(): Promise<RequestHandler> {
  Logger.info('auth0: loading configuration from SSM Parameter Store');

  let domain: string | undefined;
  let audience: string | undefined;
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  try {
    [domain, audience, clientId, clientSecret] = await Promise.all([
      getConfigParam(`${SSM_AUTH0_PREFIX}/domain`),
      getConfigParam(`${SSM_AUTH0_PREFIX}/audience`),
      getConfigParam(`${SSM_AUTH0_PREFIX}/client_id`),
      getConfigParam(`${SSM_AUTH0_PREFIX}/client_secret`, { decrypt: true }),
    ]);
  } catch (err) {
    Logger.error('auth0: failed to load SSM configuration', err instanceof Error ? err.message : String(err));
    throw err;
  }

  if (!domain) {
    throw new Error('Auth0 domain not found in SSM: /secret-santa/auth0/domain');
  }
  if (!audience) {
    throw new Error('Auth0 audience not found in SSM: /secret-santa/auth0/audience');
  }
  if (!clientId) {
    throw new Error('Auth0 client_id not found in SSM: /secret-santa/auth0/client_id');
  }
  if (!clientSecret) {
    throw new Error('Auth0 client_secret not found in SSM: /secret-santa/auth0/client_secret');
  }

  Logger.info('auth0: SSM configuration loaded, creating JWT middleware');

  return expressjwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${domain}/.well-known/jwks.json`,
    }) as GetVerificationKey,
    audience,
    issuer: `https://${domain}/`,
    algorithms: ['RS256'],
  });
}
