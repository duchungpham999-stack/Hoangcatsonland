import { apiGet, apiPatch, apiPost } from '../../shared/api-client.js';
import { fetchCsrfToken, getCsrfToken } from '../../shared/csrf-client.js';

export function renderAdminPanel(user) {
  const section = document.createElement('section');
  section.className = 'admin-panel';
  const canManageUsers = user.permissions?.includes('users.manage');
  const canManageRoles = user.permissions?.includes('roles.manage');
  const canManageDepartments = user.permissions?.includes('departments.manage');
  section.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Administration</p>
        <h2>Users, roles and sessions</h2>
      </div>
      <button type="button" data-action="refresh-admin">Refresh</button>
    </div>
    <nav class="admin-tabs" aria-label="Administration">
      ${canManageUsers ? '<button type="button" data-tab="users">User Management</button>' : ''}
      ${canManageRoles ? '<button type="button" data-tab="roles">Role Management</button>' : ''}
      ${canManageDepartments ? '<button type="button" data-tab="departments">Department Management</button>' : ''}
    </nav>
    <div class="admin-status" aria-live="polite"></div>
    <div class="admin-content"></div>
  `;

  const state = { roles: [], permissions: [], users: [], departments: [] };
  const content = section.querySelector('.admin-content');
  const status = section.querySelector('.admin-status');
  const refresh = async () => {
    status.textContent = 'Loading administration data...';
    try {
      if (canManageRoles) {
        const roleData = await apiGet('/api/admin/roles');
        state.roles = roleData.roles || [];
      }
      if (canManageRoles) {
        const permissionData = await apiGet('/api/admin/permissions');
        state.permissions = permissionData.permissions || [];
      }
      if (canManageUsers) {
        const userData = await apiGet('/api/admin/users');
        state.users = userData.users || [];
      }
      if (canManageDepartments) {
        const departmentData = await apiGet('/api/admin/departments');
        state.departments = departmentData.departments || [];
      }
      status.textContent = '';
      renderCurrent();
    } catch {
      status.textContent = 'Unable to load administration data.';
    }
  };

  let currentTab = canManageUsers ? 'users' : (canManageRoles ? 'roles' : 'departments');
  section.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      currentTab = button.dataset.tab;
      renderCurrent();
    });
  });
  section.querySelector('[data-action="refresh-admin"]').addEventListener('click', refresh);

  function renderCurrent() {
    if (currentTab === 'roles') {
      content.replaceChildren(renderRoles(state, refresh));
    } else if (currentTab === 'departments') {
      content.replaceChildren(renderDepartments(state, refresh));
    } else {
      content.replaceChildren(renderUsers(state, refresh));
    }
  }

  refresh();
  return section;
}

function renderUsers(state, refresh) {
  const container = document.createElement('div');
  container.className = 'admin-stack';
  container.innerHTML = `
    <form class="admin-filters">
      <label>Search <input name="search" type="search" placeholder="email, username, display name"></label>
      <label>Status
        <select name="status">
          <option value="">All</option>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
          <option value="locked">locked</option>
          <option value="pending">pending</option>
        </select>
      </label>
      <label>Role <input name="role" type="search" placeholder="system_admin"></label>
      <button type="submit">Filter</button>
    </form>
    <form class="admin-form" data-form="create-user">
      <h3>Create User</h3>
      <label>Email <input name="email" type="email" required></label>
      <label>Username <input name="username" required></label>
      <label>Display name <input name="displayName" required></label>
      <label>Account Type
        <select name="accountType" data-account-type>
          <option value="employee">Employee</option>
          <option value="technical">Technical account</option>
        </select>
      </label>
      <label data-employee-field>Employee Code <input name="employeeCodePreview" value="Tự động tạo khi lưu" readonly></label>
      <label data-employee-field>Department
        <select name="departmentId">
          <option value="">Select department</option>
          ${renderDepartmentOptions(state.departments, '')}
        </select>
      </label>
      <label data-employee-field>Employment Status
        <select name="employmentStatus">
          <option value="active">active</option>
          <option value="probation">probation</option>
          <option value="suspended">suspended</option>
          <option value="terminated">terminated</option>
          <option value="retired">retired</option>
        </select>
      </label>
      <label data-employee-field>Start Date <input name="employmentStartedAt" type="date"></label>
      <label data-employee-field>End Date <input name="employmentEndedAt" type="date"></label>
      <label>Temporary password <input name="password" type="password" minlength="12" required></label>
      <fieldset><legend>Roles</legend>${renderRoleCheckboxes(state.roles, [])}</fieldset>
      <button type="submit">Create user</button>
    </form>
    <div class="table-wrap"></div>
  `;

  const accountTypeSelect = container.querySelector('[data-account-type]');
  const applyAccountType = () => {
    const isEmployee = accountTypeSelect.value === 'employee';
    container.querySelectorAll('[data-employee-field]').forEach(item => {
      item.hidden = !isEmployee;
    });
  };
  const startInput = container.querySelector('input[name="employmentStartedAt"]');
  if (startInput) startInput.value = toDateInputValue(new Date());
  accountTypeSelect.addEventListener('change', applyAccountType);
  applyAccountType();

  container.querySelector('.admin-filters').addEventListener('submit', async event => {
    event.preventDefault();
    const query = new URLSearchParams(new FormData(event.currentTarget));
    for (const [key, value] of [...query.entries()]) if (!value) query.delete(key);
    const data = await apiGet(`/api/admin/users?${query.toString()}`);
    state.users = data.users || [];
    container.querySelector('.table-wrap').replaceChildren(renderUsersTable(state, refresh));
  });

  container.querySelector('[data-form="create-user"]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    const formData = new FormData(form);
    const accountType = formData.get('accountType');
    const created = await apiPost('/api/admin/users', {
      accountType: formData.get('accountType'),
      email: formData.get('email'),
      username: formData.get('username'),
      displayName: formData.get('displayName'),
      password: formData.get('password'),
      departmentId: accountType === 'employee' ? formData.get('departmentId') || undefined : undefined,
      employmentStatus: accountType === 'employee' ? formData.get('employmentStatus') || 'active' : undefined,
      employmentStartedAt: accountType === 'employee' ? formData.get('employmentStartedAt') || undefined : undefined,
      employmentEndedAt: accountType === 'employee' ? formData.get('employmentEndedAt') || undefined : undefined,
      roles: formData.getAll('roles')
    }, csrfToken);
    alert(created.user?.employeeCode ? `Official employee code: ${created.user.employeeCode}` : 'Technical account created.');
    form.reset();
    if (startInput) startInput.value = toDateInputValue(new Date());
    applyAccountType();
    await refresh();
  });

  container.querySelector('.table-wrap').replaceChildren(renderUsersTable(state, refresh));
  return container;
}

function renderUsersTable(state, refresh) {
  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead><tr><th>Employee Code</th><th>Email</th><th>Display name</th><th>Department</th><th>Employment</th><th>Roles</th><th>Login</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
    <tbody>
      ${(state.users || []).map(user => `
        <tr>
          <td>${escapeHtml(user.employeeCode || '')}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.displayName || user.username || '')}</td>
          <td>${escapeHtml(user.departmentCode || '')} ${escapeHtml(user.departmentName || '')}</td>
          <td><span class="status-badge">${escapeHtml(user.employmentStatus || '')}</span></td>
          <td>${escapeHtml((user.roles || []).join(', '))}</td>
          <td><span class="status-badge">${escapeHtml(user.status)}</span></td>
          <td>${formatDate(user.employmentStartedAt)}</td>
          <td>${formatDate(user.employmentEndedAt)}</td>
          <td>
            <button type="button" data-action="edit" data-id="${escapeHtml(user.id)}" data-email="${escapeHtml(user.email)}" data-username="${escapeHtml(user.username)}" data-display-name="${escapeHtml(user.displayName || '')}">Edit</button>
            <button type="button" data-action="roles" data-id="${escapeHtml(user.id)}">Roles</button>
            <button type="button" data-action="transfer" data-id="${escapeHtml(user.id)}">Transfer</button>
            <button type="button" data-action="history" data-id="${escapeHtml(user.id)}">History</button>
            <button type="button" data-action="reset" data-id="${escapeHtml(user.id)}">Reset</button>
            <button type="button" data-action="revoke" data-id="${escapeHtml(user.id)}">Revoke</button>
            <button type="button" data-action="status" data-id="${escapeHtml(user.id)}">Status</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;

  table.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    if (button.dataset.action === 'edit') {
      const email = prompt('Email', button.dataset.email);
      if (email === null) return;
      const username = prompt('Username', button.dataset.username);
      if (username === null) return;
      const displayName = prompt('Display name', button.dataset.displayName);
      if (displayName === null || !confirm('Confirm user profile update?')) return;
      await apiPatch(`/api/admin/users/${button.dataset.id}`, { email, username, displayName }, csrfToken);
    }
    if (button.dataset.action === 'roles') {
      const next = prompt('Role codes, comma separated');
      if (next === null || !confirm('Confirm role assignment change?')) return;
      await apiPatch(`/api/admin/users/${button.dataset.id}/roles`, { roles: next.split(',').map(value => value.trim()).filter(Boolean) }, csrfToken);
    }
    if (button.dataset.action === 'transfer') {
      const departmentId = prompt(`New department id. Employee code will not change after transfer.\n${state.departments.map(item => `${item.code}: ${item.id}`).join('\n')}`);
      if (!departmentId) return;
      const effectiveFrom = prompt('Effective from (YYYY-MM-DD)');
      if (!effectiveFrom) return;
      const reason = prompt('Reason') || '';
      const decisionNumber = prompt('Decision number') || '';
      const notes = prompt('Notes') || '';
      if (!confirm('Confirm department transfer? Employee code will not change.')) return;
      await apiPost(`/api/admin/users/${button.dataset.id}/transfer-department`, {
        toDepartmentId: departmentId,
        effectiveFrom,
        reason,
        decisionNumber,
        notes
      }, csrfToken);
    }
    if (button.dataset.action === 'history') {
      const data = await apiGet(`/api/admin/users/${button.dataset.id}/department-history`);
      alert((data.history || []).map(item => `${item.fromDepartmentCode || '-'} -> ${item.toDepartmentCode} | ${formatDate(item.effectiveFrom)} - ${formatDate(item.effectiveTo) || 'current'} | ${item.decisionNumber || ''}`).join('\n') || 'No department history');
    }
    if (button.dataset.action === 'reset') {
      const password = prompt('Temporary password, minimum 12 characters');
      if (!password || !confirm('Confirm password reset?')) return;
      await apiPost(`/api/admin/users/${button.dataset.id}/reset-password`, { password }, csrfToken);
    }
    if (button.dataset.action === 'revoke' && confirm('Revoke all sessions for this user?')) {
      await apiPost(`/api/admin/users/${button.dataset.id}/revoke-sessions`, {}, csrfToken);
    }
    if (button.dataset.action === 'status') {
      const status = prompt('Status: active, disabled, locked, pending');
      if (!status || !confirm(`Confirm status change to ${status}?`)) return;
      await apiPatch(`/api/admin/users/${button.dataset.id}/status`, { status }, csrfToken);
    }
    await refresh();
  });
  return table;
}

function renderRoles(state, refresh) {
  const container = document.createElement('div');
  container.className = 'admin-stack';
  container.innerHTML = `
    <form class="admin-form" data-form="create-role">
      <h3>Role Management</h3>
      <label>Code <input name="code" pattern="[a-z][a-z0-9._]{1,62}" required></label>
      <label>Name <input name="name" required></label>
      <label>Description <input name="description"></label>
      <button type="submit">Create role</button>
    </form>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Users</th><th>Permissions</th><th>Actions</th></tr></thead>
        <tbody>
          ${(state.roles || []).map(role => `
            <tr>
              <td>${escapeHtml(role.code)}</td>
              <td>${escapeHtml(role.name)}</td>
              <td>${escapeHtml(role.description || '')}</td>
              <td>${role.userCount || 0}</td>
              <td>${escapeHtml((role.permissions || []).join(', '))}</td>
              <td><button type="button" data-action="permissions" data-id="${escapeHtml(role.id)}" data-code="${escapeHtml(role.code)}">Permissions</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('[data-form="create-role"]').addEventListener('submit', async event => {
    event.preventDefault();
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    const formData = new FormData(event.currentTarget);
    await apiPost('/api/admin/roles', {
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description')
    }, csrfToken);
    event.currentTarget.reset();
    await refresh();
  });

  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-action="permissions"]');
    if (!button) return;
    const next = prompt('Permission codes, comma separated');
    if (next === null || !confirm(`Confirm permission change for ${button.dataset.code}?`)) return;
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    await apiPatch(`/api/admin/roles/${button.dataset.id}/permissions`, {
      permissions: next.split(',').map(value => value.trim()).filter(Boolean)
    }, csrfToken);
    await refresh();
  });

  return container;
}

function renderDepartments(state, refresh) {
  const container = document.createElement('div');
  container.className = 'admin-stack';
  container.innerHTML = `
    <form class="admin-form" data-form="create-department">
      <h3>Department Management</h3>
      <label>Code <input name="code" pattern="[A-Z0-9_]{2,10}" required></label>
      <label>Name <input name="name" required></label>
      <label>Description <input name="description"></label>
      <label>Status
        <select name="status">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </label>
      <button type="submit">Create department</button>
    </form>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Active Employees</th><th>Description</th><th>Actions</th></tr></thead>
        <tbody>
          ${(state.departments || []).map(department => `
            <tr>
              <td>${escapeHtml(department.code)}</td>
              <td>${escapeHtml(department.name)}</td>
              <td><span class="status-badge">${escapeHtml(department.status)}</span></td>
              <td>${department.activeEmployeeCount || 0}</td>
              <td>${escapeHtml(department.description || '')}</td>
              <td><button type="button" data-action="edit-department" data-id="${escapeHtml(department.id)}" data-name="${escapeHtml(department.name)}" data-description="${escapeHtml(department.description || '')}" data-status="${escapeHtml(department.status)}">Edit</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('[data-form="create-department"]').addEventListener('submit', async event => {
    event.preventDefault();
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    const formData = new FormData(event.currentTarget);
    await apiPost('/api/admin/departments', {
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description'),
      status: formData.get('status')
    }, csrfToken);
    event.currentTarget.reset();
    await refresh();
  });

  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-action="edit-department"]');
    if (!button) return;
    const name = prompt('Department name', button.dataset.name);
    if (name === null) return;
    const description = prompt('Description', button.dataset.description);
    if (description === null) return;
    const status = prompt('Status: active or inactive', button.dataset.status);
    if (!status || !confirm('Confirm department update?')) return;
    const csrfToken = getCsrfToken() || await fetchCsrfToken();
    await apiPatch(`/api/admin/departments/${button.dataset.id}`, { name, description, status }, csrfToken);
    await refresh();
  });

  return container;
}

function renderDepartmentOptions(departments, selected) {
  return (departments || [])
    .filter(department => department.status === 'active')
    .map(department => `<option value="${escapeHtml(department.id)}" ${department.id === selected ? 'selected' : ''}>${escapeHtml(department.code)} - ${escapeHtml(department.name)}</option>`)
    .join('');
}

function renderRoleCheckboxes(roles, selected) {
  return roles.map(role => `
    <label class="check-row">
      <input type="checkbox" name="roles" value="${escapeHtml(role.code)}" ${selected.includes(role.code) ? 'checked' : ''}>
      ${escapeHtml(role.code)}
    </label>
  `).join('');
}

function formatDate(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : escapeHtml(text);
}

function toDateInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
