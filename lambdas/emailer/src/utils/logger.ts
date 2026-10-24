/**
 * Lightweight logger for CloudWatch Logs.
 * Each log entry is a single JSON line so CloudWatch Logs Insights can parse it.
 */
export const Logger = {
  info(context: string, message?: string): void {
    console.info(JSON.stringify({ level: 'INFO', context, message: message ?? '' }));
  },
  error(context: string, message?: string): void {
    console.error(JSON.stringify({ level: 'ERROR', context, message: message ?? '' }));
  },
  warn(context: string, message?: string): void {
    console.warn(JSON.stringify({ level: 'WARN', context, message: message ?? '' }));
  },
  debug(context: string, data?: unknown): void {
    if (process.env['LOG_LEVEL'] !== 'DEBUG') return;
    console.debug(JSON.stringify({ level: 'DEBUG', context, data }));
  },
};
