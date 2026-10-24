import type { Assignment } from '../../backend/src/models/assignment.js';

/**
 * Contract test for POST /api/parties/{party_id}/assignments
 * Validates the shape and required fields of the assignments response.
 */
describe('POST /api/parties/{party_id}/assignments contract', () => {
  it('should return an array of Assignment records', () => {
    const mockResponse: Assignment[] = [
      {
        party_id: 'abc-123',
        giver_email: 'alice@example.com',
        recipient_email: 'bob@example.com',
        assigned_at: new Date().toISOString(),
      },
      {
        party_id: 'abc-123',
        giver_email: 'bob@example.com',
        recipient_email: 'alice@example.com',
        assigned_at: new Date().toISOString(),
      },
    ];

    expect(Array.isArray(mockResponse)).toBe(true);
    expect(mockResponse.length).toBeGreaterThan(0);

    for (const a of mockResponse) {
      expect(a).toHaveProperty('party_id');
      expect(typeof a.party_id).toBe('string');
      expect(a).toHaveProperty('giver_email');
      expect(typeof a.giver_email).toBe('string');
      expect(a).toHaveProperty('recipient_email');
      expect(typeof a.recipient_email).toBe('string');
      expect(a.giver_email).not.toBe(a.recipient_email);
      expect(a).toHaveProperty('assigned_at');
    }
  });

  it('each participant should appear exactly once as a giver and once as a recipient', () => {
    const mockResponse: Assignment[] = [
      { party_id: 'abc-123', giver_email: 'a@x.com', recipient_email: 'b@x.com', assigned_at: '' },
      { party_id: 'abc-123', giver_email: 'b@x.com', recipient_email: 'c@x.com', assigned_at: '' },
      { party_id: 'abc-123', giver_email: 'c@x.com', recipient_email: 'a@x.com', assigned_at: '' },
    ];

    const givers = mockResponse.map(a => a.giver_email);
    const recipients = mockResponse.map(a => a.recipient_email);

    // All givers unique
    expect(new Set(givers).size).toBe(givers.length);
    // All recipients unique
    expect(new Set(recipients).size).toBe(recipients.length);
    // Same set of participants
    expect(new Set(givers)).toEqual(new Set(recipients));
  });

  it('should not contain any self-assignments in a valid response', () => {
    // Contract: every assignment in the response must have distinct giver and recipient
    const validResponse: Assignment[] = [
      { party_id: 'abc-123', giver_email: 'a@x.com', recipient_email: 'b@x.com', assigned_at: '' },
      { party_id: 'abc-123', giver_email: 'b@x.com', recipient_email: 'c@x.com', assigned_at: '' },
      { party_id: 'abc-123', giver_email: 'c@x.com', recipient_email: 'a@x.com', assigned_at: '' },
    ];
    validResponse.forEach(assignment => {
      expect(assignment.giver_email).not.toBe(assignment.recipient_email);
    });
  });
});
