import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../utils/dynamodb.js';
import { Logger } from '../utils/logger.js';
import { serviceError } from '../utils/serviceError.js';

const PROFILE_TABLE = 'UserProfiles';
const fields = ['first_name', 'last_name'] as const;
type NameField = (typeof fields)[number];
type StoredNames = Partial<Record<NameField, string>>;

interface AccountProfile {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

async function readProfile(email: string): Promise<StoredNames | undefined> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: PROFILE_TABLE,
      Key: { email },
      ConsistentRead: true,
    }));
    return result.Item;
  } catch (error) {
    Logger.error('accountProfileService: account lookup failed', error instanceof Error ? error.name : 'Unknown error');
    throw error;
  }
}

async function resolveNames(email: string, stored?: StoredNames): Promise<AccountProfile> {
  const profile: AccountProfile = {
    email,
    first_name: stored?.first_name?.trim() || null,
    last_name: stored?.last_name?.trim() || null,
  };
  const missing = fields.filter(field => profile[field] === null);
  if (missing.length === 0) return profile;

  const candidates = { first_name: new Set<string>(), last_name: new Set<string>() };
  try {
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await dynamoClient.send(new QueryCommand({
        TableName: 'PartyMembers',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        ProjectionExpression: 'first_name, last_name',
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }));
      for (const item of page.Items ?? []) {
        for (const field of missing) {
          const value = item[field];
          if (typeof value === 'string' && value.trim()) candidates[field].add(value.trim());
        }
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey && Object.keys(startKey).length);
  } catch (error) {
    Logger.error('accountProfileService: membership name lookup failed', error instanceof Error ? error.name : 'Unknown error');
    throw error;
  }
  for (const field of missing) {
    if (candidates[field].size === 1) profile[field] = candidates[field].values().next().value ?? null;
  }
  return profile;
}

export async function getAccountProfile(callerEmail: string): Promise<AccountProfile> {
  const email = callerEmail.toLowerCase();
  return resolveNames(email, await readProfile(email));
}

export async function completeAccountProfile(callerEmail: string, firstName: string, lastName: string): Promise<AccountProfile> {
  const email = callerEmail.toLowerCase();
  const item = { email, first_name: firstName.trim(), last_name: lastName.trim() };
  if (!item.first_name || !item.last_name) throw serviceError('First and last names are required.', 400);

  const stored = await readProfile(email);
  const current = await resolveNames(email, stored);
  const conflict = () => serviceError('The profile is already complete. Reload it to see the saved names.', 409);
  if (current.first_name && current.last_name) {
    if (current.first_name !== item.first_name || current.last_name !== item.last_name) throw conflict();
    if (stored?.first_name?.trim() && stored.last_name?.trim()) return item;
  }

  const values: Record<string, string> = {};
  const conditions = stored ? ['attribute_exists(email)', ...fields.map(field => {
    const value = stored[field];
    if (value === undefined) return `attribute_not_exists(${field})`;
    values[`:${field}`] = value;
    return `${field} = :${field}`;
  })] : ['attribute_not_exists(email)'];

  try {
    await dynamoClient.send(new PutCommand({
      TableName: PROFILE_TABLE,
      Item: item,
      ConditionExpression: conditions.join(' AND '),
      ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      const latest = await readProfile(email);
      if (latest?.first_name?.trim() === item.first_name && latest?.last_name?.trim() === item.last_name) return item;
      throw conflict();
    }
    Logger.error('accountProfileService: account save failed', error instanceof Error ? error.name : 'Unknown error');
    throw error;
  }
  return item;
}

export async function getHostDisplayNames(emails: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails.filter(Boolean).map(email => email.toLowerCase()))];
  const names = new Map<string, string>();
  const queue = unique.values();
  await Promise.all(Array.from({ length: Math.min(5, unique.length) }, async () => {
    for (const email of queue) {
      try {
        const { first_name, last_name } = await getAccountProfile(email);
        if (first_name && last_name) names.set(email, `${first_name} ${last_name}`);
      } catch {
        // The resolver already logged the failure. Keep the existing card email.
      }
    }
  }));
  return names;
}
