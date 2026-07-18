create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  code varchar(20) unique not null,
  name varchar(150) not null,
  description text,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references users(id) on delete set null,
  updated_by_user_id uuid references users(id) on delete set null,
  constraint departments_code_check check (code ~ '^[A-Z0-9_]{2,10}$'),
  constraint departments_status_check check (status in ('active', 'inactive'))
);

alter table users add column if not exists employee_code varchar(30);
alter table users add column if not exists department_id uuid;
alter table users add column if not exists department_code varchar(20);
alter table users add column if not exists employment_status varchar(20) not null default 'active';
alter table users add column if not exists employment_started_at timestamptz;
alter table users add column if not exists employment_ended_at timestamptz;
alter table users add column if not exists updated_by_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_employee_code_check'
  ) then
    alter table users
      add constraint users_employee_code_check
      check (employee_code is null or employee_code ~ '^HCS_[A-Z]{2,10}[0-9]{3,5}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_employment_status_check'
  ) then
    alter table users
      add constraint users_employment_status_check
      check (employment_status in ('active', 'probation', 'suspended', 'terminated', 'retired'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_department_id_fkey'
  ) then
    alter table users
      add constraint users_department_id_fkey
      foreign key (department_id) references departments(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_department_code_fkey'
  ) then
    alter table users
      add constraint users_department_code_fkey
      foreign key (department_code) references departments(code) on update restrict on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_updated_by_user_id_fkey'
  ) then
    alter table users
      add constraint users_updated_by_user_id_fkey
      foreign key (updated_by_user_id) references users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_employment_dates_check'
  ) then
    alter table users
      add constraint users_employment_dates_check
      check (employment_ended_at is null or employment_started_at is null or employment_ended_at >= employment_started_at);
  end if;
end $$;

create unique index if not exists users_employee_code_unique on users (employee_code) where employee_code is not null;
create index if not exists users_department_id_idx on users (department_id);
create index if not exists users_department_code_idx on users (department_code);
create index if not exists users_employment_status_idx on users (employment_status);
create index if not exists users_updated_by_user_id_idx on users (updated_by_user_id);

create table if not exists employee_department_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  from_department_id uuid references departments(id) on delete restrict,
  to_department_id uuid not null references departments(id) on delete restrict,
  effective_from timestamptz not null,
  effective_to timestamptz,
  reason text,
  decision_number varchar(100),
  notes text,
  changed_by_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint employee_department_history_dates_check check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists employee_department_history_one_active
  on employee_department_history (user_id)
  where effective_to is null;

create index if not exists employee_department_history_user_id_idx on employee_department_history (user_id);
create index if not exists employee_department_history_effective_from_idx on employee_department_history (effective_from);
create index if not exists employee_department_history_to_department_id_idx on employee_department_history (to_department_id);
create index if not exists employee_department_history_changed_by_user_id_idx on employee_department_history (changed_by_user_id);

insert into permissions (code, description)
select 'departments.manage', 'Manage departments and employee department transfers'
where not exists (select 1 from permissions where code = 'departments.manage');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.code = 'departments.manage'
where r.code = 'system_admin'
  and not exists (
    select 1
    from role_permissions rp
    where rp.role_id = r.id
      and rp.permission_id = p.id
      and rp.revoked_at is null
  );
