import type { EmailerEvent } from './types/emailerEvent.js';
import { resolveContent } from './services/contentResolver.js';
import { sendEmail } from './services/emailSender.js';
import { Logger } from './utils/logger.js';

/**
 * Lambda handler — invoked by EventBridge when a new pending Invitation record is inserted.
 * Resolves email content from S3 and sends a transactional email to the invitee.
 */
export const handler = async (event: EmailerEvent): Promise<void> => {
  if (!event.email || typeof event.email !== 'string') {
    const msg = `handler: invalid event — email must be a non-empty string`;
    Logger.error(msg);
    throw new Error(msg);
  }
  if (!event.messageObject.bucket || typeof event.messageObject.bucket !== 'string') {
    const msg = `handler: invalid event — messageObject.bucket must be a non-empty string`;
    Logger.error(msg);
    throw new Error(msg);
  }
  if (!event.messageObject.object || typeof event.messageObject.object !== 'string') {
    const msg = `handler: invalid event — messageObject.object must be a non-empty string`;
    Logger.error(msg);
    throw new Error(msg);
  }

  Logger.info(`handler: invoked`, `email='${event.email}' bucket='${event.messageObject.bucket}' object='${event.messageObject.object}'`);

  try {
    const content = await resolveContent(event.messageObject);
    await sendEmail(event.email, content.subject, content.message);
    Logger.info(`handler: invitation email dispatched successfully`, `email='${event.email}'`);
  } catch (err) {
    Logger.error(
      `handler: failed to dispatch invitation email for email='${event.email}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};
