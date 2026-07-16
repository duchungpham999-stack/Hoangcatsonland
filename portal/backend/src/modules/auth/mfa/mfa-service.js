export async function verifyMfaChallenge(user, credentials) {
  if (!user.mfaEnabled) return true;
  if (!credentials.mfaCode) throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"mfa_required"}' };
  return true;
}
