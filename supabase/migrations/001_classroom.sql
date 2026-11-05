-- Single-instructor installation. Only explicitly allowlisted auth users administer it.
revoke create on schema public from public,anon,authenticated;
create table public.instructors (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.instructors enable row level security;
create function public.is_instructor() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from instructors where user_id = auth.uid()) $$;
create table public.surveys (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=2000),
 status text not null default 'draft' check(status in ('draft','active','closed','archived')),
 public_slug text not null unique default replace(gen_random_uuid()::text,'-',''),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_survey on public.surveys ((status)) where status='active';
create table public.questions (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys on delete cascade,
 question_text text not null check(length(trim(question_text)) between 1 and 1000),
 question_type text not null check(question_type in ('multiple_choice','true_false')),
 position integer not null check(position>=0), unique(survey_id,position), unique(id,survey_id)
);
create table public.choices (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions on delete cascade,
 choice_text text not null check(length(trim(choice_text)) between 1 and 500),
 position integer not null check(position>=0), unique(question_id,position), unique(id,question_id)
);
create table public.responses (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.surveys on delete cascade,
 submitted_at timestamptz not null default now(), anonymous_token uuid not null,
 unique(survey_id,anonymous_token), unique(id,survey_id)
);
create table public.answers (
 id uuid primary key default gen_random_uuid(), response_id uuid not null,
 survey_id uuid not null, question_id uuid not null, choice_id uuid not null, text_answer text,
 foreign key(response_id,survey_id) references public.responses(id,survey_id) on delete cascade,
 foreign key(question_id,survey_id) references public.questions(id,survey_id),
 foreign key(choice_id,question_id) references public.choices(id,question_id), unique(response_id,question_id)
);
create index questions_survey on public.questions(survey_id);
create index choices_question on public.choices(question_id);
create index responses_survey on public.responses(survey_id);
create index answers_survey on public.answers(survey_id);
alter table public.surveys enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.responses enable row level security;
alter table public.answers enable row level security;
create policy instructor_read on public.surveys for select to authenticated using(public.is_instructor());
create policy instructor_read on public.questions for select to authenticated using(public.is_instructor());
create policy instructor_read on public.choices for select to authenticated using(public.is_instructor());
create policy instructor_read on public.responses for select to authenticated using(public.is_instructor());
create policy instructor_read on public.answers for select to authenticated using(public.is_instructor());
-- All mutations use transactional RPCs. Anonymous users cannot directly read any table.
revoke all on public.instructors,public.surveys,public.questions,public.choices,public.responses,public.answers from anon,authenticated;
grant select on public.surveys,public.questions,public.choices,public.responses,public.answers to authenticated;

create function public.require_instructor() returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_instructor() then raise exception 'UNAUTHORIZED'; end if; end $$;

create function public.save_survey(p_survey_id uuid, p_title text, p_description text, p_questions jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid; q jsonb; c jsonb; qid uuid; qi integer:=0; ci integer;
begin
 perform require_instructor();
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'INVALID_QUESTIONS'; end if;
 if p_survey_id is null then
  insert into surveys(title,description) values(trim(p_title),coalesce(p_description,'')) returning id into sid;
 else
  select id into sid from surveys where id=p_survey_id for update;
  if sid is null then raise exception 'NOT_FOUND'; end if;
  if (select status from surveys where id=sid)='active' then raise exception 'SURVEY_ACTIVE'; end if;
  if exists(select 1 from responses where survey_id=sid) then raise exception 'HAS_RESPONSES'; end if;
  update surveys set title=trim(p_title),description=coalesce(p_description,''),updated_at=now() where id=sid;
  delete from questions where survey_id=sid;
 end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q->'choices') is distinct from 'array' or jsonb_array_length(q->'choices') not between 2 and 10 then raise exception 'INVALID_CHOICES'; end if;
  if q->>'question_type'='true_false' and (q->'choices' <> '["True","False"]'::jsonb) then raise exception 'INVALID_CHOICES'; end if;
  insert into questions(survey_id,question_text,question_type,position) values(sid,trim(q->>'question_text'),q->>'question_type',qi) returning id into qid;
  ci:=0;
  for c in select value from jsonb_array_elements(q->'choices') loop
   insert into choices(question_id,choice_text,position) values(qid,trim(c#>>'{}'),ci); ci:=ci+1;
  end loop;
  qi:=qi+1;
 end loop;
 return sid;
end $$;

create function public.activate_survey(p_survey_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform require_instructor();
 perform pg_advisory_xact_lock(4095001);
 if not exists(select 1 from surveys where id=p_survey_id and status<>'archived') then raise exception 'NOT_FOUND'; end if;
 if not exists(select 1 from questions where survey_id=p_survey_id) then raise exception 'INVALID_QUESTIONS'; end if;
 update surveys set status='closed',updated_at=now() where status='active' and id<>p_survey_id;
 update surveys set status='active',updated_at=now() where id=p_survey_id;
end $$;
create function public.close_survey(p_survey_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin perform require_instructor(); update surveys set status='closed',updated_at=now() where id=p_survey_id and status='active'; end $$;
create function public.archive_survey(p_survey_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin perform require_instructor(); update surveys set status='archived',updated_at=now() where id=p_survey_id; end $$;
create function public.delete_survey(p_survey_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform require_instructor();
 -- Delete responses first, because answers also reference questions and choices.
 perform 1 from surveys where id=p_survey_id for update;
 delete from responses where survey_id=p_survey_id;
 delete from surveys where id=p_survey_id;
end $$;

create function public.get_public_survey(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s surveys; result jsonb;
begin
 select * into s from surveys where public_slug=p_slug;
 if not found or s.status='draft' then return null; end if;
 if s.status<>'active' then return jsonb_build_object('status','closed'); end if;
 select jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'status',s.status,'questions',
 coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'question_text',q.question_text,'question_type',q.question_type,'position',q.position,'choices',
 (select jsonb_agg(jsonb_build_object('id',c.id,'choice_text',c.choice_text,'position',c.position) order by c.position) from choices c where c.question_id=q.id)) order by q.position) from questions q where q.survey_id=s.id),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.submit_survey_response(p_survey_id uuid,p_anonymous_token uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rid uuid; a jsonb; qid uuid; cid uuid; expected integer;
begin
 -- SHARE locks permit concurrent students, and serialize submissions against close/edit.
 perform 1 from surveys where id=p_survey_id and status='active' for share;
 if not found then raise exception 'SURVEY_NOT_ACTIVE'; end if;
 if p_anonymous_token is null then raise exception 'INVALID_TOKEN'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'INVALID_ANSWERS'; end if;
 select count(*) into expected from questions where survey_id=p_survey_id;
 if jsonb_array_length(p_answers)<>expected then raise exception 'MISSING_REQUIRED_ANSWER'; end if;
 if (select count(distinct value->>'question_id') from jsonb_array_elements(p_answers))<>expected then raise exception 'INVALID_QUESTION'; end if;
 if exists(select 1 from responses where survey_id=p_survey_id and anonymous_token=p_anonymous_token) then raise exception 'DUPLICATE_RESPONSE'; end if;
 insert into responses(survey_id,anonymous_token) values(p_survey_id,p_anonymous_token) returning id into rid;
 for a in select value from jsonb_array_elements(p_answers) loop
  qid:=(a->>'question_id')::uuid; cid:=(a->>'choice_id')::uuid;
  if not exists(select 1 from questions where id=qid and survey_id=p_survey_id) then raise exception 'INVALID_QUESTION'; end if;
  if not exists(select 1 from choices where id=cid and question_id=qid) then raise exception 'INVALID_CHOICE'; end if;
  insert into answers(response_id,survey_id,question_id,choice_id) values(rid,p_survey_id,qid,cid);
 end loop;
 return jsonb_build_object('success',true,'response_id',rid);
exception when unique_violation then raise exception 'DUPLICATE_RESPONSE';
end $$;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_instructor() to authenticated;
grant execute on function public.save_survey(uuid,text,text,jsonb),public.activate_survey(uuid),public.close_survey(uuid),public.archive_survey(uuid),public.delete_survey(uuid) to authenticated;
grant execute on function public.get_public_survey(text),public.submit_survey_response(uuid,uuid,jsonb) to anon,authenticated;
