create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text generated always as (lower(trim(email))) stored,
  display_name text,
  password_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  deleted_at timestamptz,
  constraint users_email_not_blank check (length(trim(email)) > 3),
  constraint users_status_check check (status in ('pending', 'active', 'disabled', 'locked'))
);

create unique index if not exists users_normalized_email_unique on users (normalized_email);
create index if not exists users_status_idx on users (status);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists roles_code_unique on roles (lower(code));
create index if not exists roles_revoked_at_idx on roles (revoked_at);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists permissions_code_unique on permissions (lower(code));
create index if not exists permissions_revoked_at_idx on permissions (revoked_at);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role_id)
);

create index if not exists user_roles_role_id_idx on user_roles (role_id);
create index if not exists user_roles_revoked_at_idx on user_roles (revoked_at);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_permission_id_idx on role_permissions (permission_id);
create index if not exists role_permissions_revoked_at_idx on role_permissions (revoked_at);
