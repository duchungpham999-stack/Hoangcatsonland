import { isStrongSecret } from './security.config.js';

export function createSessionConfig(rawEnv, appConfig) {
  const sessionCookieName = rawEnv.SESSION_COOKIE_NAME || '__Host-ids_session';
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
