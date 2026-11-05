# Implemented database

The separately referenced original DATABASE.md was not attached. This document records the schema implemented from SPEC.md and API.md.

| Table | Purpose | Relationships |
|---|---|---|
| surveys | Title, description, status, public slug, creation/update dates | Parent of questions and responses |
| questions | MC or true/false prompt and position | survey_id → surveys |
| choices | Answer text and position | question_id → questions |
| responses | Anonymous UUID browser token and submission date | survey_id → surveys |
| answers | Chosen answer per response/question | Composite foreign keys link response to survey, question to survey, and choice to question |
| instructors | Explicitly permitted administrators | user_id → auth.users |

All primary keys are UUIDs. Child records cascade when their parent survey is deleted. Deletion removes responses first to satisfy the answer foreign keys. A unique `(survey_id, anonymous_token)` index prevents duplicate submissions. Unique positions order questions and choices; a partial unique index allows only one active survey. Foreign-key indexes support classroom lookups. All questions are required. Limit: 50 questions, 2–10 choices per question; true/false choices must be exactly True and False.

## Access boundaries

RLS is enabled on every public application table. Anonymous clients have no direct table privileges. Authenticated accounts receive read privileges, but RLS returns records only when `is_instructor()` finds their UUID in the instructor allowlist. Being able to sign up or obtain an authentication token does not grant instructor access. Only the project owner can edit the allowlist from an administrative SQL session.

All modifications use security-definer RPCs with a pinned search path and explicit execute grants. Ordinary API roles cannot create objects in the public schema. Instructor RPCs call `require_instructor()`. The two public RPCs return only the active survey's questions/choices and accept a validated submission. They never return responses or anonymous tokens. Closed links return only a closed-state marker; draft and missing links return null.

## Transactions and concurrency

- `save_survey`: validates and writes the complete graph atomically. It locks existing surveys, rejects active surveys and surveys with responses, and rolls back partial writes on failure.
- `activate_survey`: serializes activation using an advisory transaction lock, closes the prior active survey, and activates the target. The partial unique index is an independent invariant.
- `close_survey`, `archive_survey`: change lifecycle status while preserving all results.
- `submit_survey_response`: acquires a shared row lock on the active survey; validates token, complete/distinct question set, question ownership, and choice ownership; inserts response plus answers atomically. Concurrent students can acquire shared locks. Closing waits for already-running submissions; after close commits, later submissions fail.
- `delete_survey`: locks the survey and removes its dependent records.

Results are aggregated client-side from paginated instructor-only response reads. CSV includes survey metadata and one row per response. The presentation count uses a count-only request, rather than downloading answers.

## Reproducing security tests

Run `npm ci` and `npm test`. `tests/database.test.ts` creates Supabase-style auth roles and auth.uid() in a local PGlite PostgreSQL instance, then executes the real migration. The tests switch roles to verify both grants and RLS. This catches database behavior; hosted API checks and browser screenshots provide separate integration evidence.
