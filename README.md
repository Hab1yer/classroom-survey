# Classroom Survey

A classroom polling app built with React, TypeScript, Vite, Tailwind CSS, Supabase (PostgreSQL + Auth), Recharts, and QRCode. Students answer anonymously; only explicitly authorized instructors can manage surveys or read results.

## Run locally

Use Node.js 24 LTS and npm. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your Supabase URL and **public publishable/anon key**, and run `npm run dev`. Open the URL printed by Vite. Never use a service-role key in a `VITE_` variable.

## Database setup

1. Create a free Supabase project with the Data API enabled. Disable automatic table exposure; the migration grants precisely the permissions needed.
2. Run `supabase/migrations/001_classroom.sql` in Supabase SQL Editor on an empty project. The migration creates five application tables, an instructor allowlist, RLS policies, indexes, constraints, and transactional RPCs. Do not rerun the initial migration against an initialized database.
3. In Authentication → Users, create an instructor with a private password and auto confirmation enabled. For classroom use, disable public signups in Authentication → Sign In / Providers. Even if signups are enabled, new accounts have no instructor permissions.
4. Add the new account to the allowlist using SQL: `insert into public.instructors(user_id) select id from auth.users where email = 'YOUR_INSTRUCTOR_EMAIL';` Verify that exactly the intended user was inserted.
5. Put the project URL and public key in `.env.local` and restart Vite.

The browser never receives a database password or administrative key. Public student access uses `get_public_survey` and `submit_survey_response`; direct anonymous table access is denied. Instructor writes use guarded RPCs, and result reads use RLS.

## Use

Sign in as the instructor → New survey → add questions and choices → Save draft or Save & activate. Activation closes the previous active survey. Present QR opens a projection view with the public link, QR download, and a response counter refreshed every five seconds. Students open `/s/:slug`, answer every question, and submit. Results show charts, numerical counts, percentages, unanswered counts, and CSV export. Dashboard actions include duplication, closing, archiving, and deletion with confirmation.

An active survey cannot be edited. A survey with responses must be duplicated before its questions can change; this preserves historical results. Draft and closed surveys without responses can be edited. Duplicates never copy responses. Browser tokens and a database uniqueness constraint prevent accidental duplicate submissions, but do not identify a person or prevent deliberate submissions from another device.

## Checks

- `npm test`: PostgreSQL integration tests using PGlite, plus aggregation and CSV tests.
- `npm run lint`: TypeScript/React checks.
- `npm run build`: strict type checking and production build.
- `npm audit`: dependency audit. The minimatch override uses a patched release required by the development lint tools.
- `npm run format`: format source and test files.

Tests execute the actual migration and RPCs, including RLS under anonymous, instructor, and unauthorized authenticated roles. See `docs/TEST_REPORT.md` for observed browser and production verification, and limits of those checks.

## Deployment

Vercel: import this GitHub repository, choose Vite, use `npm run build` and output directory `dist`, select Node 24, and add the two variables from `.env.example` to Production and Preview. Make the production site publicly reachable so students can open QR links without hosting accounts. `vercel.json` handles deep links. Public keys are intended for browser use; RLS and RPC grants enforce security.

Cloudflare Pages alternative: import the repository, use the same build command and output directory, configure the two build variables, and set Node 24. `public/_redirects` provides SPA routing. Hosting is separate from the Supabase database.

Changing frontend environment variables requires a rebuild. Set Supabase Auth's site URL to the deployment URL. Password sign-in works without email redirects. If a free Supabase project pauses after inactivity, resume it in the dashboard before demonstrating the app.

## Submission materials

- `SPEC.md`, `docs/API.md`, `docs/UI.md`, `docs/PROVIDED_TODO.md`: original supplied materials. The separate `TODO.md` reports this implementation's actual status.
- `docs/DATABASE.md`: implemented schema and security decisions. The assignment's referenced DATABASE.md was not supplied, so this documents the schema derived from the other materials.
- `docs/DEVELOPMENT_SUMMARY.md`: development report.
- `docs/AI_DEVELOPMENT_HISTORY.md`: account of the AI-assisted workflow.
- `docs/TEST_REPORT.md`: verification evidence and limitations.
- `submission/`: submission instructions and screenshots.

## Architecture

`src/pages` contains the login, dashboard/history, editor, projection, student, and results views. `src/lib` contains typed models, auth state, database access, aggregation, and export helpers. `src/components` contains the protected route and shared shell. PostgreSQL functions own validation and transactional writes. The single-active unique index and activation advisory lock prevent concurrent activations from leaving two surveys active. Shared locks allow simultaneous student submissions while serializing writes against closing or editing a survey.

This is a single-classroom installation, not a multi-tenant service. All allowlisted instructors share that classroom. Short answers, AI generation, LMS integration, and question banks are outside the MVP. Anonymous endpoints have no person-level identity or anti-abuse rate limit; deploy additional controls for uses beyond a trusted classroom. A 200-student capacity target is distinct from measured load testing; see the test report for what was actually measured.

Application source is MIT licensed. Supplied assignment/specification documents remain their original authors' material.
