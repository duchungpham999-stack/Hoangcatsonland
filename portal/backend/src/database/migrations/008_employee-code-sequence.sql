create table if not exists department_employee_sequences (
  department_id uuid primary key references departments(id) on delete restrict,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint department_employee_sequences_last_sequence_check check (last_sequence >= 0)
);
