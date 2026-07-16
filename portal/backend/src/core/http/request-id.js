const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

export function assignRequestId(req) {
  const incomingRequestId = req.headers['x-request-id'];
  req.requestId = isValidRequestId(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  return req.requestId;
}

export function isValidRequestId(value) {
  return typeof value === 'string' && requestIdPattern.test(value);
}
