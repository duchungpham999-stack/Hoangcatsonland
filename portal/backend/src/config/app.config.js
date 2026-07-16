export function createAppConfig(rawEnv) {
  const nodeEnv = rawEnv.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('Invalid NODE_ENV. Expected development, test, or production.');
  }

  const port = Number(rawEnv.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT. Expected an integer from 1 to 65535.');
  }

  const host = rawEnv.HOST || '127.0.0.1';
  const appOrigin = rawEnv.APP_ORIGIN || `http://${host}:${port}`;

  if (nodeEnv === 'production' && !appOrigin.startsWith('https://')) {
    throw new Error('APP_ORIGIN must use HTTPS in production.');
  }

  return {
    nodeEnv,
    host,
    port,
    appOrigin,
    serviceName: 'ids-hrm-gis-portal'
  };
}
