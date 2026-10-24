export {};
/**
 * Simple logger utility. Replace with a more robust logger (e.g., Winston) for production.
 */
export class Logger {
  static info(message: string, ...args: any[]) {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, ...args);
  }
}
