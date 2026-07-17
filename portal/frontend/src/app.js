import { renderLogin } from './features/auth/auth-page.js';
import { renderDashboard } from './features/portal-dashboard/dashboard-page.js';
import { apiGet } from './shared/api-client.js';

export async function renderApp(root) {
  if (!root) return;
  await showDashboardOrLogin(root);
}

async function showDashboardOrLogin(root) {
  try {
    const { user } = await apiGet('/api/auth/me');
    root.replaceChildren(renderDashboard(user, () => showLogin(root)));
  } catch (error) {
    if (error.message.includes('401')) {
      showLogin(root);
      return;
    }
    root.replaceChildren(renderAccessDenied());
  }
}

function showLogin(root) {
  root.replaceChildren(renderLogin(() => showDashboardOrLogin(root)));
}

function renderAccessDenied() {
  const section = document.createElement('section');
  section.className = 'access-denied';
  section.innerHTML = '<h1>Access denied</h1><p>Your account does not have access to this portal.</p>';
  return section;
}
