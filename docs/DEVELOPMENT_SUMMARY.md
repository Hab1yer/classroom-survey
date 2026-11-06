# Classroom Survey Web App - Development Summary

Gavin Pino | CSE 4095 | November 5, 2026

Repository: https://github.com/Hab1yer/classroom-survey

Application: https://classroom-survey.vercel.app

## Specifications and AI-assisted development

The project started from the supplied application specification, API document, UI document, TODO, and assignment instructions. These documents established the instructor/student roles, required question types, survey lifecycle, relational data model, QR presentation, results, and CSV export. The workspace was empty. Although the supplied TODO already contained many checked boxes, those boxes did not establish that this project's implementation existed. The original materials were preserved, and a separate implementation checklist records verified work.

Codex generated the React application, TypeScript models, styling, database migrations, database access functions, automated tests, and documentation. I supplied the assignment and requested thorough implementation and review. I also configured the external accounts and privately entered passwords during Supabase project and instructor-account creation. Public repository visibility and public hosting access were explicitly approved. The separately referenced original DATABASE.md was not attached, so the implemented database document explains the schema derived from the other specifications.

## Architecture and database configuration

The frontend uses React, TypeScript, Vite, Tailwind CSS, React Router, Recharts, and QRCode. Supabase supplies authentication, a hosted PostgreSQL database, and its API. The frontend is hosted on Vercel, which is permitted by the assignment's allowance for another suitable hosting platform. The database remains separately hosted in Supabase. The browser receives only a public project URL and publishable key; administrative credentials are excluded from the repository.

The five main tables are surveys, questions, choices, responses, and answers. UUID primary keys identify records. Foreign keys connect questions to surveys, choices to questions, responses to surveys, and answers to their response, question, and selected choice. Composite constraints ensure an answer cannot reference a choice from another question or a question from another survey. A sixth table explicitly lists permitted instructors. RLS is enabled throughout, and a signed-in account does not receive instructor access unless it is allowlisted.

## How data moves through the application

Instructors sign in through Supabase Auth. Protected React routes provide a convenient interface boundary, while database policies and RPC checks enforce authorization independently of that interface. Survey management writes use PostgreSQL functions. Saving a survey writes its questions and choices in one transaction. Activation serializes competing requests, closes the prior active survey, and activates the target. A partial unique index separately enforces at most one active survey.

Students open a public survey URL by scanning the projected QR code or following the fallback link. The public read function returns active questions and choices without response data. Submission sends the chosen answers and a random browser token to a second RPC. That function checks survey status, required answers, question ownership, choice ownership, and duplicate tokens before atomically inserting a response and its answers. Instructor-only reads retrieve paginated responses for charts and CSV export. Closing or archiving preserves results; changing questions after responses exist requires duplicating the survey.

## Problems, debugging, and review

An adversarial review found that saving a new survey and activating it were separate operations. If saving succeeded but activation failed, retrying originally created another draft. The fix retains the committed survey ID, redirects the failed attempt to that survey's edit URL, and reports that saving succeeded but activation was not confirmed. Regression tests distinguish a save failure from an activation failure and verify that the latter reuses the original ID.

The review also found that Save draft did not change an eligible closed survey's status back to Draft. A follow-up migration corrects that update while preserving the checks that prohibit active editing and changes to surveys with responses. The initial migration is preserved so existing installations can apply the correction separately. Automated database tests exercise the resulting lifecycle.

## Deployment, testing, and lessons

The source was published to GitHub and deployed as a Vite application on Vercel with production environment variables and SPA routing. Browser checks covered instructor login, survey creation/editing, question reordering, anonymous responses, persistence, duplicate feedback, results, and CSV download. The downloaded QR PNG was decoded to confirm its production destination. A 390-pixel viewport check found no horizontal overflow. A separate synthetic survey accepted 200 simultaneous submission requests with no failures; mean request time was 926 ms and p95 was 1,100 ms. This measures API submissions, not 200 physical devices or full browser page-load performance.

The main full-stack lesson illustrated by this work is that interface behavior, authentication, authorization, and database integrity are separate concerns. A disabled button cannot secure a database, and a successful build cannot prove a workflow is correct. Transactions, constraints, access tests, and failure-path regression tests are necessary to support what the interface promises. Hosted configuration and private grader access are also part of delivering a usable application. Physical-device testing and the owner's final review remain distinct from automated checks.
