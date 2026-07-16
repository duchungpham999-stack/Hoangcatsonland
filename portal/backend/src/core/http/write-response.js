import { withErrorRequestId } from './response.js';
import { applySecurityHeaders } from '../security/security-headers.js';

export function writeResponse(req, res, result) {
  const response = withErrorRequestId(result, req.requestId);

  applySecurityHeaders(req, res);
  res.setHeader('X-Request-ID', req.requestId);
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
}
