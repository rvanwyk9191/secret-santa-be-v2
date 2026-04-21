// src/auth/auth0.ts
// Auth0 authentication/authorization integration scaffold

import { expressjwt } from 'express-jwt';
import type { GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import type { RequestHandler } from 'express';

// TODO: Replace with your Auth0 domain and audience
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'YOUR_AUTH0_DOMAIN';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'YOUR_AUTH0_AUDIENCE';

export const checkJwt: RequestHandler = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience: AUTH0_AUDIENCE,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

// Usage: app.use('/api', checkJwt) to protect API routes
