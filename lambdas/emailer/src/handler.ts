import type { EmailerEvent } from './types/emailerEvent.js';
import { resolveContent } from './services/contentResolver.js';
import { resolvePartyName } from './services/partyResolver.js';
import { sendEmail } from './services/emailSender.js';
import { Logger } from './utils/logger.js';

const EMAIL_CONTENT_BUCKET = 'secret-santa-rvw-emails';
const INVITATION_BASE_URL = process.env['INVITATION_BASE_URL'] ?? 'https://127.0.0.1:8080/api';

/**
 * Lambda handler — invoked by EventBridge when new pending Invitation records are inserted.
 * EventBridge delivers the event as an array of records. Each record is resolved from S3
 * and dispatched as a transactional email to the invitee.
 */
export const handler = async (events: EmailerEvent[]): Promise<void> => {
  Logger.debug('handler: invoked', events);

  await Promise.all(events.map(async (event) => {
    if (!event.email || typeof event.email !== 'string') {
      const msg = `handler: invalid event — email must be a non-empty string`;
      Logger.error(msg);
      throw new Error(msg);
    }
    if (!event.messageObject?.bucket || typeof event.messageObject.bucket !== 'string') {
      const msg = `handler: invalid event — messageObject.bucket must be a non-empty string`;
      Logger.error(msg);
      throw new Error(msg);
    }
    if (!event.messageObject?.object || typeof event.messageObject.object !== 'string') {
      const msg = `handler: invalid event — messageObject.object must be a non-empty string`;
      Logger.error(msg);
      throw new Error(msg);
    }

    Logger.info(`handler: processing record`, `email='${event.email}' bucket='${event.messageObject.bucket}' object='${event.messageObject.object}'`);

    try {
      const content = await resolveContent(event.messageObject);

      let enrichedContent = content;
      if (event.eventIdentifier && event.messageObject.bucket === EMAIL_CONTENT_BUCKET) {
        const partyName = await resolvePartyName(event.eventIdentifier);

        let invitationLink = '';
        if (event.eventIdentifier && event.token) {
          invitationLink = `${INVITATION_BASE_URL}/parties/${event.eventIdentifier}/invitations/${event.token}`;
        } else {
          Logger.warn(
            `handler: token missing for party='${event.eventIdentifier}' — invitation link will be empty`
          );
        }

        enrichedContent = {
          subject: content.subject.replace('<placeholder for the party name>', partyName),
          message: content.message.replace(
            '<placeholder for link that directs to join the party with the party id>',
            invitationLink
          ),
        };
      }

      await sendEmail(event.email, enrichedContent.subject, enrichedContent.message);
      Logger.info(`handler: invitation email dispatched successfully`, `email='${event.email}'`);
    } catch (err) {
      Logger.error(
        `handler: failed to dispatch invitation email for email='${event.email}'`,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }));
};
