export function serializeSecureCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict'
  ];

  if (options.secure !== false) parts.push('Secure');
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);

  return parts.join('; ');
}

export function serializeExpiredCookie(name, options = {}) {
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0'
  ];

  if (options.secure !== false) parts.push('Secure');
  return parts.join('; ');
}
