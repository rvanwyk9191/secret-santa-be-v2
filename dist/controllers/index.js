"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const partyController_1 = __importDefault(require("./partyController"));
const invitationController_1 = __importDefault(require("./invitationController"));
const logger_1 = require("../utils/logger");
const authRouter_1 = require("../auth/authRouter");
const auth0_1 = require("../auth/auth0");
const app = (0, express_1.default)();
const port = 3000;
function logRoutes(stack, basePath) {
    for (const layer of stack) {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods)
                .map(m => m.toUpperCase())
                .join(',');
            logger_1.Logger.info(`[ROUTE] ${methods} ${basePath}${layer.path}`);
        }
        else if (layer.handle?.stack) {
            logRoutes(layer.handle.stack, basePath);
        }
    }
}
async function main() {
    const authMiddleware = await (0, authRouter_1.createAuthMiddleware)();
    const checkJwt = await (0, auth0_1.createCheckJwt)();
    // OIDC session middleware at app level — handles /api/auth/login, /api/auth/callback, /api/auth/logout
    app.use(authMiddleware);
    app.use(express_1.default.json());
    const router = (0, express_1.Router)();
    // Public routes — no JWT required
    router.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });
    // Auth utility route — no JWT required (/api/auth/token returns tokens after login)
    router.use(authRouter_1.authRouter);
    // JWT validation — all routes registered below this point require a valid Bearer token
    router.use(checkJwt);
    router.use(partyController_1.default);
    router.use(invitationController_1.default);
    app.use('/api', router);
    // Global error handler — catches any error passed to next(err) from route handlers or middleware.
    // Returns a structured HTTP 500 so unhandled service errors never crash the process.
    app.use((err, _req, res, _next) => {
        logger_1.Logger.error('Unhandled error', err instanceof Error ? err.message : String(err));
        res.status(500).json({ error: { message: 'Internal server error' } });
    });
    const baseURL = process.env['BASE_URL'] ?? 'https://127.0.0.1:3000';
    const useHttps = new URL(baseURL).protocol === 'https:';
    if (useHttps) {
        const keyPath = process.env['SSL_KEY_PATH'];
        const certPath = process.env['SSL_CERT_PATH'];
        if (!keyPath || !certPath) {
            throw new Error('SSL_KEY_PATH and SSL_CERT_PATH env vars are required when BASE_URL uses https://');
        }
        const key = fs_1.default.readFileSync(keyPath);
        const cert = fs_1.default.readFileSync(certPath);
        https_1.default.createServer({ key, cert }, app).listen(port, () => {
            logger_1.Logger.info(`Server is running on https://127.0.0.1:${port}`);
            logRoutes(router.stack, '/api');
        });
    }
    else {
        app.listen(port, () => {
            logger_1.Logger.info(`Server is running on http://127.0.0.1:${port}`);
            logRoutes(router.stack, '/api');
        });
    }
}
main().catch((err) => {
    logger_1.Logger.error('Failed to start server', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
