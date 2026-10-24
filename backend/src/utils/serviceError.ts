/** An Error with an attached HTTP status code, thrown by service functions. */
export interface ServiceError extends Error {
  statusCode: number;
}

/**
 * Creates a structured service error that carries an HTTP status code.
 * Route handlers and the global error handler use `statusCode` to return
 * the appropriate HTTP response instead of a generic 500.
 */
export function serviceError(message: string, statusCode: number): ServiceError {
  return Object.assign(new Error(message), { statusCode }) as ServiceError;
}
