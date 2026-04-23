import express, { Router } from 'express';
import type { Request, Response } from 'express';
import https from 'https';
import fs from 'fs';
import partyRouter from './partyController';
import invitationRouter from './invitationController';
import { Logger } from '../utils/logger';
import { createAuthMiddleware, authRouter } from '../auth/authRouter';
import { createCheckJwt } from '../auth/auth0';

const app = express();
const port = 3000;

function logRoutes(stack: any[], basePath: string): void {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods as Record<string, boolean>)
        .map(m => m.toUpperCase())
        .join(',');
      Logger.info(`[ROUTE] ${methods} ${basePath}${layer.path as string}`);
    } else if (layer.handle?.stack) {
      logRoutes(layer.handle.stack as any[], basePath);
    }
  }
}

async function main(): Promise<void> {
  const authMiddleware = await createAuthMiddleware();
  const checkJwt = await createCheckJwt();

  // OIDC session middleware at app level — handles /api/auth/login, /api/auth/callback, /api/auth/logout
  app.use(authMiddleware);
  app.use(express.json());

  const router = Router();

  // Public routes — no JWT required
  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth utility route — no JWT required (/api/auth/token returns tokens after login)
  router.use(authRouter);

  // JWT validation — all routes registered below this point require a valid Bearer token
  router.use(checkJwt);
  router.use(partyRouter);
  router.use(invitationRouter);

  app.use('/api', router);

  // Global error handler — catches any error passed to next(err) from route handlers or middleware.
  // Returns a structured HTTP 500 so unhandled service errors never crash the process.
  app.use((err: unknown, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
    Logger.error('Unhandled error', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: { message: 'Internal server error' } });
  });

  const baseURL = process.env['BASE_URL'] ?? 'https://127.0.0.1:3000';
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
