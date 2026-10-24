"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const partyService_1 = require("../services/partyService");
const logger_1 = require("../utils/logger");
const partyRouter = (0, express_1.Router)();
/**
 * POST /api/parties
 * Creates a new party. Requires Auth0 JWT (admin_email from token sub).
 */
partyRouter.post('/parties', async (req, res, next) => {
    try {
        const { name, description, customizationEnabled } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: { message: 'Party name is required.' } });
            return;
        }
        logger_1.Logger.info('Req:', req.auth);
        // Extract admin_email from the Auth0 custom claim set by the Post-Login Action.
        // The bare 'email' claim is not present in access tokens — use 'registered_user_email'.
        const adminEmail = req.auth?.payload?.['registered_user_email'];
        if (!adminEmail) {
            res.status(401).json({ error: { message: 'Unauthorized: missing email claim in token.' } });
            return;
        }
        const options = {};
        if (description !== undefined)
            options.description = description;
        if (customizationEnabled !== undefined)
            options.customizationEnabled = customizationEnabled;
        const party = await (0, partyService_1.createParty)(name.trim(), adminEmail, options);
        logger_1.Logger.info(`Party created: ${party.party_id}`);
        res.status(201).json(party);
    }
    catch (err) {
        next(err);
    }
});
exports.default = partyRouter;
