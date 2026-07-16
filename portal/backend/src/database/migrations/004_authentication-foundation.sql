alter table users add column if not exists username text;

do $$
declare
  user_record record;
  base_username text;
  candidate_username text;
  suffix integer;
begin
  for user_record in
    select id, normalized_email
    from users
    where username is null or length(trim(username)) = 0
    order by created_at, id
  loop
    base_username := lower(split_part(user_record.normalized_email, '@', 1));
    base_username := regexp_replace(base_username, '[^a-z0-9._-]+', '-', 'g');
    base_username := trim(both '-' from base_username);

    if base_username is null or length(base_username) = 0 then
      base_username := 'user-' || replace(user_record.id::text, '-', '');
    end if;

    candidate_username := base_username;
    suffix := 2;

    while exists (
      select 1
      from users
      where lower(username) = lower(candidate_username)
        and id <> user_record.id
    ) loop
      candidate_username := base_username || '-' || suffix::text;
      suffix := suffix + 1;
    end loop;

    update users
    set username = candidate_username,
        updated_at = now()
    where id = user_record.id;
  end loop;
end $$;

alter table users alter column username set not null;

create unique index if not exists users_username_lower_unique on users (lower(username));
