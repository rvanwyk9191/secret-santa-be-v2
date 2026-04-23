// Constitution v1.8: all AWS SDK calls MUST be mocked — no real SES calls

const mockSesSend = jest.fn();

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { sendEmail } from '../../src/services/emailSender.js';
import { Logger } from '../../src/utils/logger.js';

describe('emailSender', () => {
  beforeEach(() => {
    mockSesSend.mockReset();
    (Logger.error as jest.Mock).mockReset();
    (Logger.info as jest.Mock).mockReset();
  });

  it('calls SendEmailCommand with correct To, Subject, and Body', async () => {
    const { SendEmailCommand } = await import('@aws-sdk/client-ses');
    mockSesSend.mockResolvedValueOnce({});

    await sendEmail('invitee@example.com', 'You are invited!', 'Join the party.');

    expect(SendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Destination: { ToAddresses: ['invitee@example.com'] },
        Message: expect.objectContaining({
          Subject: expect.objectContaining({ Data: 'You are invited!' }),
          Body: expect.objectContaining({
            Text: expect.objectContaining({ Data: 'Join the party.' }),
          }),
        }),
      })
    );
  });

  it('resolves successfully and logs when SES send succeeds', async () => {
    mockSesSend.mockResolvedValueOnce({});

    await expect(sendEmail('invitee@example.com', 'Subject', 'Message')).resolves.toBeUndefined();
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining("email sent successfully to='invitee@example.com'"));
  });

  it('logs error and re-throws when SES send rejects', async () => {
    mockSesSend.mockRejectedValueOnce(new Error('SES quota exceeded'));

    await expect(sendEmail('invitee@example.com', 'Subject', 'Message')).rejects.toThrow('SES quota exceeded');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('SES SendEmailCommand failed'),
      expect.stringContaining('SES quota exceeded')
    );
  });
});
