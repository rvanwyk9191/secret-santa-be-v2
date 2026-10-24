"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Simple logger utility. Replace with a more robust logger (e.g., Winston) for production.
 */
class Logger {
    static info(message, ...args) {
        // eslint-disable-next-line no-console
        console.info(`[INFO] ${message}`, ...args);
    }
    static warn(message, ...args) {
        // eslint-disable-next-line no-console
        console.warn(`[WARN] ${message}`, ...args);
    }
    static error(message, ...args) {
        // eslint-disable-next-line no-console
        console.error(`[ERROR] ${message}`, ...args);
    }
}
exports.Logger = Logger;
