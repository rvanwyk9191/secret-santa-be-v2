import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { EmailContent } from '../types/emailContent.js';
import { Logger } from '../utils/logger.js';

const s3Client = new S3Client({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

/**
 * Fetches email content from an S3 object and parses it as JSON.
 * The S3 object must contain a JSON body with `subject` and `message` fields.
 */
export async function resolveContent(messageObject: { bucket: string; object: string }): Promise<EmailContent> {
  let response;
  try {
    response = await s3Client.send(
      new GetObjectCommand({ Bucket: messageObject.bucket, Key: messageObject.object })
    );
  } catch (err) {
    Logger.error(
      `contentResolver: S3 GetObjectCommand failed for bucket='${messageObject.bucket}' key='${messageObject.object}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  const raw = await response.Body?.transformToString();
  if (!raw) {
    const msg = `contentResolver: S3 object body was empty for key='${messageObject.object}'`;
    Logger.error(msg);
    throw new Error(msg);
  }

  let content: EmailContent;
  try {
    content = JSON.parse(raw) as EmailContent;
  } catch (err) {
    const excerpt = raw.slice(0, 200);
    Logger.error(
      `contentResolver: EmailContent JSON parse failed for key='${messageObject.object}' excerpt='${excerpt}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw new Error(`EmailContent JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  Logger.info(`contentResolver: resolved email content for key='${messageObject.object}'`);
  return content;
}
