export async function verifyDeviceAccess(user, req) {
  const userAgent = req.headers['user-agent'] || '';
  if (/android|iphone|ipad|mobile/i.test(userAgent)) {
    throw { statusCode: 403, headers: { 'content-type': 'application/json' }, body: '{"error":"device_not_allowed"}' };
  }
  return { userId: user?.id || null, allowed: true };
}
