import { json } from '../http/response.js';

export async function devicePolicy(req, env) {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /android|iphone|ipad|mobile/i.test(userAgent);
  const allowedDeviceClasses = env.security?.allowedDeviceClasses || [];

  if (isMobile && !allowedDeviceClasses.includes('mobile')) {
    throw json(403, { error: 'device_not_allowed' });
  }
}
