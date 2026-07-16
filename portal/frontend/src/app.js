import { renderLogin } from './features/auth/auth-page.js';
import { renderDashboard } from './features/portal-dashboard/dashboard-page.js';

export function renderApp(root) {
  if (!root) return;

  root.replaceChildren(renderLogin(), renderDashboard());
}
