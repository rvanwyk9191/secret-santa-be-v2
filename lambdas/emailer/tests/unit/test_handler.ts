// Constitution v1.8: all downstream services MUST be mocked

jest.mock('../../src/services/contentResolver.js', () => ({
  resolveContent: jest.fn(),
}));

jest.mock('../../src/services/emailSender.js', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { handler } from '../../src/handler.js';
import { resolveContent } from '../../src/services/contentResolver.js';
import { sendEmail } from '../../src/services/emailSender.js';
import { Logger } from '../../src/utils/logger.js';
import type { EmailerEvent } from '../../src/types/emailerEvent.js';

const validEvent: EmailerEvent = {
  email: 'invitee@example.com',
  messageObject: { bucket: 'PLACEHOLDER_BUCKET', object: 'PLACEHOLDER_OBJECT_KEY' },
};

describe('handler', () => {
  beforeEach(() => {
    (resolveContent as jest.Mock).mockReset();
    (sendEmail as jest.Mock).mockReset();
    (Logger.error as jest.Mock).mockReset();
    (Logger.info as jest.Mock).mockReset();
  });

  it('calls resolveContent with messageObject from event', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validEvent);

    expect(resolveContent).toHaveBeenCalledWith(validEvent.messageObject);
  });

  it('calls sendEmail with email, subject, and message from resolved content', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'You are invited!', message: 'Join the party.' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validEvent);

    expect(sendEmail).toHaveBeenCalledWith('invitee@example.com', 'You are invited!', 'Join the party.');
  });

  it('logs success after both services resolve', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await handler(validEvent);

    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining('invitation email dispatched successfully'),
      expect.stringContaining('invitee@example.com')
    );
  });

  it('logs error and re-throws when resolveContent rejects', async () => {
    (resolveContent as jest.Mock).mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(handler(validEvent)).rejects.toThrow('S3 unavailable');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to dispatch invitation email'),
      expect.stringContaining('S3 unavailable')
    );
  });

  it('logs error and re-throws when sendEmail rejects', async () => {
    (resolveContent as jest.Mock).mockResolvedValueOnce({ subject: 'Hi', message: 'Welcome' });
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('SES quota exceeded'));

    await expect(handler(validEvent)).rejects.toThrow('SES quota exceeded');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to dispatch invitation email'),
      expect.stringContaining('SES quota exceeded')
    );
  });
});
