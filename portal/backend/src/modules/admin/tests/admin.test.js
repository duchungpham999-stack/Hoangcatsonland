import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { hashPassword } from '../../auth/password/password-service.js';

test('system admin can list users and responses hide password hashes', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie: auth.cookie } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.users.length, 1);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);
    assert.equal(JSON.stringify(body).includes('session_token_hash'), false);
  });
});

test('user without users.manage receives 403 from user administration', async () => {
  const fixture = await createAdminFixture({ permissions: ['ids.access'] });
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie: auth.cookie } });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, 'forbidden');
  });
});

test('admin creates user, duplicate email and username are rejected', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const payload = {
      email: 'employee@example.test',
      username: 'employee',
      displayName: 'Employee',
      password: 'temporary password',
      roles: ['employee']
    };
    const created = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify(payload)
    });
    const createdBody = await created.json();

    assert.equal(created.status, 201);
    assert.equal(createdBody.user.email, payload.email);
    assert.equal(createdBody.user.mustChangePassword, true);

    const duplicateEmail = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...payload, username: 'other' })
    });
    const duplicateUsername = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...payload, email: 'other@example.test' })
    });

    assert.equal(duplicateEmail.status, 409);
    assert.equal(duplicateUsername.status, 409);
  });
});

test('disabling a user revokes sessions but admin cannot disable self or last active system admin', async () => {
  const fixture = await createAdminFixture();
  fixture.addUser({ id: 'user_2', email: 'employee@example.test', username: 'employee', roles: ['employee'] });
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);

    const disabled = await fetch(`${baseUrl}/api/admin/users/user_2/status`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ status: 'disabled' })
    });
    const selfDisable = await fetch(`${baseUrl}/api/admin/users/admin_1/status`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ status: 'disabled' })
    });

    assert.equal(disabled.status, 200);
    assert.equal(fixture.revokedUserIds.includes('user_2'), true);
    assert.equal(selfDisable.status, 400);
  });
});

test('role changes protect last system admin and system_admin permissions', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const removeSystemAdmin = await fetch(`${baseUrl}/api/admin/users/admin_1/roles`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ roles: [] })
    });
    const protectedPermissions = await fetch(`${baseUrl}/api/admin/roles/role_system_admin/permissions`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ permissions: ['ids.access'] })
    });

    assert.equal(removeSystemAdmin.status, 400);
    assert.equal(protectedPermissions.status, 400);
  });
});

test('reset password marks must change password and creates audit log', async () => {
  const fixture = await createAdminFixture();
  fixture.addUser({ id: 'user_2', email: 'employee@example.test', username: 'employee', roles: ['employee'] });
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/users/user_2/reset-password`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ password: 'new temporary password' })
    });

    assert.equal(response.status, 200);
    assert.equal(fixture.users.get('user_2').must_change_password, true);
    assert.equal(fixture.auditActions.includes('password_reset_by_admin'), true);
  });
});

test('admin write endpoints reject fake CSRF token', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test',
        cookie: auth.cookie
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 403);
  });
});

test('backend generates employee codes per department sequence and rejects client supplied codes', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const basePayload = {
      accountType: 'employee',
      displayName: 'Employee',
      password: 'temporary password',
      departmentId: 'dept_hr',
      employmentStartedAt: '2026-01-01'
    };
    const firstHr = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...basePayload, email: 'employee1@example.test', username: 'employee1' })
    });
    const firstHrBody = await firstHr.json();
    const secondHr = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...basePayload, email: 'employee2@example.test', username: 'employee2' })
    });
    const secondHrBody = await secondHr.json();
    const firstIds = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...basePayload, email: 'ids@example.test', username: 'ids', departmentId: 'dept_ids' })
    });
    const firstIdsBody = await firstIds.json();
    const suppliedCode = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...basePayload, email: 'bad@example.test', username: 'bad', employeeCode: 'HCS_HR999' })
    });
    const changeCode = await fetch(`${baseUrl}/api/admin/users/${firstHrBody.user.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ employeeCode: 'HCS_HR002' })
    });

    assert.equal(firstHr.status, 201);
    assert.equal(firstHrBody.user.employeeCode, 'HCS_HR001');
    assert.equal(secondHrBody.user.employeeCode, 'HCS_HR002');
    assert.equal(firstIdsBody.user.employeeCode, 'HCS_IDS001');
    assert.match(firstHrBody.user.employmentStartedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(firstHrBody.user.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(fixture.history.filter(item => item.userId === firstHrBody.user.id && item.effectiveTo === null).length, 1);
    assert.equal(suppliedCode.status, 422);
    assert.equal(changeCode.status, 409);
    assert.equal(fixture.auditActions.includes('employee_created'), true);
  });
});

test('technical account has no employee code and does not increment sequence', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const technical = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        accountType: 'technical',
        email: 'tech@example.test',
        username: 'tech',
        displayName: 'Tech',
        password: 'temporary password'
      })
    });
    const employee = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        accountType: 'employee',
        email: 'employee@example.test',
        username: 'employee',
        displayName: 'Employee',
        password: 'temporary password',
        departmentId: 'dept_hr'
      })
    });
    const technicalBody = await technical.json();
    const employeeBody = await employee.json();

    assert.equal(technical.status, 201);
    assert.equal(technicalBody.user.employeeCode, null);
    assert.equal(fixture.sequences.get('dept_hr') || 0, 1);
    assert.equal(employeeBody.user.employeeCode, 'HCS_HR001');
    assert.match(employeeBody.user.employmentStartedAt, /^\d{4}-\d{2}-\d{2}$/);
  });
});

test('employment dates accept date-only values and reject datetime or invalid ranges', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const basePayload = {
      accountType: 'employee',
      email: 'date@example.test',
      username: 'date_user',
      displayName: 'Date User',
      password: 'temporary password',
      departmentId: 'dept_hr'
    };
    const dateTime = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ ...basePayload, employmentStartedAt: '2026-01-01T00:00:00.000Z' })
    });
    const invalidRange = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        ...basePayload,
        email: 'range@example.test',
        username: 'range_user',
        employmentStartedAt: '2026-02-01',
        employmentEndedAt: '2026-01-31'
      })
    });

    assert.equal(dateTime.status, 422);
    assert.equal(invalidRange.status, 422);
  });
});

test('concurrent employee creation receives distinct employee codes', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const payloads = ['a', 'b'].map(suffix => fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        accountType: 'employee',
        email: `concurrent-${suffix}@example.test`,
        username: `concurrent_${suffix}`,
        displayName: `Concurrent ${suffix}`,
        password: 'temporary password',
        departmentId: 'dept_hr'
      })
    }));
    const bodies = await Promise.all((await Promise.all(payloads)).map(response => response.json()));
    assert.deepEqual(bodies.map(body => body.user.employeeCode).sort(), ['HCS_HR001', 'HCS_HR002']);
  });
});

test('transaction failure does not leave partial user or consumed sequence in fixture', async () => {
  const fixture = await createAdminFixture();
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const failed = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        accountType: 'employee',
        email: 'fail@example.test',
        username: 'fail_after_sequence',
        displayName: 'Fail',
        password: 'temporary password',
        departmentId: 'dept_hr'
      })
    });
    const next = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        accountType: 'employee',
        email: 'next@example.test',
        username: 'next',
        displayName: 'Next',
        password: 'temporary password',
        departmentId: 'dept_hr'
      })
    });
    const nextBody = await next.json();

    assert.equal(failed.status, 500);
    assert.equal([...fixture.users.values()].some(user => user.username === 'fail_after_sequence'), false);
    assert.equal(nextBody.user.employeeCode, 'HCS_HR001');
  });
});

test('department transfer preserves employee code and maintains single active history', async () => {
  const fixture = await createAdminFixture();
  fixture.addUser({ id: 'user_2', email: 'employee@example.test', username: 'employee', roles: ['employee'], employeeCode: 'HCS_HR001', departmentId: 'dept_hr', employmentStartedAt: '2026-01-01' });
  fixture.history.push({ id: 'hist_1', userId: 'user_2', fromDepartmentId: null, toDepartmentId: 'dept_hr', effectiveFrom: '2026-01-01', effectiveTo: null });

  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/users/user_2/transfer-department`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({
        toDepartmentId: 'dept_ids',
        effectiveFrom: '2026-02-01',
        reason: 'team move',
        decisionNumber: 'QD-01'
      })
    });
    const sameDepartment = await fetch(`${baseUrl}/api/admin/users/user_2/transfer-department`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ toDepartmentId: 'dept_ids', effectiveFrom: '2026-03-01' })
    });
    const inactiveDepartment = await fetch(`${baseUrl}/api/admin/users/user_2/transfer-department`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ toDepartmentId: 'dept_legal', effectiveFrom: '2026-03-01' })
    });
    const activeHistory = fixture.history.filter(item => item.userId === 'user_2' && item.effectiveTo === null);

    assert.equal(response.status, 200);
    assert.equal(fixture.users.get('user_2').employee_code, 'HCS_HR001');
    assert.equal(fixture.users.get('user_2').department_id, 'dept_ids');
    assert.equal(fixture.history.find(item => item.id === 'hist_1').effectiveTo, '2026-02-01');
    assert.equal(activeHistory.length, 1);
    assert.equal(activeHistory[0].toDepartmentId, 'dept_ids');
    assert.equal(sameDepartment.status, 409);
    assert.equal(inactiveDepartment.status, 409);
    assert.equal(fixture.auditActions.includes('employee_department_transfer'), true);
  });
});

test('departments.manage protects department APIs and termination revokes sessions without deleting employee code', async () => {
  const deniedFixture = await createAdminFixture({ permissions: ['ids.access'] });
  await withAdminServer(deniedFixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const response = await fetch(`${baseUrl}/api/admin/departments`, { headers: { cookie: auth.cookie } });
    assert.equal(response.status, 403);
  });

  const fixture = await createAdminFixture();
  fixture.addUser({ id: 'user_2', email: 'employee@example.test', username: 'employee', roles: ['employee'], employeeCode: 'HCS_HR001', departmentId: 'dept_hr', employmentStartedAt: '2026-01-01' });
  fixture.history.push({ id: 'hist_1', userId: 'user_2', fromDepartmentId: null, toDepartmentId: 'dept_hr', effectiveFrom: '2026-01-01', effectiveTo: null });
  await withAdminServer(fixture.dependencies, async baseUrl => {
    const auth = await loginAsAdmin(baseUrl);
    const csrf = await fetchCsrf(baseUrl);
    const createDepartment = await fetch(`${baseUrl}/api/admin/departments`, {
      method: 'POST',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ code: 'FIN', name: 'Finance' })
    });
    const terminate = await fetch(`${baseUrl}/api/admin/users/user_2`, {
      method: 'PATCH',
      headers: jsonHeaders(auth.cookie, csrf),
      body: JSON.stringify({ employmentStatus: 'terminated', employmentEndedAt: '2026-04-01' })
    });

    assert.equal(createDepartment.status, 201);
    assert.equal(terminate.status, 200);
    assert.equal(fixture.users.get('user_2').employee_code, 'HCS_HR001');
    assert.equal(fixture.revokedUserIds.includes('user_2'), true);
    assert.equal(fixture.history.find(item => item.id === 'hist_1').effectiveTo, '2026-04-01');
    assert.equal(fixture.auditActions.includes('employment_status_change'), true);
  });
});

async function createAdminFixture(options = {}) {
  const users = new Map();
  const roles = new Map([
    ['system_admin', { id: 'role_system_admin', code: 'system_admin', name: 'System Admin', permissions: ['ids.access', 'hrm.access', 'gis.access', 'users.manage', 'roles.manage', 'departments.manage'] }],
    ['employee', { id: 'role_employee', code: 'employee', name: 'Employee', permissions: ['ids.access'] }]
  ]);
  const permissions = ['ids.access', 'hrm.access', 'gis.access', 'users.manage', 'roles.manage', 'departments.manage', 'audit.read'];
  const departments = new Map([
    ['dept_hr', { id: 'dept_hr', code: 'HR', name: 'Human Resources', status: 'active', description: '' }],
    ['dept_ids', { id: 'dept_ids', code: 'IDS', name: 'IDS', status: 'active', description: '' }],
    ['dept_legal', { id: 'dept_legal', code: 'LEGAL', name: 'Legal', status: 'inactive', description: '' }]
  ]);
  const sequences = new Map();
  const history = [];
  const sessions = new Map();
  const auditActions = [];
  const revokedUserIds = [];
  const adminPasswordHash = await hashPassword('correct horse battery');

  const addUser = user => {
    users.set(user.id, {
      id: user.id,
      email: user.email,
      normalized_email: user.email.toLowerCase(),
      username: user.username,
      display_name: user.displayName || user.username,
      password_hash: user.passwordHash || adminPasswordHash,
      status: user.status || 'active',
      employee_code: user.employeeCode || null,
      department_id: user.departmentId || null,
      department_code: user.departmentId ? departments.get(user.departmentId)?.code : null,
      department_name: user.departmentId ? departments.get(user.departmentId)?.name : null,
      employment_status: user.employmentStatus || 'active',
      employment_started_at: user.employmentStartedAt || null,
      employment_ended_at: user.employmentEndedAt || null,
      must_change_password: Boolean(user.mustChangePassword),
      roles: user.roles || []
    });
  };
  addUser({ id: 'admin_1', email: 'admin@example.test', username: 'admin', roles: ['system_admin'] });

  const userRepository = {
    async findUserByEmailOrUsername(env, identifier) {
      const normalized = String(identifier).toLowerCase();
      return [...users.values()].find(user => user.normalized_email === normalized || user.username.toLowerCase() === normalized) || null;
    },
    async getUserRolesAndPermissions(env, userId) {
      const user = users.get(userId);
      const userRoles = user?.roles || [];
      const rolePermissions = userRoles.flatMap(code => roles.get(code)?.permissions || []);
      return {
        roles: userRoles,
        permissions: options.permissions || [...new Set(rolePermissions)]
      };
    },
    async updateLastLoginAt() {}
  };

  const sessionRepository = {
    async createSessionRecord(env, session) {
      const record = { id: `session_${sessions.size + 1}`, user_id: session.userId, session_token_hash: session.sessionTokenHash, idle_expires_at: session.idleExpiresAt, absolute_expires_at: session.absoluteExpiresAt, revoked_at: null };
      sessions.set(session.sessionTokenHash, record);
      return record;
    },
    async findSessionByTokenHash(env, tokenHash) {
      const session = sessions.get(tokenHash);
      const user = session ? users.get(session.user_id) : null;
      if (!session || !user || session.revoked_at) return null;
      return { ...session, email: user.email, normalized_email: user.normalized_email, username: user.username, display_name: user.display_name, status: user.status, must_change_password: user.must_change_password };
    },
    async revokeSessionByTokenHash(env, tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session) return false;
      session.revoked_at = new Date();
      return true;
    },
    async revokeSessionsByUserId(env, userId, exceptSessionId = null) {
      revokedUserIds.push(userId);
      let count = 0;
      for (const session of sessions.values()) {
        if (session.user_id === userId && session.id !== exceptSessionId) {
          session.revoked_at = new Date();
          count += 1;
        }
      }
      return count;
    },
    async getUserRolesAndPermissions(env, userId) {
      return userRepository.getUserRolesAndPermissions(env, userId);
    }
  };

  const adminRepository = {
    async listUsers() { return { users: [...users.values()].map(toAdminUser), total: users.size, limit: 20, offset: 0 }; },
    async findUserById(env, id) { return users.has(id) ? toAdminUser(users.get(id)) : null; },
    async findUserByEmailOrUsername(env, email, username) {
      const normalizedEmail = String(email).toLowerCase();
      const normalizedUsername = String(username).toLowerCase();
      return [...users.values()].find(user => user.normalized_email === normalizedEmail || user.username.toLowerCase() === normalizedUsername) || null;
    },
    async findUserByEmployeeCode(env, employeeCode) {
      return [...users.values()].find(user => user.employee_code === employeeCode) || null;
    },
    async createUser(env, user) {
      if (user.failAfterSequence) throw new Error('simulated_failure');
      const id = `user_${users.size + 1}`;
      let employeeCode = null;
      let departmentId = null;
      let employmentStartedAt = null;
      if (user.accountType === 'employee') {
        departmentId = user.departmentId;
        const department = departments.get(departmentId);
        const next = (sequences.get(departmentId) || 0) + 1;
        sequences.set(departmentId, next);
        employeeCode = `HCS_${department.code}${String(next).padStart(3, '0')}`;
        employmentStartedAt = user.employmentStartedAt || '2026-01-01';
        if (user.username === 'fail_after_sequence') {
          sequences.set(departmentId, next - 1);
          throw new Error('simulated_failure');
        }
      }
      addUser({
        id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        status: user.status,
        mustChangePassword: true,
        roles: [],
        employeeCode,
        departmentId,
        employmentStatus: user.employmentStatus,
        employmentStartedAt,
        employmentEndedAt: user.employmentEndedAt
      });
      if (departmentId && employmentStartedAt) {
        history.push({ id: `hist_${history.length + 1}`, userId: id, fromDepartmentId: null, toDepartmentId: departmentId, effectiveFrom: employmentStartedAt, effectiveTo: null });
      }
      for (const event of user.auditEvents || []) auditActions.push(event.action);
      return toAdminUser(users.get(id));
    },
    async updateUser(env, id, user) {
      const existing = users.get(id);
      Object.assign(existing, {
        email: user.email || existing.email,
        username: user.username || existing.username,
        display_name: user.displayName || existing.display_name,
        employee_code: user.employeeCode || existing.employee_code,
        department_id: user.departmentId || existing.department_id,
        department_code: user.departmentCode || existing.department_code,
        department_name: user.departmentId ? departments.get(user.departmentId)?.name : existing.department_name,
        employment_status: user.employmentStatus || existing.employment_status,
        employment_started_at: user.employmentStartedAt || existing.employment_started_at,
        employment_ended_at: user.employmentEndedAt || existing.employment_ended_at
      });
      return toAdminUser(existing);
    },
    async updateUserStatus(env, id, status) {
      users.get(id).status = status;
      return toAdminUser(users.get(id));
    },
    async setUserRoles(env, id, nextRoles) {
      users.get(id).roles = nextRoles;
      return toAdminUser(users.get(id));
    },
    async updateUserPassword(env, id, passwordHash, mustChangePassword) {
      users.get(id).password_hash = passwordHash;
      users.get(id).must_change_password = mustChangePassword;
      return toAdminUser(users.get(id));
    },
    async revokeSessionsByUserId(env, id) {
      revokedUserIds.push(id);
      return 1;
    },
    async closeActiveDepartmentHistory(env, id, effectiveTo) {
      const active = history.find(item => item.userId === id && item.effectiveTo === null);
      if (!active) return 0;
      active.effectiveTo = typeof effectiveTo === 'string' ? effectiveTo : effectiveTo.toISOString();
      return 1;
    },
    async countActiveSystemAdmins() {
      return [...users.values()].filter(user => user.status === 'active' && user.roles.includes('system_admin')).length;
    },
    async listRoles() {
      return [...roles.values()].map(role => ({ id: role.id, code: role.code, name: role.name, description: '', userCount: 0, permissions: role.permissions }));
    },
    async listPermissions() {
      return permissions.map(code => ({ id: `perm_${code}`, code, name: code, description: '' }));
    },
    async createRole(env, role) {
      roles.set(role.code, { id: `role_${role.code}`, code: role.code, name: role.name, description: role.description, permissions: [] });
      return { id: `role_${role.code}`, code: role.code, name: role.name, description: role.description, userCount: 0, permissions: [] };
    },
    async updateRole(env, id, input) {
      return [...roles.values()].find(role => role.id === id) || { id, ...input };
    },
    async setRolePermissions(env, id, nextPermissions) {
      const role = [...roles.values()].find(item => item.id === id);
      role.permissions = nextPermissions;
      return { ...role, userCount: 0 };
    },
    async findRoleById(env, id) {
      const role = [...roles.values()].find(item => item.id === id);
      return role ? { ...role, userCount: 0 } : null;
    },
    async listRolesByCodes(env, codes) {
      return codes.map(code => roles.get(code)).filter(Boolean);
    },
    async listPermissionsByCodes(env, codes) {
      return codes.filter(code => permissions.includes(code)).map(code => ({ id: `perm_${code}`, code }));
    },
    async listDepartments() {
      return [...departments.values()].map(toDepartment);
    },
    async findDepartmentById(env, id) {
      const department = departments.get(id);
      return department ? toDepartment(department) : null;
    },
    async findDepartmentByCode(env, code) {
      const department = [...departments.values()].find(item => item.code === code);
      return department ? toDepartment(department) : null;
    },
    async createDepartment(env, department) {
      const id = `dept_${department.code.toLowerCase()}`;
      departments.set(id, { id, code: department.code, name: department.name, status: department.status || 'active', description: department.description || '' });
      return toDepartment(departments.get(id));
    },
    async updateDepartment(env, id, department) {
      const existing = departments.get(id);
      Object.assign(existing, { name: department.name || existing.name, description: department.description ?? existing.description, status: department.status || existing.status });
      return toDepartment(existing);
    },
    async countActiveUsersInDepartment(env, departmentId) {
      return [...users.values()].filter(user => user.department_id === departmentId && user.status === 'active' && ['active', 'probation'].includes(user.employment_status)).length;
    },
    async getDepartmentHistory(env, userId) {
      return history.filter(item => item.userId === userId).map(item => ({
        id: item.id,
        fromDepartmentCode: item.fromDepartmentId ? departments.get(item.fromDepartmentId)?.code : null,
        toDepartmentCode: departments.get(item.toDepartmentId)?.code,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        decisionNumber: item.decisionNumber
      }));
    },
    async transferUserDepartment(env, userId, transfer) {
      const user = users.get(userId);
      const department = departments.get(transfer.toDepartmentId);
      if (!user) throw new Error('user_not_found');
      if (!department) throw new Error('department_not_found');
      if (department.status !== 'active') throw new Error('inactive_department');
      if (user.department_id === department.id) throw new Error('same_department');
      const active = history.find(item => item.userId === userId && item.effectiveTo === null);
      if (active) active.effectiveTo = transfer.effectiveFrom;
      history.push({
        id: `hist_${history.length + 1}`,
        userId,
        fromDepartmentId: user.department_id,
        toDepartmentId: department.id,
        effectiveFrom: transfer.effectiveFrom,
        effectiveTo: null,
        decisionNumber: transfer.decisionNumber
      });
      const fromDepartmentCode = user.department_code;
      user.department_id = department.id;
      user.department_code = department.code;
      user.department_name = department.name;
      return { user: toAdminUser(user), employeeCode: user.employee_code, fromDepartmentCode, toDepartmentCode: department.code };
    }
  };

  return {
    addUser,
    users,
    sessions,
    departments,
    sequences,
    history,
    auditActions,
    revokedUserIds,
    dependencies: {
      userRepository,
      sessionRepository,
      adminRepository,
      auditRepository: { async insertAuditLog(env, event) { auditActions.push(event.action); } },
      loginAttemptRepository: { async recordLoginAttempt() {}, async countRecentFailures() { return 0; } }
    }
  };
}

function toAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    status: user.status,
    employeeCode: user.employee_code,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    departmentName: user.department_name,
    employmentStatus: user.employment_status,
    employmentStartedAt: user.employment_started_at,
    employmentEndedAt: user.employment_ended_at,
    mustChangePassword: Boolean(user.must_change_password),
    roles: user.roles,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
}

function toDepartment(department) {
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.description,
    status: department.status,
    activeEmployeeCount: 0
  };
}

async function withAdminServer(dependencies, run) {
  const env = loadEnv({ NODE_ENV: 'development', PORT: '4173' });
  const server = createApp({ ...env, port: 0 }, dependencies);
  await new Promise(resolve => server.listen(0, resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function loginAsAdmin(baseUrl) {
  const csrf = await fetchCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(csrf.cookie, csrf),
    body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery' })
  });
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('set-cookie') };
}

async function fetchCsrf(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  const body = await response.json();
  return { token: body.csrfToken, cookie: response.headers.get('set-cookie') };
}

function jsonHeaders(cookie, csrf) {
  return {
    'content-type': 'application/json',
    'x-csrf-token': csrf.token,
    cookie: `${cookie}; ${csrf.cookie}`
  };
}

