create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  device_type text not null,
  status text not null default 'pending',
  credential_reference text,
  certificate_reference text,
  fingerprint_hash text not null,
  approved_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_type_check check (device_type in ('desktop', 'mobile', 'tablet', 'service', 'unknown')),
  constraint devices_status_check check (status in ('pending', 'approved', 'revoked'))
);

create unique index if not exists devices_fingerprint_hash_unique on devices (fingerprint_hash);
create index if not exists devices_user_id_idx on devices (user_id);
create index if not exists devices_status_idx on devices (status);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  session_token_hash text not null,
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create unique index if not exists sessions_token_hash_unique on sessions (session_token_hash);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_device_id_idx on sessions (device_id);
create index if not exists sessions_expiry_idx on sessions (idle_expires_at, absolute_expires_at);
create index if not exists sessions_revoked_at_idx on sessions (revoked_at);

create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  normalized_email text,
  result text not null,
  ip inet,
  request_id text,
  device_id uuid references devices(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  constraint login_attempts_result_check check (result in ('success', 'failure', 'blocked'))
);

create index if not exists login_attempts_user_id_idx on login_attempts (user_id);
create index if not exists login_attempts_normalized_email_idx on login_attempts (normalized_email);
create index if not exists login_attempts_created_at_idx on login_attempts (created_at);

create table if not exists webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  credential_id_hash text not null,
  public_key text not null,
  sign_count bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists webauthn_credentials_id_hash_unique on webauthn_credentials (credential_id_hash);
create index if not exists webauthn_credentials_user_id_idx on webauthn_credentials (user_id);
create index if not exists webauthn_credentials_revoked_at_idx on webauthn_credentials (revoked_at);

create table if not exists recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recovery_tokens_purpose_check check (purpose in ('account_recovery', 'password_reset'))
);

create unique index if not exists recovery_tokens_hash_unique on recovery_tokens (token_hash);
create index if not exists recovery_tokens_user_id_idx on recovery_tokens (user_id);
create index if not exists recovery_tokens_expiry_idx on recovery_tokens (expires_at);
