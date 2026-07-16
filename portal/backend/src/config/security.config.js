const blockedPlaceholders = ['changeme', 'password', 'secret', 'example'];

export function createSecurityConfig(rawEnv) {
  const allowedDeviceClasses = (rawEnv.ALLOWED_DEVICE_CLASSES || 'desktop')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return { allowedDeviceClasses };
}

export function isStrongSecret(value) {
  if (typeof value !== 'string' || value.length < 32) return false;
  const normalized = value.toLowerCase();
  return !blockedPlaceholders.some(item => normalized.includes(item));
}
