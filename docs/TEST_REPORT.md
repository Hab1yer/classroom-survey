# Verification report

Date: November 5, 2026. All survey responses used for testing are synthetic.

## Automated checks

`npm test`: 15 tests passed after the adversarial-review fixes. These include nine PostgreSQL integration tests, three editor component regression tests in a DOM emulator, two aggregation/CSV tests, and one test decoding the downloaded production QR image. `npm run lint` and `npm run build` are required before publication. The dependency installation reported zero audit vulnerabilities.

Database tests execute migration 001 followed by migration 002 in PGlite PostgreSQL. They exercise complete relational saves, rollback on invalid choices, one-active-survey enforcement, anonymous denial, unauthorized authenticated-user denial, public survey data, atomic responses, duplicates, foreign questions/choices, lifecycle locks, preserving historical responses, cascading deletion, and instructor result reads. The new lifecycle regression verifies that saving an eligible closed survey persists Draft status.

Editor tests exercise the actual component with its API boundary mocked: a failed activation after saving must retry the same survey ID and expose its durable edit URL; a failed save must not activate anything; an unchanged closed survey must still invoke saving when Save draft is clicked. These are component tests, not complete browser-network tests.

## Hosted and browser evidence

| Check | Observed result |
|---|---|
| Local and production instructor login | Successful with the owner's privately entered credentials |
| Save/edit/reorder/duplicate/activate | Persisted survey graph; copied survey opened as a draft |
| Public student access | Questions available without a student account |
| Required answers | Browser validation blocked an incomplete submission |
| Chrome and separate in-app Chromium session | Both submitted synthetic responses successfully |
| Results | Two responses; MC 1/1/0 with 50/50/0%; true/false 2/0 with 100/0% |
| Refresh persistence | Saved survey and result data remained available |
| Duplicate response feedback | Refresh showed Already submitted |
| Mobile viewport | 390-pixel width, no horizontal overflow |
| CSV | Browser download contained metadata, timestamps and both expected responses; parsed successfully |
| QR | Downloaded PNG decoded to the public production student URL |
| Anonymous table reads | All six application tables returned HTTP 401 |
| Anonymous activation | HTTP 401; no survey mutation |
| Capacity | 200 simultaneous API requests; 200 successes and zero failures |

Capacity timings: mean 926 ms; p95 1,100 ms; maximum 1,120 ms; total elapsed 1,152 ms. Raw measurements are in `submission/evidence/load-test.json`. The test script refuses an unmarked survey and requires an explicit confirmation argument. The load test was not rerun merely to validate the later editor/status fixes.

## Adversarial findings and fixes

1. Activation retry created another draft after the first save succeeded. Fixed by retaining the saved ID and navigating to its edit URL on activation failure. Regression tests verify reuse and distinguish failed saving from failed activation.
2. Save draft left eligible closed surveys Closed. Fixed in migration 002; the initial migration remains unchanged. A PostgreSQL regression verifies the new persisted state.

Security boundaries were preserved: anonymous clients still cannot read response tables or call management RPCs; active surveys and surveys with answers remain protected from editing.

Migration 002 was applied to the hosted database. A live SQL check reported the fix installed, the original sample Active with two retained responses, and the load-test survey Archived with 200 retained responses. Screenshot: `submission/evidence/10-fix-and-restored-sample.jpg`.

## Limits and manual checks

The isolated real-browser reviewer required by the adversarial-review workflow was unavailable. Earlier browser checks and the new DOM component tests are documented separately. No claim is made of a complete security audit or exhaustive accessibility audit. Mobile viewport emulation is not a physical phone test. A physical camera scan and a native spreadsheet application visual import remain owner checks. The 200-request result measures the submission API, not simultaneous full-page loads on classroom Wi-Fi. Synthetic data and screenshot counts document the time they were captured, rather than live counters.
