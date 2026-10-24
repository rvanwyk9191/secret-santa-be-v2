import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '../utils/logger.js';

const sesClient = new SESClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

// TODO: replace with a verified SES sender address before deployment
const FROM_ADDRESS = process.env['SES_FROM_ADDRESS'] ?? 'noreply@example.com';

/**
 * Sends a transactional email via AWS SES.
 */
export async function sendEmail(to: string, subject: string, message: string): Promise<void> {
  try {
    await sesClient.send(
      new SendEmailCommand({
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: message, Charset: 'UTF-8' } },
        },
        Source: FROM_ADDRESS,
      })
    );
  } catch (err) {
    Logger.error(
      `emailSender: SES SendEmailCommand failed for to='${to}' subject='${subject}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  Logger.info(`emailSender: email sent successfully to='${to}'`);
}
