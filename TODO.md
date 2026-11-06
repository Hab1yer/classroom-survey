# Classroom Survey - implementation status

Updated November 5, 2026. Original supplied checklist: `docs/PROVIDED_TODO.md`. This checklist records this project's actual implementation and verification; the original document's checkmarks were not treated as proof.

## Application

- [x] React, TypeScript, Vite, Tailwind, routing, Supabase, Recharts, QRCode.
- [x] Instructor login/logout, protected routes, explicit instructor allowlist.
- [x] Dashboard, search, status filter, and history with date filter.
- [x] Survey title/description; MC and true/false questions; choice/question reordering.
- [x] Transactional draft creation and editing with database validation.
- [x] Preserve saved survey ID when activation fails; retries update the same survey.
- [x] Save draft changes eligible closed surveys back to Draft.
- [x] Active-survey editing blocked; surveys with responses require duplication.
- [x] Activate, close, archive, duplicate, and delete with confirmation where applicable.
- [x] Single-active-survey constraint and serialized activation.
- [x] Projection view, public URL, downloadable PNG QR, polling response count.
- [x] Anonymous student form, required answers, success/closed/missing/duplicate states.
- [x] Persistent responses and browser-token duplicate protection.
- [x] Results with charts, counts, percentages, refresh, unanswered counts.
- [x] CSV with metadata, timestamps, answers, escaping and formula protection.
- [x] Responsive layouts, loading/error/empty states, labels and visible focus styles.

## Database and deployment

- [x] Free Supabase project and relational tables, keys, indexes and timestamps.
- [x] RLS and explicit grants; anonymous access only through two public RPCs.
- [x] Instructor checks on all management RPCs; submissions validated atomically.
- [x] Public GitHub repository with source and provided specifications.
- [x] Public Vercel deployment and SPA deep-link routing.
- [x] Public build variables configured; private configuration excluded from Git.
- [x] Initial schema installed in the hosted database.
- [x] Verify completion of migration 002 and restore sample after load-test cleanup.

## Verification

- [x] Production instructor login and cross-refresh persistence.
- [x] Create/edit/duplicate/activate and student submission workflow in browsers.
- [x] Student workflow in Chrome and a separate in-app Chromium browser session.
- [x] Mobile viewport at 390 pixels; no horizontal overflow.
- [x] PostgreSQL tests for RLS, unauthorized users, lifecycle and invalid answers.
- [x] Editor regression tests for activation failure, save failure, and closed drafts.
- [x] QR PNG decoded to the production student URL.
- [x] Downloaded CSV parsed and checked against two synthetic browser responses.
- [x] Hosted anonymous reads and management RPC access denied.
- [x] 200 simultaneous API submissions: 200 successes, zero failures.
- [x] Automated tests, strict production build and lint.
- [ ] Physical phone camera scan and device testing by the project owner.
- [ ] Native Excel/LibreOffice visual import check (CSV structure was tested).
- [ ] Independent isolated real-browser review; unavailable in the review environment.

## Submission

- [x] Development summary and AI interaction history.
- [x] Database and results screenshots captured without credentials or student data.
- [x] Setup/deployment instructions and implemented database documentation.
- [x] Verification report and adversarial-review resolution notes.
- [ ] Final source/evidence publication and submission ZIP verification.
- [ ] Add app instructor credentials privately in HuskyCT; never in GitHub.
- [ ] Project owner reviews the report and submits through HuskyCT.

## Outside MVP

Question banks, AI generation, LMS integration, short answers, checkbox/rating/numeric questions, multi-course tenancy, and real-time subscriptions are not implemented. Presentation polling is implemented; it is not a Realtime subscription.
