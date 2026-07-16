export function renderLogin() {
  const section = document.createElement('section');
  section.dataset.feature = 'auth';
  section.innerHTML = '<h1>IDS-HRM-GIS Portal</h1><p>Server-side session login surface.</p>';
  return section;
}
