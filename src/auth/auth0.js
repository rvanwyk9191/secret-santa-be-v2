"use strict";
// src/auth/auth0.ts
// Auth0 authentication/authorization integration scaffold
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkJwt = void 0;
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const express_1 = require("express");
// TODO: Replace with your Auth0 domain and audience
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'YOUR_AUTH0_DOMAIN';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'YOUR_AUTH0_AUDIENCE';
exports.checkJwt = (0, express_jwt_1.expressjwt)({
    secret: jwks_rsa_1.default.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
    }),
    audience: AUTH0_AUDIENCE,
    issuer: `https://${AUTH0_DOMAIN}/`,
    algorithms: ['RS256'],
});
// Usage: app.use('/api', checkJwt) to protect API routes
//# sourceMappingURL=auth0.js.map