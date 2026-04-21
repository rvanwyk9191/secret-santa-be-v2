import { Router } from 'express';
import { createParty } from '../services/partyService.js';
import { Logger } from '../utils/logger.js';
const partyRouter = Router();
/**
 * POST /api/parties
 * Creates a new party. Requires Auth0 JWT (admin_email from token sub).
 */
partyRouter.post('/', async (req, res, next) => {
    try {
        const { name, description, customizationEnabled } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: { message: 'Party name is required.' } });
            return;
        }
        // TODO: extract admin_email from Auth0 JWT token (req.auth.payload.email)
        const adminEmail = req.auth?.payload?.email;
        if (!adminEmail) {
            res.status(401).json({ error: { message: 'Unauthorized: missing email claim in token.' } });
            return;
        }
        const options = {};
        if (description !== undefined)
            options.description = description;
        if (customizationEnabled !== undefined)
            options.customizationEnabled = customizationEnabled;
        const party = await createParty(name.trim(), adminEmail, options);
        Logger.info(`Party created: ${party.party_id}`);
        res.status(201).json(party);
    }
    catch (err) {
        next(err);
    }
});
export default partyRouter;
//# sourceMappingURL=partyController.js.map