// Constitution v1.8: all downstream services MUST be mocked

jest.mock('../../src/services/contentResolver.js', () => ({
  resolveContent: jest.fn(),
}));

jest.mock('../../src/services/partyResolver.js', () => ({
  resolvePartyName: jest.fn(),
}));

jest.mock('../../src/services/emailSender.js', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { handler } from '../../src/handler.js';
import { resolveContent } from '../../src/services/contentResolver.js';
import { resolvePartyName } from '../../src/services/partyResolver.js';
import { sendEmail } from '../../src/services/emailSender.js';
import { Logger } from '../../src/utils/logger.js';
import type { EmailerEvent } from '../../src/types/emailerEvent.js';

const validEvent: EmailerEvent = {
  email: 'invitee@example.com',
  messageObject: { bucket: 'PLACEHOLDER_BUCKET', object: 'PLACEHOLDER_OBJECT_KEY' },
};

const enrichedEvent: EmailerEvent = {
  email: 'invitee@example.com',
  messageObject: { bucket: 'secret-santa-rvw-emails', object: 'invitation.json' },
  eventIdentifier: 'party-abc',
  token: 'test-invite-token',
};

const validInput = [validEvent];
const enrichedInput = [enrichedEvent];

describe('handler', () => {
  beforeEach(() => {
    (resolveContent as jest.Mock).mockReset();
    (resolvePartyName as jest.Mock).mockReset();
    (sendEmail as jest.Mock).mockReset();
    (Logger.error as jest.Mock).mockReset();
    (Logger.info as jest.Mock).mockReset();
  });

  it('calls resolveContent with messageObject from event', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validInput);

    expect(resolveContent).toHaveBeenCalledWith(validEvent.messageObject);
  });

  it('calls sendEmail with email, subject, and message from resolved content', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'You are invited!', message: 'Join the party.' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validInput);

    expect(sendEmail).toHaveBeenCalledWith('invitee@example.com', 'You are invited!', 'Join the party.');
  });

  it('logs success after both services resolve', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validInput);

    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining('invitation email dispatched successfully'),
      expect.stringContaining('invitee@example.com')
    );
  });

  it('logs error and re-throws when resolveContent rejects', async () => {
    (resolveContent as jest.Mock).mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(handler(validInput)).rejects.toThrow('S3 unavailable');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to dispatch invitation email'),
      expect.stringContaining('S3 unavailable')
    );
  });

  it('logs error and re-throws when sendEmail rejects', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('SES quota exceeded'));

    await expect(handler(validInput)).rejects.toThrow('SES quota exceeded');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to dispatch invitation email'),
      expect.stringContaining('SES quota exceeded')
    );
  });

  describe('content enrichment (eventIdentifier + secret-santa-rvw-emails bucket)', () => {
    it('calls resolvePartyName with eventIdentifier when bucket matches', async () => {
      (resolveContent as jest.Mock).mockResolvedValueOnce({
        subject: 'Invited to join <placeholder for the party name>',
        message: 'Join here: <placeholder for link that directs to join the party with the party id>',
      });
      (resolvePartyName as jest.Mock).mockResolvedValueOnce('Winter Wonderland');
      (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

      await handler(enrichedInput);

      expect(resolvePartyName).toHaveBeenCalledWith('party-abc');
    });

    it('sends enriched subject/message with party name after placeholder replacement', async () => {
      (resolveContent as jest.Mock).mockResolvedValueOnce({
        subject: "You've been invited to join <placeholder for the party name>",
        message: 'Click on the link to join your party. <placeholder for link that directs to join the party with the party id>',
      });
      (resolvePartyName as jest.Mock).mockResolvedValueOnce('Winter Wonderland');
      (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

      await handler(enrichedInput);

      expect(sendEmail).toHaveBeenCalledWith(
        'invitee@example.com',
        "You've been invited to join Winter Wonderland",
        'Click on the link to join your party. https://127.0.0.1:8080/api/parties/party-abc/invitations/test-invite-token'
      );
    });

    it('replaces link placeholder with empty string and logs a warning when token is absent', async () => {
      const noTokenEvent: EmailerEvent = {
        email: 'invitee@example.com',
        messageObject: { bucket: 'secret-santa-rvw-emails', object: 'invitation.json' },
        eventIdentifier: 'party-abc',
      };
      (resolveContent as jest.Mock).mockResolvedValueOnce({
        subject: 'Invited to join <placeholder for the party name>',
        message: 'Link: <placeholder for link that directs to join the party with the party id>',
      });
      (resolvePartyName as jest.Mock).mockResolvedValueOnce('Winter Wonderland');
      (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

      await handler([noTokenEvent]);

      expect(sendEmail).toHaveBeenCalledWith(
        'invitee@example.com',
        'Invited to join Winter Wonderland',
        'Link: '
      );
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('token missing')
      );
    });

    it('skips resolvePartyName when eventIdentifier is absent', async () => {
      (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
      (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

      await handler(validInput);

      expect(resolvePartyName).not.toHaveBeenCalled();
    });

    it('logs error and re-throws when resolvePartyName rejects', async () => {
      (resolveContent as jest.Mock).mockResolvedValueOnce({
        subject: 'Invited to join <placeholder for the party name>',
        message: 'Body',
      });
      (resolvePartyName as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB unavailable'));

      await expect(handler(enrichedInput)).rejects.toThrow('DynamoDB unavailable');
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed to dispatch invitation email'),
        expect.stringContaining('DynamoDB unavailable')
      );
    });
  });
});
