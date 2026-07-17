with required_permissions (code, description) as (
  values
    ('ids.access', 'Access IDS workspace'),
    ('hrm.access', 'Access HRM workspace'),
    ('gis.access', 'Access GIS workspace'),
    ('users.manage', 'Manage users'),
    ('roles.manage', 'Manage roles and permissions'),
    ('audit.read', 'Read audit logs')
)
insert into permissions (code, description)
select rp.code, rp.description
from required_permissions rp
where not exists (
  select 1
  from permissions p
  where lower(p.code) = lower(rp.code)
);

insert into roles (code, name, description)
select 'system_admin', 'System Administrator', 'Full portal administrator'
where not exists (
  select 1
  from roles r
  where lower(r.code) = lower('system_admin')
);

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where lower(r.code) = lower('system_admin')
  and p.code in (
    'ids.access',
    'hrm.access',
    'gis.access',
    'users.manage',
    'roles.manage',
    'audit.read'
  )
  and not exists (
    select 1
    from role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
  );
