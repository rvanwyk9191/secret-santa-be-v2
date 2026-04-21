import { createParty } from '../../src/services/partyService.js';
/**
 * Integration test for party creation.
 */
describe('Party creation integration', () => {
    it('should create a party and return valid party_id and admin_email', async () => {
        const party = await createParty('Holiday Party', 'admin@example.com', {
            description: 'Annual gift exchange',
            customizationEnabled: true,
        });
        expect(party.party_id).toBeDefined();
        expect(typeof party.party_id).toBe('string');
        expect(party.party_id.length).toBeGreaterThan(0);
        expect(party.admin_email).toBe('admin@example.com');
        expect(party.name).toBe('Holiday Party');
        expect(party.locked).toBe(false);
        expect(party.customizationEnabled).toBe(true);
        expect(party.created_at).toBeDefined();
        expect(party.updated_at).toBeDefined();
    });
});
//# sourceMappingURL=test_party_creation.js.map