import type { Party } from '../models/party.js';
/**
 * Creates a new party in DynamoDB.
 */
export declare function createParty(name: string, adminEmail: string, options?: {
    description?: string;
    customizationEnabled?: boolean;
}): Promise<Party>;
/**
 * Fetches a party by party_id from DynamoDB.
 */
export declare function getParty(partyId: string): Promise<Party | undefined>;
//# sourceMappingURL=partyService.d.ts.map