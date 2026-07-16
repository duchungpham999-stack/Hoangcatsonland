create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  result text not null,
  request_id text,
  ip inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_result_check check (result in ('success', 'failure', 'denied'))
);

create index if not exists audit_logs_actor_user_id_idx on audit_logs (actor_user_id);
create index if not exists audit_logs_action_idx on audit_logs (action);
create index if not exists audit_logs_resource_idx on audit_logs (resource_type, resource_id);
create index if not exists audit_logs_request_id_idx on audit_logs (request_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at);
