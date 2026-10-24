import type { Request, Response } from 'express';

/**
 * Reads the caller's email from the validated JWT cookie payload.
 * The Auth0 Post-Login Action sets `registered_user_email` as a custom claim.
 *
 * If the claim is absent, writes a 401 response and returns `undefined`.
 * Callers must `return` immediately when this returns `undefined`.
 */
export function getCallerEmail(req: Request, res: Response): string | undefined {
  // express-jwt v8 stores the decoded payload directly at req.auth (not nested under req.auth.payload)
  const email = (req as any).auth?.['registered_user_email'] as string | undefined;
  if (!email) {
    res.status(401).json({ error: { message: 'Unauthorized: missing email claim in token.' } });
    return undefined;
  }
  return email;
}

/**
 * Enforces self-authorization: the caller's email must match the target member's email.
 * If they differ, writes a 403 response and returns `false`.
 * Callers must `return` immediately when this returns `false`.
 *
 * @param callerEmail  - Email from the JWT (already lowercased by getCallerEmail)
 * @param memberEmail  - Email decoded from the URL parameter (already lowercased)
 * @param forbiddenMessage - Custom message for the 403 body
 */
export function assertSelfAuthorized(
  callerEmail: string,
  memberEmail: string,
  res: Response,
  forbiddenMessage: string
): boolean {
  if (callerEmail.toLowerCase() !== memberEmail) {
    res.status(403).json({ error: { message: forbiddenMessage } });
    return false;
  }
  return true;
}
