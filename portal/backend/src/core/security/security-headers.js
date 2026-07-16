export function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isSensitiveApiRequest(req)) {
    res.setHeader('Cache-Control', 'no-store');
  }
}

function isSensitiveApiRequest(req) {
  const path = new URL(req.url, 'http://localhost').pathname;
  return path.startsWith('/api/');
}
