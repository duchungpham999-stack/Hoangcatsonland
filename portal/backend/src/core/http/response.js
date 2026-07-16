export function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(payload)
  };
}

export function notFound(requestId) {
  return json(404, { error: 'not_found', requestId });
}

export function withErrorRequestId(result, requestId) {
  if (!result || result.statusCode < 400 || !requestId) return result;

  try {
    const body = JSON.parse(result.body);
    return json(result.statusCode, { ...body, requestId }, result.headers);
  } catch {
    return json(result.statusCode, { error: 'internal_error', requestId });
  }
}
