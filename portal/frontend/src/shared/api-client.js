export async function apiGet(path) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function apiPost(path, payload, csrfToken) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken
    },
    body: JSON.stringify(payload || {})
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

export async function apiPatch(path, payload, csrfToken) {
  return apiWrite('PATCH', path, payload, csrfToken);
}

async function apiWrite(method, path, payload, csrfToken) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken
    },
    body: JSON.stringify(payload || {})
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return body;
}
