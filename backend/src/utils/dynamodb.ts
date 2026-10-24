// src/utils/dynamodb.ts
// Shared DynamoDB client — singleton, reused across all service calls.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const raw = new DynamoDBClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

export const dynamoClient = DynamoDBDocumentClient.from(raw);
