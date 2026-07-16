import { json } from '../http/response.js';

export async function devicePolicy(req, env) {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /android|iphone|ipad|mobile/i.test(userAgent);

  if (isMobile && !env.allowedDeviceClasses.includes('mobile')) {
    throw json(403, { error: 'device_not_allowed' });
  }
}
