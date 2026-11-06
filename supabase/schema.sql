-- VSpark Web Development Competition Portal
-- Run in Supabase SQL Editor for a new project. Never expose the service role key.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'participant' check (role in ('participant','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.create_competition_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
declare metadata jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  if metadata ? 'reg' then
    if not (select registration_open from public.competition_settings where id = 1) then
      raise exception 'Competition registration is closed';
    end if;
    insert into public.participants (
      user_id, name, reg, email, phone, department, semester, batch,
      participation_type, team, member, university_name, competition_id
    ) values (
      new.id, metadata->>'name', metadata->>'reg', new.email, metadata->>'phone',
      metadata->>'department', metadata->>'semester', metadata->>'batch',
      coalesce(metadata->>'type', 'Individual'), nullif(metadata->>'team',''),
      jsonb_build_object(
        'memberName', metadata->>'memberName', 'memberReg', metadata->>'memberReg',
        'memberEmail', metadata->>'memberEmail', 'memberPhone', metadata->>'memberPhone'
      ), coalesce(metadata->>'university','COMSATS University Islamabad, Vehari Campus'),
      nullif(metadata->>'competition_id','')::uuid
    );
    if nullif(metadata->>'competition_id','') is not null then
      insert into public.competition_registrations (
        competition_id,user_id,registration_number,university_name,department,batch,semester,
        participation_type,team_name,member_details
      ) values (
        (metadata->>'competition_id')::uuid,new.id,metadata->>'reg',
        coalesce(metadata->>'university','COMSATS University Islamabad, Vehari Campus'),
        metadata->>'department',metadata->>'batch',metadata->>'semester',
        coalesce(metadata->>'type','Individual'),nullif(metadata->>'team',''),
        jsonb_build_object('memberName',metadata->>'memberName','memberReg',metadata->>'memberReg',
          'memberEmail',metadata->>'memberEmail','memberPhone',metadata->>'memberPhone')
      );
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_competition_profile on auth.users;
create trigger on_auth_user_created_competition_profile after insert on auth.users
  for each row execute procedure public.create_competition_profile();

create table if not exists public.competition_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Build for impact',
  duration_minutes integer not null default 120 check (duration_minutes between 1 and 240),
  mode text not null default 'Online',
  task text not null default '',
  registration_open boolean not null default true,
  payment_enabled boolean not null default false,
  payment_amount text,
  payment_instructions text,
  drive_upload_url text,
  drive_enabled boolean not null default false,
  results_published boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.competition_settings (id) values (1) on conflict do nothing;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  reg text not null unique,
  email text not null unique,
  phone text not null,
  department text not null,
  semester text not null,
  batch text not null,
  participation_type text not null check (participation_type in ('Individual','Team')),
  team text,
  member jsonb not null default '{}'::jsonb,
  payment_status text not null default 'Pending' check (payment_status in ('Pending','Verified','Rejected')),
  payment_ref text,
  payment_proof_path text,
  payment_comment text,
  project text,
  github_url text,
  live_url text,
  drive_url text,
  submitted_at timestamptz,
  started_at timestamptz,
  evaluation jsonb not null default '{}'::jsonb,
  feedback text,
  evaluated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  participant_id uuid references public.participants(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_competition_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_competition_admin() from public;
grant execute on function public.is_competition_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.competition_settings enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_competition_admin());
drop policy if exists "profile self create" on public.profiles;
create policy "profile self create" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'participant');
drop policy if exists "profile self update name" on public.profiles;
create policy "profile self update name" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_competition_admin())
  with check ((id = auth.uid() and role = 'participant') or public.is_competition_admin());

drop policy if exists "participants own or admin read" on public.participants;
create policy "participants own or admin read" on public.participants for select to authenticated
  using (user_id = auth.uid() or public.is_competition_admin());
drop policy if exists "participants register self" on public.participants;
drop policy if exists "participants update own or admin" on public.participants;
create policy "participants update own or admin" on public.participants for update to authenticated
  using (user_id = auth.uid() or public.is_competition_admin())
  with check (user_id = auth.uid() or public.is_competition_admin());
drop policy if exists "settings public read" on public.competition_settings;
drop policy if exists "settings participant or admin read" on public.competition_settings;
create policy "settings participant or admin read" on public.competition_settings for select to authenticated
  using (public.is_competition_admin() or exists(select 1 from public.participants p where p.user_id=auth.uid()));
drop policy if exists "settings admin update" on public.competition_settings;
create policy "settings admin update" on public.competition_settings for update to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "audit admin read" on public.audit_events;
create policy "audit admin read" on public.audit_events for select to authenticated using (public.is_competition_admin());
drop policy if exists "audit authenticated insert" on public.audit_events;
create policy "audit authenticated insert" on public.audit_events for insert to authenticated with check (actor_id = auth.uid());

grant select on public.competition_settings to authenticated;
create or replace view public.public_competition_settings with (security_barrier=true) as
select id,title,duration_minutes,mode,registration_open,payment_enabled,payment_amount,payment_instructions,results_published
from public.competition_settings where id=1;
grant select on public.public_competition_settings to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.participants to authenticated;
-- Participants can edit only these own-account fields. Payment verification and scores
-- require the restricted admin RPC added below.
grant update (phone, payment_ref, payment_proof_path, updated_at)
  on public.participants to authenticated;
grant update on public.competition_settings to authenticated;
grant select, insert on public.audit_events to authenticated;

create or replace function public.admin_update_participant(p_id uuid, p_patch jsonb)
returns public.participants language plpgsql security definer set search_path = public
as $$
declare
  updated public.participants;
  item record;
  maximum integer;
begin
  if not public.is_competition_admin() then raise exception 'Organizer access required'; end if;
  if p_patch ? 'evaluation' then
    for item in select key, value from jsonb_each_text(p_patch->'evaluation') loop
      maximum := case item.key
        when 'UI/UX and Responsiveness' then 10 when 'Authentication' then 15
        when 'Database and CRUD' then 20 when 'Cloud Storage' then 10
        when 'External API' then 15 when 'Deployment' then 15
        when 'Code Quality' then 5 when 'Documentation' then 5 when 'Live Demo' then 5
        else null end;
      if maximum is null or item.value !~ '^\d+$' or item.value::integer > maximum then
        raise exception 'Invalid evaluation criterion or score';
      end if;
    end loop;
  end if;
  update public.participants set
    payment_status = coalesce(p_patch->>'payment_status', payment_status),
    payment_comment = coalesce(p_patch->>'payment_comment', payment_comment),
    winner_status = coalesce(p_patch->>'winner_status', winner_status),
    evaluation = coalesce(p_patch->'evaluation', evaluation),
    feedback = coalesce(p_patch->>'feedback', feedback),
    evaluated = coalesce((p_patch->>'evaluated')::boolean, evaluated),
    updated_at = now()
  where id = p_id returning * into updated;
  return updated;
end;
$$;
revoke all on function public.admin_update_participant(uuid, jsonb) from public;
grant execute on function public.admin_update_participant(uuid, jsonb) to authenticated;

create or replace function public.start_competition_timer(p_id uuid)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare started timestamptz;
begin
  update public.participants set started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_id and user_id = auth.uid()
  returning started_at into started;
  if started is null then raise exception 'Participant record not found'; end if;
  return started;
end;
$$;
revoke all on function public.start_competition_timer(uuid) from public;
grant execute on function public.start_competition_timer(uuid) to authenticated;

create or replace function public.save_competition_submission_draft(
  p_id uuid, p_project text, p_description text, p_technologies text, p_api_details text,
  p_github text, p_live text, p_drive text
) returns public.participants language plpgsql security definer set search_path=public
as $$
declare row_data public.participants; api_line text;
begin
  select * into row_data from public.participants where id=p_id and user_id=auth.uid();
  if row_data.id is null then raise exception 'Participant record not found'; end if;
  if row_data.started_at is not null and now()>row_data.started_at + make_interval(mins=>(select duration_minutes from public.competition_settings where id=1)) then
    raise exception 'The submission deadline has passed';
  end if;
  if coalesce(p_github,'')<>'' and p_github !~* '^https?://' then raise exception 'GitHub link must use HTTP or HTTPS'; end if;
  if coalesce(p_live,'')<>'' and p_live !~* '^https?://' then raise exception 'Live deployment link must use HTTP or HTTPS'; end if;
  if coalesce(p_drive,'')<>'' and p_drive !~* '^https?://' then raise exception 'Drive link must use HTTP or HTTPS'; end if;
  foreach api_line in array string_to_array(coalesce(p_api_details,''),E'\n') loop
    if btrim(api_line)<>'' and (position('|' in api_line)=0 or btrim(split_part(api_line,'|',1))='' or btrim(split_part(api_line,'|',2)) !~* '^https?://') then
      raise exception 'Each external API must include a name and HTTP or HTTPS URL';
    end if;
  end loop;
  update public.participants set project=nullif(btrim(coalesce(p_project,'')),''),
    project_description=coalesce(p_description,''),technologies=coalesce(p_technologies,''),api_details=coalesce(p_api_details,''),
    github_url=nullif(p_github,''),live_url=nullif(p_live,''),drive_url=nullif(p_drive,''),updated_at=now()
  where id=p_id returning * into row_data;
  return row_data;
end;
$$;
revoke all on function public.save_competition_submission_draft(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.save_competition_submission_draft(uuid,text,text,text,text,text,text,text) to authenticated;

create or replace function public.submit_competition_project(
  p_id uuid, p_project text, p_description text, p_technologies text, p_api_details text,
  p_github text, p_live text, p_drive text
) returns public.participants language plpgsql security definer set search_path = public
as $$
declare
  current_row public.participants;
  duration integer;
  api_line text;
begin
  select * into current_row from public.participants where id = p_id and user_id = auth.uid();
  if current_row.id is null then raise exception 'Participant record not found'; end if;
  if current_row.started_at is null then raise exception 'Start the competition timer before submitting'; end if;
  select duration_minutes into duration from public.competition_settings where id = 1;
  if now() > current_row.started_at + make_interval(mins => duration) then
    raise exception 'The submission deadline has passed';
  end if;
  if length(btrim(coalesce(p_project,''))) < 2 then raise exception 'Enter a project name'; end if;
  if coalesce(p_github,'') !~* '^https?://' or coalesce(p_live,'') !~* '^https?://' or coalesce(p_drive,'') !~* '^https?://' then
    raise exception 'GitHub, live, and Drive links must use HTTP or HTTPS';
  end if;
  if btrim(coalesce(p_api_details,'')) = '' then raise exception 'Add at least one external API'; end if;
  foreach api_line in array string_to_array(p_api_details, E'\n') loop
    if position('|' in api_line) = 0 or split_part(api_line, '|', 1) = ''
      or split_part(api_line, '|', 2) !~* '^https?://' then
      raise exception 'Each external API must include a name and HTTP or HTTPS URL';
    end if;
  end loop;
  update public.participants set project = btrim(p_project), github_url = p_github,
    live_url = p_live, drive_url = p_drive, project_description = coalesce(p_description,''),
    technologies = coalesce(p_technologies,''), api_details = p_api_details,
    submitted_at = now(), updated_at = now()
  where id = p_id returning * into current_row;
  return current_row;
end;
$$;
revoke all on function public.submit_competition_project(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_competition_project(uuid,text,text,text,text,text,text,text) to authenticated;

create or replace function public.published_competition_results()
returns table (id uuid, name text, team text, project text, batch text, evaluation jsonb)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.team, p.project, p.batch, p.evaluation
  from public.participants p cross join public.competition_settings s
  where s.id = 1 and s.results_published and p.evaluated
  order by (select coalesce(sum(value::text::integer),0) from jsonb_each(p.evaluation)) desc;
$$;
revoke all on function public.published_competition_results() from public;
grant execute on function public.published_competition_results() to anon, authenticated;

-- Create a private bucket for optional payment proof uploads. Private access only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 550000,
  array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Normalized multi-competition records for the extended portal.
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text not null default '',
  detailed_description text not null default '',
  university_name text not null default 'COMSATS University Islamabad',
  department text not null default 'Department of Computer Science',
  rules_html text not null default '',
  task_html text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  registration_deadline timestamptz,
  status text not null default 'upcoming' check (status in ('draft','upcoming','active','completed','archived')),
  task text not null default '',
  submission_instructions text not null default '',
  required_technologies text not null default '',
  drive_upload_url text,
  drive_enabled boolean not null default false,
  results_announced boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.competitions add column if not exists submission_instructions text not null default '';
alter table public.competitions add column if not exists required_technologies text not null default '';

-- Add after competitions exists and before policies/RPCs reference this relationship.
alter table public.participants add column if not exists competition_id uuid references public.competitions(id) on delete cascade;

-- Give a fresh project one real catalog entry so the public listing and registration
-- flow have a competition to use immediately after the schema is installed.
insert into public.competitions (
  title, short_description, detailed_description, university_name, department,
  task, status, starts_at
)
select s.title, 'Build, integrate, and deploy a working web application in 120 minutes.',
  'A timed web development challenge for COMSATS University Islamabad, Vehari Campus.',
  'COMSATS University Islamabad, Vehari Campus', 'Department of Computer Science',
  s.task, 'upcoming', now() + interval '30 days'
from public.competition_settings s
where s.id = 1 and not exists (select 1 from public.competitions);

create table if not exists public.competition_registrations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  registration_number text not null,
  university_name text not null,
  department text not null,
  batch text not null,
  semester text not null,
  participation_type text not null check (participation_type in ('Individual','Team')),
  team_name text,
  member_details jsonb not null default '{}'::jsonb,
  payment_status text not null default 'Pending' check (payment_status in ('Pending','Verified','Rejected')),
  winner_status text not null default 'Not Announced' check (winner_status in ('Winner','Runner-up','Participant','Not Announced')),
  created_at timestamptz not null default now(),
  unique (competition_id, user_id),
  unique (competition_id, registration_number)
);

create or replace function public.enforce_two_competitions()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  deadline timestamptz;
  status_value text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(lower(new.registration_number), 1));
  perform pg_advisory_xact_lock(hashtextextended(lower(coalesce((select email from auth.users where id = new.user_id),'')), 2));
  select registration_deadline, status into deadline, status_value
    from public.competitions where id = new.competition_id;
  if status_value is null or status_value in ('draft','completed','archived') then
    raise exception 'This competition is not accepting registrations';
  end if;
  if deadline is not null and now() > deadline then raise exception 'Registration has closed'; end if;
  if (select count(*) from public.competition_registrations r
      where r.user_id = new.user_id or lower(r.registration_number) = lower(new.registration_number)
      or exists(select 1 from auth.users old_user join auth.users new_user on new_user.id = new.user_id
        where old_user.id = r.user_id and lower(old_user.email) = lower(new_user.email))) >= 2 then
    raise exception 'A participant may join at most two competitions';
  end if;
  return new;
end;
$$;
drop trigger if exists before_competition_registration on public.competition_registrations;
create trigger before_competition_registration before insert on public.competition_registrations
  for each row execute procedure public.enforce_two_competitions();

create table if not exists public.competition_submissions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.competition_registrations(id) on delete cascade,
  project_title text not null,
  project_description text not null default '',
  technologies text not null default '',
  github_url text not null,
  live_url text not null,
  participant_drive_url text not null,
  external_apis jsonb not null default '[]'::jsonb,
  document_path text,
  readme_confirmed boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz,
  scores jsonb not null default '{}'::jsonb,
  judge_feedback text,
  evaluated boolean not null default false,
  updated_at timestamptz not null default now(),
  check (github_url ~* '^https?://' and live_url ~* '^https?://' and participant_drive_url ~* '^https?://')
);

create table if not exists public.competition_documents (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  storage_path text not null,
  display_name text not null,
  content_type text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.competition_winners (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  registration_id uuid not null references public.competition_registrations(id) on delete cascade,
  placement smallint not null check (placement between 1 and 3),
  approved_public_links boolean not null default false,
  announced_at timestamptz,
  unique (competition_id, placement),
  unique (competition_id, registration_id)
);

create table if not exists public.competition_announcements (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  subject text not null,
  body text not null,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.competition_announcements(id) on delete cascade,
  recipient_email text not null,
  provider_message_id text,
  status text not null check (status in ('queued','sent','delivered','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.competitions enable row level security;
alter table public.competition_registrations enable row level security;
alter table public.competition_submissions enable row level security;
alter table public.competition_documents enable row level security;
alter table public.competition_winners enable row level security;
alter table public.competition_announcements enable row level security;
alter table public.email_delivery_logs enable row level security;
drop policy if exists "public competition details" on public.competitions;
drop policy if exists "admin manage competitions" on public.competitions;
create policy "admin manage competitions" on public.competitions for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "registrations owner or admin read" on public.competition_registrations;
create policy "registrations owner or admin read" on public.competition_registrations for select to authenticated
  using (user_id = auth.uid() or public.is_competition_admin());
drop policy if exists "participant register self" on public.competition_registrations;
create policy "participant register self" on public.competition_registrations for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "admin manage registrations" on public.competition_registrations;
create policy "admin manage registrations" on public.competition_registrations for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "submission owner or admin" on public.competition_submissions;
create policy "submission owner or admin" on public.competition_submissions for select to authenticated
  using (exists (select 1 from public.competition_registrations r where r.id = registration_id and (r.user_id = auth.uid() or public.is_competition_admin())));
drop policy if exists "participant manage own submission" on public.competition_submissions;
create policy "participant manage own submission" on public.competition_submissions for all to authenticated
  using (exists (select 1 from public.competition_registrations r where r.id = registration_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.competition_registrations r where r.id = registration_id and r.user_id = auth.uid()));
drop policy if exists "admin manage submissions" on public.competition_submissions;
create policy "admin manage submissions" on public.competition_submissions for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "public announced winners" on public.competition_winners;
create policy "public announced winners" on public.competition_winners for select to anon, authenticated
  using (announced_at is not null);
drop policy if exists "admin manage winners" on public.competition_winners;
create policy "admin manage winners" on public.competition_winners for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "admin manage competition documents" on public.competition_documents;
create policy "admin manage competition documents" on public.competition_documents for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "registered users read competition documents" on public.competition_documents;
create policy "registered users read competition documents" on public.competition_documents for select to authenticated
  using (exists(select 1 from public.competition_registrations r where r.competition_id = public.competition_documents.competition_id and r.user_id = auth.uid()));
drop policy if exists "admin manage announcements" on public.competition_announcements;
create policy "admin manage announcements" on public.competition_announcements for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "admin read email logs" on public.email_delivery_logs;
create policy "admin read email logs" on public.email_delivery_logs for select to authenticated using (public.is_competition_admin());
grant select, insert, update, delete on public.competitions to authenticated;
grant select on public.competitions to authenticated;
grant select on public.competition_registrations to authenticated;
grant insert (competition_id,user_id,registration_number,university_name,department,batch,semester,participation_type,team_name,member_details)
  on public.competition_registrations to authenticated;
grant update (registration_number,university_name,department,batch,semester,participation_type,team_name,member_details)
  on public.competition_registrations to authenticated;
grant select, insert on public.competition_submissions to authenticated;
grant update (project_title,project_description,technologies,github_url,live_url,participant_drive_url,external_apis,document_path,readme_confirmed,started_at,submitted_at,updated_at)
  on public.competition_submissions to authenticated;
grant select, insert, update, delete on public.competition_documents to authenticated;
grant select, insert, update, delete on public.competition_winners to authenticated;
grant select, insert, update, delete on public.competition_announcements to authenticated;
grant select on public.email_delivery_logs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('competition-files', 'competition-files', false, 10485760,
  array['image/png','image/jpeg','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/x-zip-compressed','text/plain','text/csv','application/json','application/javascript','text/javascript','text/css','text/html','application/octet-stream'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "admins upload competition files" on storage.objects;
create policy "admins upload competition files" on storage.objects for insert to authenticated
  with check (bucket_id = 'competition-files' and public.is_competition_admin());
drop policy if exists "registered participant read competition files" on storage.objects;
create policy "registered participant read competition files" on storage.objects for select to authenticated
  using (bucket_id = 'competition-files' and (public.is_competition_admin() or exists(
    select 1 from public.competition_registrations r where r.user_id = auth.uid()
    and r.competition_id::text = (storage.foldername(name))[1]
  )));

-- Competition and participant resources are separate records. Google Drive files
-- store Google IDs/metadata only; direct uploads use the private bucket above.
create table if not exists public.competition_resources (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  source text not null check (source in ('upload','google_drive','link')),
  resource_type text not null check (resource_type in ('file','folder','link')),
  category text not null default 'Other Documents',
  display_name text not null,
  description text not null default '',
  storage_path text,
  google_file_id text,
  link_url text,
  mime_type text not null default 'application/octet-stream',
  file_size bigint,
  google_metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'registered' check (visibility in ('registered','public','private')),
  enabled boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source='upload' and storage_path is not null) or source<>'upload'),
  check ((source='google_drive' and google_file_id is not null) or source<>'google_drive'),
  check ((source='link' and link_url ~* '^https?://') or source<>'link')
);
create index if not exists competition_resources_competition_idx on public.competition_resources(competition_id, created_at desc);
create index if not exists competition_resources_participant_idx on public.competition_resources(participant_id, created_at desc);
alter table public.competition_resources enable row level security;
drop policy if exists "read visible competition resources" on public.competition_resources;
create policy "read visible competition resources" on public.competition_resources for select to authenticated
  using (enabled and (visibility='public' or public.is_competition_admin() or exists(
    select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()
  )));
drop policy if exists "admin manage competition resources" on public.competition_resources;
create policy "admin manage competition resources" on public.competition_resources for all to authenticated
  using (public.is_competition_admin()) with check (public.is_competition_admin());
drop policy if exists "participant add own competition resources" on public.competition_resources;
create policy "participant add own competition resources" on public.competition_resources for insert to authenticated
  with check (participant_id is not null and uploaded_by=auth.uid() and exists(
    select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid() and p.competition_id=competition_id
  ));
drop policy if exists "participant update own competition resources" on public.competition_resources;
create policy "participant update own competition resources" on public.competition_resources for update to authenticated
  using (participant_id is not null and exists(select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()))
  with check (participant_id is not null and uploaded_by=auth.uid() and exists(
    select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid() and p.competition_id=competition_id
  ));
drop policy if exists "participant delete own competition resources" on public.competition_resources;
create policy "participant delete own competition resources" on public.competition_resources for delete to authenticated
  using (participant_id is not null and exists(select 1 from public.participants p where p.id=participant_id and p.user_id=auth.uid()));
create or replace function public.enforce_participant_resource_deadline()
returns trigger language plpgsql security definer set search_path=public
as $$
declare participant_row public.participants; target_participant uuid;
begin
  if public.is_competition_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  target_participant := case when tg_op='DELETE' then old.participant_id else new.participant_id end;
  if target_participant is not null then
    select * into participant_row from public.participants where id=target_participant and user_id=auth.uid();
    if participant_row.id is null then raise exception 'Participant resource access denied'; end if;
    if participant_row.started_at is not null and now()>participant_row.started_at + make_interval(mins=>(select duration_minutes from public.competition_settings where id=1)) then
      raise exception 'The submission deadline has passed';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists participant_resource_deadline on public.competition_resources;
create trigger participant_resource_deadline before insert or update or delete on public.competition_resources
  for each row execute procedure public.enforce_participant_resource_deadline();
grant select, insert, update, delete on public.competition_resources to authenticated;
create or replace view public.public_competition_catalog with (security_barrier=true) as
select id,title,short_description,university_name,department,starts_at,ends_at,registration_deadline,status,results_announced
from public.competitions where status <> 'draft';
grant select on public.public_competition_catalog to anon, authenticated;

create or replace function public.authorized_competition_details(p_competition_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare result jsonb;
begin
  if not public.is_competition_admin() and not exists(
    select 1 from public.competition_registrations r where r.competition_id=p_competition_id and r.user_id=auth.uid()
    union all
    select 1 from public.participants p where p.competition_id=p_competition_id and p.user_id=auth.uid()
  ) then raise exception 'Register for this competition to view its private details'; end if;
  select jsonb_build_object(
    'id',c.id,'title',c.title,'short_description',c.short_description,'detailed_description',c.detailed_description,
    'university_name',c.university_name,'department',c.department,'rules_html',c.rules_html,'task_html',c.task_html,
    'task',c.task,'submission_instructions',c.submission_instructions,'required_technologies',c.required_technologies,
    'starts_at',c.starts_at,'ends_at',c.ends_at,'registration_deadline',c.registration_deadline,
    'status',c.status,'drive_upload_url',c.drive_upload_url,'drive_enabled',c.drive_enabled,
    'results_announced',c.results_announced,
    'announcements',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'subject',a.subject,'body',a.body,'created_at',a.created_at) order by a.created_at desc)
      from public.competition_announcements a where a.competition_id=c.id and exists(
        select 1 from public.email_delivery_logs l where l.announcement_id=a.id and l.status in ('sent','delivered'))), '[]'::jsonb),
    'winners',coalesce((select jsonb_agg(jsonb_build_object('position',w.placement,'name',coalesce(p.team,p.name),'project',p.project) order by w.placement)
      from public.competition_winners w join public.competition_registrations r on r.id=w.registration_id
      left join public.participants p on p.user_id=r.user_id and p.competition_id=r.competition_id
      where w.competition_id=c.id and w.announced_at is not null), '[]'::jsonb)
  ) into result from public.competitions c where c.id=p_competition_id;
  if result is null then raise exception 'Competition not found'; end if;
  return result;
end;
$$;
revoke all on function public.authorized_competition_details(uuid) from public;
grant execute on function public.authorized_competition_details(uuid) to authenticated;
grant select on public.competition_announcements to authenticated;
drop policy if exists "registered participant read competition files" on storage.objects;
create policy "registered participant read competition files" on storage.objects for select to authenticated
  using (bucket_id='competition-files' and (public.is_competition_admin() or exists(
    select 1 from public.competition_resources r
    where r.storage_path=name and r.enabled and (
      r.visibility='public' or exists(select 1 from public.participants p where p.id=r.participant_id and p.user_id=auth.uid())
      or exists(select 1 from public.competition_registrations cr where cr.competition_id=r.competition_id and cr.user_id=auth.uid())
    )
  )));
drop policy if exists "participant upload competition resource" on storage.objects;
create policy "participant upload competition resource" on storage.objects for insert to authenticated
  with check (bucket_id='competition-files' and (storage.foldername(name))[2]=auth.uid()::text and exists(
    select 1 from public.participants p where p.user_id=auth.uid() and p.competition_id::text=(storage.foldername(name))[1]
      and (p.started_at is null or now()<=p.started_at+make_interval(mins=>(select duration_minutes from public.competition_settings where id=1)))
  ));
drop policy if exists "participant read competition resource file" on storage.objects;
create policy "participant read competition resource file" on storage.objects for select to authenticated
  using (bucket_id='competition-files' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists "participant delete competition resource file" on storage.objects;
create policy "participant delete competition resource file" on storage.objects for delete to authenticated
  using (bucket_id='competition-files' and (storage.foldername(name))[2]=auth.uid()::text and exists(
    select 1 from public.participants p where p.user_id=auth.uid() and p.competition_id::text=(storage.foldername(name))[1]
      and (p.started_at is null or now()<=p.started_at+make_interval(mins=>(select duration_minutes from public.competition_settings where id=1)))
  ));

-- Additions used by the single-competition compatibility UI.
alter table public.participants add column if not exists university_name text not null default 'COMSATS University Islamabad, Vehari Campus';
-- Profile photos were removed from the portal; preserve every other profile field.
-- Keep any old Storage objects intact. Supabase requires deleting them through
-- the Storage API/dashboard, and this migration should never delete user files.
alter table public.participants drop column if exists profile_picture_path;
alter table public.participants add column if not exists winner_status text not null default 'Not Announced' check (winner_status in ('Winner','Runner-up','Participant','Not Announced'));
alter table public.participants add column if not exists api_details text not null default '';
alter table public.participants add column if not exists project_description text not null default '';
alter table public.participants add column if not exists technologies text not null default '';
alter table public.participants add column if not exists competition_id uuid references public.competitions(id) on delete cascade;
drop policy if exists "participant upload profile image" on storage.objects;
drop policy if exists "participant update profile image" on storage.objects;
drop policy if exists "public view profile images" on storage.objects;
drop policy if exists "participant upload own proof" on storage.objects;
create policy "participant upload own proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "participant or admin read proof" on storage.objects;
create policy "participant or admin read proof" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_competition_admin()));

-- After registering the organizer account through Supabase Auth, promote that user's UUID:
-- update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';
