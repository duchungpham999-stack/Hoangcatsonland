alter table users add column if not exists display_name text;
alter table users add column if not exists must_change_password boolean not null default true;
alter table users add column if not exists password_changed_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists created_by_user_id uuid;

update users
set display_name = coalesce(nullif(display_name, ''), username, split_part(normalized_email, '@', 1))
where display_name is null or display_name = '';

update users
set must_change_password = false
where must_change_password = true
  and (
    password_changed_at is not null
    or last_login_at is not null
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_created_by_user_id_fkey'
  ) then
    alter table users
      add constraint users_created_by_user_id_fkey
      foreign key (created_by_user_id) references users(id)
      on delete set null;
  end if;
end $$;

create index if not exists users_status_idx on users (status);
create index if not exists users_created_at_idx on users (created_at);
create index if not exists users_created_by_user_id_idx on users (created_by_user_id);
