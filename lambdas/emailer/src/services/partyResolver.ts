import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { Logger } from '../utils/logger.js';

const dynamoClient = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const PARTIES_TABLE = process.env['PARTIES_TABLE_NAME'] ?? 'Parties';

/**
 * Looks up the party name from the Parties DynamoDB table by party_id.
 * Returns an empty string if the item or name field is not found.
 */
export async function resolvePartyName(partyId: string): Promise<string> {
  let response;
  try {
    response = await dynamoClient.send(
      new GetItemCommand({
        TableName: PARTIES_TABLE,
        Key: { party_id: { S: partyId } },
      })
    );
  } catch (err) {
    Logger.error(
      `partyResolver: DynamoDB GetItem failed for party_id='${partyId}'`,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  const name = response.Item?.['name']?.S;
  if (!name) {
    Logger.warn(`partyResolver: party name not found for party_id='${partyId}'`);
    return '';
  }

  Logger.info(`partyResolver: resolved party name for party_id='${partyId}'`, `name='${name}'`);
  return name;
}
