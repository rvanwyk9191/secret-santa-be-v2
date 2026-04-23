import type { RequestHandler } from 'express';
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
export declare function createCheckJwt(): Promise<RequestHandler>;
//# sourceMappingURL=auth0.d.ts.map