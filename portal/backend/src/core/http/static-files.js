import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('../../../../frontend/', import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

export async function getFrontendAsset(req) {
  if (req.method !== 'GET') return null;

  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/favicon.ico') {
    return { statusCode: 204, headers: {}, body: '' };
  }

  if (isBlockedPath(pathname)) {
    return text(403, 'Forbidden');
  }

  if (pathname === '/' || !pathname.startsWith('/src/')) {
    return readFrontendFile('index.html');
  }

  return readFrontendFile(pathname.slice(1));
}

async function readFrontendFile(sitePath) {
  const absolutePath = normalize(join(frontendRoot, sitePath));
  if (!isInsideFrontend(absolutePath)) return text(403, 'Forbidden');

  try {
    const body = await readFile(absolutePath);
    return {
      statusCode: 200,
      headers: { 'content-type': getMimeType(absolutePath) },
      body
    };
  } catch {
    return text(404, 'Not found');
  }
}

function isBlockedPath(pathname) {
  return pathname.includes('..') ||
    pathname.startsWith('/backend') ||
    pathname.includes('/.env') ||
    pathname.endsWith('.env');
}

function isInsideFrontend(absolutePath) {
  const pathFromRoot = relative(frontendRoot, absolutePath);
  return pathFromRoot && !pathFromRoot.startsWith('..') && !pathFromRoot.startsWith(sep);
}

function getMimeType(pathname) {
  return mimeTypes[extname(pathname).toLowerCase()] || 'application/octet-stream';
}

function text(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body
  };
}
