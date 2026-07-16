export async function verifyDeviceAccess(user, req) {
  const userAgent = req.headers['user-agent'] || '';
  if (/android|iphone|ipad|mobile/i.test(userAgent)) {
    throw { statusCode: 403, headers: { 'content-type': 'application/json' }, body: '{"error":"mobile_device_blocked"}' };
  }
  return { userId: user.id, allowed: true };
}
