# Adversarial review - resolved findings

The November 5 review identified two reproducible P2 bugs and an incomplete submission package. The owner then requested fixes. This document records the resolution rather than representing the original findings as still open.

## Activation retry creates another draft

Fixed in `src/pages/Editor.tsx`. The editor retains the ID immediately after a successful save. If the subsequent activation request fails, it opens that survey's edit URL and explicitly says that the survey was saved but activation could not be confirmed. Retrying saves against the retained ID. A failure before saving returns an ID remains a distinct failure path.

Regression coverage exercises the actual Editor component with a mocked API boundary. Assertions verify one original creation, reuse of the same survey ID, a durable edit URL, no activation after a failed save, and saving an unchanged closed survey. The database still rejects edits to an active survey, including one whose activation response was lost.

## Save draft retains Closed status

Fixed in `supabase/migrations/002_save_draft_status.sql`. The migration replaces only the save function; it preserves the initial migration, function signature, authorization guard, and active/answered-survey editing restrictions. Updating an eligible survey now sets `status='draft'` in the same transaction as its content.

A PostgreSQL regression creates, activates, closes and saves an unanswered survey, then asserts its edited title and Draft status. The editor badge reflects the loaded lifecycle status instead of always claiming Draft.

## Submission and demonstration cleanup

The updated TODO, development summary, AI development history, test report, and hand-in guide have been added. Evidence is organized under `submission/evidence/`. The original sample has been restored to Active with its two synthetic responses; the capacity-test survey is Archived with all 200 synthetic responses preserved. A live SQL verification confirms the draft-status fix is installed. Evidence: `10-fix-and-restored-sample.jpg`.

## Verification scope

Tests, lint and production build passed after the code changes. The review used isolated DOM component tests and PostgreSQL tests. The unavailable isolated real-browser review remains a disclosed limitation; it has not been relabeled as completed. Physical-device testing and private grader credentials remain owner hand-in steps, rather than code defects.
