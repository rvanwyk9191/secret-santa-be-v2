import express, { Router } from 'express';
import type { Request, Response } from 'express';
import https from 'https';
import fs from 'fs';
import partyRouter from './partyController';
import invitationRouter from './invitationController';
import registrationRouter from './registrationController';
import profileRouter from './profileController';
import giftRouter from './giftController';
import partyLockRouter from './partyLockController';
import partyUnlockRouter from './partyUnlockController';
import partyUpdateRouter from './partyUpdateController';
import partyMemberRouter from './partyMemberController';
import partyDeleteRouter from './partyDeleteController';
import partyEmailRouter from './partyEmailController';
import pendingInvitesRouter from './pendingInvitesController';
import assignmentRouter from './assignmentController';
import meRouter from './meController';
import { Logger } from '../utils/logger';
import { createAuthMiddleware, authRouter } from '../auth/authRouter';
import { createCheckJwt } from '../auth/auth0';

const app = express();
const port = 8080;

function logRoutes(stack: any[], basePath: string): void {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods as Record<string, boolean>)
        .map(m => m.toUpperCase())
        .join(',');
      const path = (layer.route.path as string | undefined) ?? layer.regexp?.source ?? '(unknown)';
      Logger.info(`[ROUTE] ${methods} ${basePath}${path}`);
    } else if (layer.handle?.stack) {
      logRoutes(layer.handle.stack as any[], basePath);
    }
  }
}

async function main(): Promise<void> {
  const authMiddleware = await createAuthMiddleware();
  const checkJwt = await createCheckJwt();

  // Log every auth route hit so the login → callback order is visible in server output.
  app.use((req: Request, _res, next) => {
    if (req.path.startsWith('/api/auth/')) {
      const cookieHeader = req.headers.cookie ?? '(none)';
      const hasAuthVerification = cookieHeader.includes('auth_verification');
      Logger.info(`[AUTH] ${req.method} ${req.path} | cookies: ${hasAuthVerification ? 'auth_verification=✓' : 'auth_verification=MISSING'} | raw: ${cookieHeader.slice(0, 120)}`);
    }
    next();
  });

  // Clear the access_token cookie on logout BEFORE the OIDC middleware redirects to Auth0.
  // express-openid-connect only clears appSession; our custom access_token cookie must be
  // cleared explicitly or the JWT remains valid and the frontend stays "logged in".
  app.get('/api/auth/logout', (req: Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.clearCookie('access_token', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    next();
  });

  // OIDC session middleware at app level — handles /api/auth/login, /api/auth/callback, /api/auth/logout
  app.use(authMiddleware);
  app.use(express.json());

  const router = Router();

  // Public routes — no JWT required
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth utility routes — no JWT required
  router.use(authRouter);

  // Invitation acceptance — no JWT required. Uses the OIDC session cookie from the login
  // flow. Unauthenticated visitors are redirected to Auth0 login and returned here after sign-in.
  router.use(registrationRouter);

  // Cookie JWT validation (constitution v1.13) — all routes below require a valid access_token cookie.
  // Bearer header auth is rejected; the JWT is read from the access_token HttpOnly cookie.
  router.use(checkJwt);
  router.use(partyRouter);
  router.use(partyUpdateRouter);
  router.use(invitationRouter);
  router.use(profileRouter);
  router.use(giftRouter);
  router.use(partyLockRouter);
  router.use(partyUnlockRouter);
  router.use(partyMemberRouter);
  router.use(partyDeleteRouter);
  router.use(partyEmailRouter);
  router.use(assignmentRouter);
  router.use(meRouter);
  router.use(pendingInvitesRouter);

  app.use('/api', router);

  // Global error handler — catches any error passed to next(err) from route handlers or middleware.
  // Domain errors (ServiceError) carry a statusCode; express-jwt errors carry a status property.
  // Both are forwarded directly; everything else becomes HTTP 500.
  app.use((err: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
    const e = err as { statusCode?: number; status?: number; message?: string };
    const httpStatus = e.statusCode ?? e.status;
    Logger.error(`Error [${httpStatus ?? 500}]: ${err instanceof Error ? err.message : String(err)}`);
    if (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) {
      res.status(httpStatus).json({ error: { message: e.message ?? 'Unknown error' } });
      return;
    }
    res.status(500).json({ error: { message: 'Internal server error' } });
  });

  const baseURL = process.env['BASE_URL'] ?? 'https://127.0.0.1:8080';
  const useHttps = new URL(baseURL).protocol === 'https:';

  if (useHttps) {
    const keyPath = process.env['SSL_KEY_PATH'];
    const certPath = process.env['SSL_CERT_PATH'];
    if (!keyPath || !certPath) {
      throw new Error('SSL_KEY_PATH and SSL_CERT_PATH env vars are required when BASE_URL uses https://');
    }
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    https.createServer({ key, cert }, app).listen(port, () => {
      Logger.info(`Server is running on https://127.0.0.1:${port}`);
      logRoutes(router.stack, '/api');
    });
  } else {
    app.listen(port, () => {
      Logger.info(`Server is running on http://127.0.0.1:${port}`);
      logRoutes(router.stack, '/api');
    });
  }
}

main().catch((err: unknown) => {
  Logger.error('Failed to start server', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
