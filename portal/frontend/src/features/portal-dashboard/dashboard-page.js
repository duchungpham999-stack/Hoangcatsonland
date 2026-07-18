import { renderIdsPanel } from '../ids/ids-page.js';
import { renderHrmPanel } from '../hrm/hrm-page.js';
import { renderGisPanel } from '../gis/gis-page.js';
import { renderAdminPanel } from '../admin/admin-page.js';
import { apiPost } from '../../shared/api-client.js';
import { fetchCsrfToken, getCsrfToken } from '../../shared/csrf-client.js';
import { getVisibleModuleKeys } from './module-access.js';

export function renderDashboard(user, onLogout) {
  const section = document.createElement('section');
  section.dataset.feature = 'portal-dashboard';
  section.className = 'dashboard-page';

  const header = document.createElement('header');
  header.className = 'dashboard-header';
  header.innerHTML = `
    <div>
      <p class="eyebrow">Signed in</p>
      <h1>${escapeHtml(user.email)}</h1>
      <p>${escapeHtml(user.username || '')}</p>
    </div>
    <button type="button">Logout</button>
  `;
  header.querySelector('button').addEventListener('click', async () => {
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    await apiPost('/api/auth/logout', {}, csrfToken);
    await onLogout();
  });

  const access = document.createElement('section');
  access.className = 'access-summary';
  access.innerHTML = `
    <div><strong>Roles</strong><span>${escapeHtml((user.roles || []).join(', ') || 'None')}</span></div>
    <div><strong>Permissions</strong><span>${escapeHtml((user.permissions || []).join(', ') || 'None')}</span></div>
  `;

  const admin = document.createElement('section');
  admin.className = 'dashboard-admin';
  const canAdminUsers = (user.permissions || []).includes('users.manage');
  const canAdminRoles = (user.permissions || []).includes('roles.manage');
  const canAdminDepartments = (user.permissions || []).includes('departments.manage');
  if (canAdminUsers || canAdminRoles || canAdminDepartments) admin.append(renderAdminPanel(user));

  const modules = document.createElement('section');
  modules.className = 'module-grid';
  const renderers = {
    ids: renderIdsPanel,
    hrm: renderHrmPanel,
    gis: renderGisPanel
  };
  const cards = getVisibleModuleKeys(user.permissions || []).map(key => renderers[key]());

  modules.replaceChildren(...cards);
  section.replaceChildren(header, access, modules, admin);
  return section;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
