import { json } from '../http/response.js';

const buckets = new Map();

export async function rateLimit(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + 60_000 };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > 120) throw json(429, { error: 'rate_limited' });
}
