import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Logger } from '../utils/logger';

const snsClient = new SNSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export type NotificationEventType =
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'party_locked'
  | 'assignment_completed'
  | 'gift_updated';

export interface NotificationPayload {
  type: NotificationEventType;
  party_id: string;
  recipient_email: string;
  data: Record<string, string>;
}

/**
 * Publishes a notification event to SNS.
 * The SNS topic ARN is read from the SNS_TOPIC_ARN environment variable.
 */
export async function publishNotification(payload: NotificationPayload): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) {
    Logger.warn('SNS_TOPIC_ARN is not set — skipping notification');
    return;
  }

  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(payload),
    Subject: `Secret Santa - ${payload.type}`,
    MessageAttributes: {
      eventType: {
        DataType: 'String',
        StringValue: payload.type,
      },
    },
  });

  try {
    await snsClient.send(command);
  } catch (err) {
    Logger.error(`publishNotification: SNS PublishCommand failed for event '${payload.type}' party '${payload.party_id}'`, err instanceof Error ? err.message : String(err));
    throw err;
  }
  Logger.info(`SNS notification published: ${payload.type} for party ${payload.party_id}`);
}
