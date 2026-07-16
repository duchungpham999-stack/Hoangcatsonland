export async function apiGet(path) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
