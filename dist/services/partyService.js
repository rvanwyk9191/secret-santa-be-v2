"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParty = createParty;
exports.getParty = getParty;
const uuid_1 = require("uuid");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const logger_js_1 = require("../utils/logger.js");
const dynamodb_js_1 = require("../utils/dynamodb.js");
const PARTIES_TABLE = 'Parties';
/**
 * Generates an 8-character hex party_id (first segment of a UUID v4, e.g. 'e876dd4f').
 * Queries DynamoDB to ensure uniqueness; retries on collision.
 */
async function generateUniquePartyId() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const candidate = (0, uuid_1.v4)().split('-')[0];
        let result;
        try {
            result = await dynamodb_js_1.dynamoClient.send(new lib_dynamodb_1.GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: candidate } }));
        }
        catch (err) {
            logger_js_1.Logger.error(`generateUniquePartyId: DynamoDB GetCommand failed for candidate '${candidate}'`, err instanceof Error ? err.message : String(err));
            throw err;
        }
        if (!result.Item) {
            return candidate;
        }
        logger_js_1.Logger.warn(`party_id collision detected for '${candidate}', regenerating`);
    }
}
/**
 * Creates a new party in DynamoDB.
 */
async function createParty(name, adminEmail, options) {
    const now = new Date().toISOString();
    // Generate a unique 8-char hex ID, retrying on DynamoDB collision (Phase 3.1).
    const partyId = await generateUniquePartyId();
    const party = {
        party_id: partyId,
        name,
        admin_email: adminEmail,
        ...(options?.description !== undefined ? { description: options.description } : {}),
        customizationEnabled: options?.customizationEnabled ?? false,
        locked: false,
        created_at: now,
        updated_at: now,
    };
    logger_js_1.Logger.info(`Creating party: ${party.party_id} for admin: ${adminEmail}`);
    try {
        await dynamodb_js_1.dynamoClient.send(new lib_dynamodb_1.PutCommand({ TableName: PARTIES_TABLE, Item: party }));
    }
    catch (err) {
        logger_js_1.Logger.error(`createParty: DynamoDB PutCommand failed for party_id '${party.party_id}'`, err instanceof Error ? err.message : String(err));
        throw err;
    }
    return party;
}
/**
 * Fetches a party by party_id from DynamoDB.
 */
async function getParty(partyId) {
    logger_js_1.Logger.info(`Fetching party: ${partyId}`);
    let result;
    try {
        result = await dynamodb_js_1.dynamoClient.send(new lib_dynamodb_1.GetCommand({ TableName: PARTIES_TABLE, Key: { party_id: partyId } }));
    }
    catch (err) {
        logger_js_1.Logger.error(`getParty: DynamoDB GetCommand failed for party_id '${partyId}'`, err instanceof Error ? err.message : String(err));
        throw err;
    }
    return result.Item;
}
