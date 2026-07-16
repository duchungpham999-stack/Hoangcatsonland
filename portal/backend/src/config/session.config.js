import { isStrongSecret } from './security.config.js';

export function createSessionConfig(rawEnv, appConfig) {
  const defaultCookieName = appConfig.nodeEnv === 'production' ? '__Host-ids_session' : 'ids_session_dev';
  const sessionCookieName = rawEnv.SESSION_COOKIE_NAME || defaultCookieName;
  const sessionSecret = rawEnv.SESSION_SECRET || '';

  if (appConfig.nodeEnv === 'production' && !isStrongSecret(sessionSecret)) {
    throw new Error('SESSION_SECRET is required and must be strong in production.');
  }

  return {
    sessionCookieName,
    sessionSecret,
    cookieSecure: appConfig.nodeEnv === 'production'
  };
}
