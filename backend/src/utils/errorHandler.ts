import type { Request, Response, NextFunction } from 'express';

/**
 * Express error handling middleware.
 * Logs the error and sends a generic response.
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log error details (could be enhanced to use a logger)
  // eslint-disable-next-line no-console
  console.error('Error:', err);

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}
