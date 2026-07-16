import { json } from '../http/response.js';
import { assignRequestId } from '../http/request-id.js';
import { writeResponse } from '../http/write-response.js';

export function exceptionHandler(handler, env = {}) {
  return async (req, res) => {
    assignRequestId(req);

    try {
      await handler(req, res);
    } catch (error) {
      if (env.nodeEnv !== 'production' && error?.stack) {
        console.error(error.stack);
      }

      const result = error?.statusCode
        ? sanitizeErrorResponse(error)
        : json(500, { error: 'internal_error' });

      writeResponse(req, res, result);
    }
  };
}

function sanitizeErrorResponse(error) {
  try {
    const body = JSON.parse(error.body);
    return json(error.statusCode, { error: body.error || 'request_failed' }, error.headers);
  } catch {
    return json(error.statusCode, { error: 'request_failed' });
  }
}
