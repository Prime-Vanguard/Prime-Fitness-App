create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  muscle text not null,
  equipment text,
  instructions text,
  media_url text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exercises to authenticated;
grant all on public.exercises to service_role;
alter table public.exercises enable row level security;
create policy "Members view active exercises" on public.exercises for select to authenticated
  using (active or public.is_admin(auth.uid()));
create policy "Admins insert exercises" on public.exercises for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins update exercises" on public.exercises for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins delete exercises" on public.exercises for delete to authenticated using (public.is_admin(auth.uid()));
create trigger trg_exercises_updated before update on public.exercises for each row execute function public.update_updated_at_column();

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  title text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.workout_sessions (member_id, started_at desc);
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant all on public.workout_sessions to service_role;
alter table public.workout_sessions enable row level security;
create policy "View own or managed sessions" on public.workout_sessions for select to authenticated
  using (member_id = auth.uid() or public.is_admin(auth.uid()) or public.manages_member(auth.uid(), member_id));
create policy "Insert own sessions" on public.workout_sessions for insert to authenticated with check (member_id = auth.uid());
create policy "Update own sessions" on public.workout_sessions for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "Delete own unfinished sessions" on public.workout_sessions for delete to authenticated using (member_id = auth.uid() and finished_at is null);
create trigger trg_sessions_updated before update on public.workout_sessions for each row execute function public.update_updated_at_column();

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_number int not null check (set_number > 0),
  reps int check (reps >= 0 and reps <= 1000),
  weight_kg numeric(6,2) check (weight_kg >= 0 and weight_kg <= 1000),
  rpe numeric(3,1) check (rpe between 1 and 10),
  created_at timestamptz not null default now()
);
create index on public.set_logs (session_id);
create index on public.set_logs (member_id, exercise_id, created_at desc);
grant select, insert, update, delete on public.set_logs to authenticated;
grant all on public.set_logs to service_role;
alter table public.set_logs enable row level security;
create policy "View own or managed sets" on public.set_logs for select to authenticated
  using (member_id = auth.uid() or public.is_admin(auth.uid()) or public.manages_member(auth.uid(), member_id));
create policy "Insert own sets in own open session" on public.set_logs for insert to authenticated
  with check (member_id = auth.uid() and exists (select 1 from public.workout_sessions s where s.id = session_id and s.member_id = auth.uid() and s.finished_at is null));
create policy "Update own sets" on public.set_logs for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "Delete own sets" on public.set_logs for delete to authenticated using (member_id = auth.uid());

insert into public.exercises (name_en, name_ar, muscle, equipment) values
('Barbell Back Squat','سكوات بالبار','legs','barbell'),
('Romanian Deadlift','رفعة رومانية','hamstrings','barbell'),
('Deadlift','رفعة ميتة','back','barbell'),
('Bench Press','بنش برس','chest','barbell'),
('Incline Dumbbell Press','ضغط مائل بالدمبل','chest','dumbbell'),
('Overhead Press','ضغط فوق الرأس','shoulders','barbell'),
('Pull-up','عقلة','back','bodyweight'),
('Barbell Row','تجديف بالبار','back','barbell'),
('Lat Pulldown','سحب علوي','back','cable'),
('Walking Lunge','طعنات المشي','legs','dumbbell'),
('Dumbbell Curl','تبادل بايسبس بالدمبل','arms','dumbbell'),
('Plank','بلانك','core','bodyweight');