export function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

export async function fetchCsrfToken() {
  const response = await fetch('/api/auth/csrf', {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  if (!response.ok) throw new Error('Unable to load CSRF token');
  const body = await response.json();
  setCsrfToken(body.csrfToken);
  return body.csrfToken;
}

export function setCsrfToken(token) {
  let meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'csrf-token';
    document.head.append(meta);
  }
  meta.content = token;
}
