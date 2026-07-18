alter table users add column if not exists employment_started_on date;
alter table users add column if not exists employment_ended_on date;

update users
set employment_started_on = employment_started_at::date
where employment_started_on is null
  and employment_started_at is not null;

update users
set employment_ended_on = employment_ended_at::date
where employment_ended_on is null
  and employment_ended_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_employment_date_only_check'
  ) then
    alter table users
      add constraint users_employment_date_only_check
      check (employment_ended_on is null or employment_started_on is null or employment_ended_on >= employment_started_on);
  end if;
end $$;

create index if not exists users_employment_started_on_idx on users (employment_started_on);
create index if not exists users_employment_ended_on_idx on users (employment_ended_on);
