import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { acceptInvitation } from '../services/registrationService';
import { Logger } from '../utils/logger';

const registrationRouter = Router();

/**
 * GET /api/parties/:party_id/invitations/:token
 *
 * Magic-link entry point for invited users. No Bearer token is required — auth is handled
 * through the OIDC session cookie set by the Auth0 login flow:
 *
 *   1. Unauthenticated visitor: redirect to Auth0 login with `returnTo` pointing back here.
 *   2. Authenticated visitor (returnTo brought them back after login): accept the invitation
 *      using the email from the OIDC session, then redirect to the app root.
 */
registrationRouter.get(
  '/parties/:party_id/invitations/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    const { party_id, token } = req.params as { party_id: string; token: string };

    if (!party_id || party_id.trim().length === 0) {
      res.status(400).json({ error: { message: 'party_id is required.' } });
      return;
    }

    if (!token || token.trim().length === 0) {
      res.status(400).json({ error: { message: 'token is required.' } });
      return;
    }

    // If the user is not logged in, initiate the Auth0 login flow and return them here after.
    if (!req.oidc?.isAuthenticated()) {
      Logger.info(
        `registrationController: unauthenticated visit — redirecting to login (party=${party_id})`
      );
      res.oidc.login({ returnTo: req.originalUrl });
      return;
    }

    // User is authenticated — extract email from the OIDC session (ID token).
    const userEmail = req.oidc.user?.email as string | undefined;
    if (!userEmail) {
      Logger.warn('registrationController: authenticated session missing email claim');
      res.status(401).json({ error: { message: 'Unauthorized: missing email in session.' } });
      return;
    }

    try {
      await acceptInvitation(party_id.trim(), token.trim(), userEmail);

      Logger.info(`registrationController: invitation accepted party=${party_id} user=${userEmail}`);
      // Redirect to the app root; the frontend can detect membership and show the party view.
      res.redirect(302, '/');
    } catch (err) {
      const statusCode = (err as any).statusCode as number | undefined;
      if (statusCode === 404 || statusCode === 403 || statusCode === 409) {
        res
          .status(statusCode)
          .json({ error: { message: err instanceof Error ? err.message : 'Unknown error' } });
        return;
      }
      next(err);
    }
  }
);

export default registrationRouter;
