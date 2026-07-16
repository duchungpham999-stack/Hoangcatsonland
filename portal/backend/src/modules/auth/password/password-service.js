import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const keyLength = 64;
const defaultParams = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1
};

export async function hashPassword(password, params = defaultParams) {
  assertPassword(password);
  const salt = randomBytes(16).toString('base64url');
  const hash = await scryptAsync(password, salt, keyLength, {
    N: params.cost,
    r: params.blockSize,
    p: params.parallelization
  });

  return [
    'scrypt',
    `n=${params.cost},r=${params.blockSize},p=${params.parallelization}`,
    salt,
    Buffer.from(hash).toString('base64url')
  ].join('$');
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;

  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return false;

  const candidate = await scryptAsync(password, parsed.salt, keyLength, {
    N: parsed.cost,
    r: parsed.blockSize,
    p: parsed.parallelization
  });
  const stored = Buffer.from(parsed.hash, 'base64url');

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function parsePasswordHash(passwordHash) {
  const [algorithm, params, salt, hash] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !params || !salt || !hash) return null;

  const values = Object.fromEntries(params.split(',').map(pair => pair.split('=')));
  return {
    cost: Number(values.n),
    blockSize: Number(values.r),
    parallelization: Number(values.p),
    salt,
    hash
  };
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must contain at least 12 characters.');
  }
}
