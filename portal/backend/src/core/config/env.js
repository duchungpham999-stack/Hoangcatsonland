export function loadEnv() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4173),
    sessionCookieName: process.env.SESSION_COOKIE_NAME || '__Host-ids_session',
    allowedDeviceClasses: (process.env.ALLOWED_DEVICE_CLASSES || 'desktop').split(',')
  };
}
