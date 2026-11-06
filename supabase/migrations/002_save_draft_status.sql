-- Save draft must also return an editable closed survey to Draft.
create or replace function public.save_survey(p_survey_id uuid, p_title text, p_description text, p_questions jsonb) returns uuid
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
  update surveys set title=trim(p_title),description=coalesce(p_description,''),status='draft',updated_at=now() where id=sid;
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
