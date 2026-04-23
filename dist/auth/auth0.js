"use strict";
// src/auth/auth0.ts
// Auth0 JWT middleware - configuration sourced from AWS SSM Parameter Store
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckJwt = createCheckJwt;
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const config_js_1 = require("../utils/config.js");
const logger_js_1 = require("../utils/logger.js");
const SSM_AUTH0_PREFIX = '/secret-santa/auth0';
/**
 * Creates the Auth0 JWT validation middleware by retrieving all required
 * configuration values from AWS SSM Parameter Store.
 *
 * SSM paths used:
 *   /secret-santa/auth0/domain       — Auth0 tenant domain
 *   /secret-santa/auth0/audience     — API audience identifier
 *   /secret-santa/auth0/client_id    — OAuth client ID
 *   /secret-santa/auth0/client_secret — OAuth client secret (SecureString)
 *
 * Must be called during application startup before routes are registered.
 * Environment variables MUST NOT be used as the credential source.
 */
async function createCheckJwt() {
    logger_js_1.Logger.info('auth0: loading configuration from SSM Parameter Store');
    let domain;
    let audience;
    let clientId;
    let clientSecret;
    try {
        [domain, audience, clientId, clientSecret] = await Promise.all([
            (0, config_js_1.getConfigParam)(`${SSM_AUTH0_PREFIX}/domain`),
            (0, config_js_1.getConfigParam)(`${SSM_AUTH0_PREFIX}/audience`),
            (0, config_js_1.getConfigParam)(`${SSM_AUTH0_PREFIX}/client_id`),
            (0, config_js_1.getConfigParam)(`${SSM_AUTH0_PREFIX}/client_secret`, { decrypt: true }),
        ]);
    }
    catch (err) {
        logger_js_1.Logger.error('auth0: failed to load SSM configuration', err instanceof Error ? err.message : String(err));
        throw err;
    }
    if (!domain) {
        throw new Error('Auth0 domain not found in SSM: /secret-santa/auth0/domain');
    }
    if (!audience) {
        throw new Error('Auth0 audience not found in SSM: /secret-santa/auth0/audience');
    }
    if (!clientId) {
        throw new Error('Auth0 client_id not found in SSM: /secret-santa/auth0/client_id');
    }
    if (!clientSecret) {
        throw new Error('Auth0 client_secret not found in SSM: /secret-santa/auth0/client_secret');
    }
    logger_js_1.Logger.info('auth0: SSM configuration loaded, creating JWT middleware');
    return (0, express_jwt_1.expressjwt)({
        secret: jwks_rsa_1.default.expressJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri: `https://${domain}/.well-known/jwks.json`,
        }),
        audience,
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
    });
}
