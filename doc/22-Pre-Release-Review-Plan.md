# Turbo QA Studio — Structured Release Review Plan

**Purpose:** repeatable pre-release review of QA Studio and its embedded Turbo Preview Artifact  
**Repository pointer at drafting:** `preview/archive/turbo-preview-7.15.7.html`
**Status:** ready to configure; source and review-package confirmation still required

## 1. Review outcomes

At the end of a review, the team should be able to answer:

1. Does the selected source build load and identify itself consistently?
2. Can reviewers inspect the target creative states and find meaningful rendering, interaction, and asset defects?
3. Are findings understandable and connected to the affected creative state?
4. Can a reviewer report an issue with enough evidence for someone else to reproduce it?
5. Is the candidate ready to release, ready after named fixes, or blocked by missing evidence?

This is a human review plan supported by the existing automated test suite. Passing automation alone does not equal release approval.

## 2. Scope

### In scope

- Source/build identity and package loading.
- Creative rendering across representative artboards, tabs, slides, and responsive states.
- Findings and text QA disclosure.
- Asset validation and package-level limits.
- Navigation, keyboard use, Compare/Single behavior, video, galleries, teaser preview, CTV/OTT, and Assets.
- Existing **Report feedback** experience and the contents of a locally downloaded feedback bundle.
- Release recommendation and traceable reviewer evidence.

### Out of scope unless specifically added to a review cycle

- Replacing the existing feedback flow with a new tracker or submission mechanism.
- Uploading review bundles to Box during review-plan setup.
- Approval of production ad behavior based only on the preview; a production reference is needed for parity claims.
- Broad regression of every historical build. Review the selected candidate and relevant changed behavior.

## 3. People and responsibilities

Assign named people in the Notion review cycle before execution.

| Role | Responsibility |
|---|---|
| Review lead | Confirms scope/source/package, assigns cases, resolves duplicate reports, runs triage, and writes the release recommendation. |
| Creative reviewer | Compares the preview against the supplied creative or production reference and records visual/interaction differences. |
| Functional reviewer | Checks package loading, findings, assets, controls, navigation, responsive behavior, and feedback flow. One person may cover both reviewer roles for a small cycle. |
| Fix owner | Investigates an accepted finding, records the fix/build, and supplies regression evidence. |
| Release approver | Accepts the final recommendation or records a hold and the reason. |

## 4. Entry criteria and review setup

Do not start execution until the review lead records these inputs:

- **Confirmed source:** exact HTML path, build/version, and confirmation date. This historical drafting reference is `preview/archive/turbo-preview-7.15.7.html`; verify the current pointer before release.
- **Candidate app:** deployed/local QA Studio build or commit to review.
- **Creative package:** exact archive/name/version and a stable copy for all reviewers.
- **Reference:** production URL, approved screenshots, or explicitly “no production reference.” Record which claims cannot be checked without it.
- **Coverage selection:** target sizes, tabs, slides, video states, and responsive states. Include changed or high-risk areas and a representative baseline.
- **Environment:** browser/version, operating system, viewport, and any required local renderer/service.
- **People and dates:** review lead, reviewers, fix owners if known, start date, target decision date.
- **Notion location:** review cycle page/database and permissions for the review team.

### Recommended coverage selection

For each review, cover:

1. Every changed feature and its nearest regression path.
2. At least one representative of each relevant creative family and size class.
3. The highest-risk or historically problematic states (for example, legal copy, custom-font text, mobile responsive reflow, and video-bearing states when present).
4. One missing/invalid asset case if asset validation changed or is release-critical.
5. The existing feedback flow at least once, using a disposable test report and local bundle inspection.

If no representative creative or production reference exists, record the gap as **Not tested — missing input** rather than inferring a pass.

## 5. Execution sequence

### Phase A — Lock the review target

1. Confirm the source file and version with the user/review owner.
2. Confirm the runtime pointer and displayed build identity match the source.
3. Record package identity/checksum if available; distribute the same package to all reviewers.
4. Create a Notion Review Cycle and assign cases.

### Phase B — Establish a clean baseline

1. Open QA Studio in the agreed browser and viewport.
2. Load the target package and record load result, warnings, and selected build.
3. Capture the initial Overview/Review summary state.
4. Note whether the package/reference is complete enough to perform the assigned checks.

### Phase C — Review the creative and product flows

Run the cases in section 6. For each case, record status, actual result, evidence, and any linked Finding. Reproduce failures once from a fresh load when practical; do not erase the first observation.

### Phase D — Report findings with the existing flow

1. Reproduce the issue in the relevant state and leave that state selected.
2. Open **Report feedback**.
3. Choose the matching issue category. A CCRV or Showcase reference is required for a visual mismatch; other categories can omit it, but any supplied URL is validated.
4. Add concise reproduction steps and expected/actual behavior. Add screenshots where they help explain the issue.
5. Inspect the automatically selected evidence level and state summary.
6. Select **Download feedback bundle** and inspect the ZIP locally.
7. Add the bundle filename/path and Notion Finding link to the review record. Upload to Box only through the team's separately agreed submission process.

### Phase E — Triage and decide

1. Review lead deduplicates reports and assigns severity and owner.
2. Fix owners link the change/commit and regression evidence to the Finding.
3. Reviewers rerun failed cases on the candidate build and record the retest.
4. Release lead applies the gates in section 8 and records the decision in the Review Cycle.

## 6. Review case catalog

Create one Notion Test Case row per case below. Use **Not applicable** when the package has no corresponding content and include the reason.

| ID | Area | Procedure and checks | Pass condition | Existing code coverage to consult |
|---|---|---|---|---|
| SRC-01 | Source/build identity | Compare confirmed source, `preview/current-preview.ts`, embedded build badge, and candidate app build. | All identities match the confirmed candidate; any intentional host/renderer distinction is documented. | `tests/structure/current-preview.test.mjs` |
| PKG-01 | Package loading | Load the agreed package; inspect load errors, parsing, initial selected state, and package summary. | Package opens without unexplained errors and reports the expected package/state. | `tests/qa-engine.test.mjs` |
| REN-01 | Canvas geometry | Inspect selected artboards at authored geometry; check clipping, scaling, alignment, and visible canvas boundaries. | No unexplained geometry defect; documented presentation exceptions behave as specified. | `tests/structure/fixed-artboard-viewport.test.mjs`, `tests/layout/layout-audit.test.mjs` |
| REN-02 | Text and typography | Inspect key headings, body/legal text, custom-font cases, wrapping, line breaks, blank paragraphs, and text QA markers. | Text is legible and disclosed risks/failures are visible; no unexplained clipping or wrap difference. | `tests/structure/photoshop-text-presentation.test.mjs`, `tests/structure/paragraph-text-bounds.test.mjs`, `tests/structure/paragraph-spacing.test.mjs` |
| REN-03 | Layers, shapes, and controls | Inspect high-risk overlap, shape radii, circular controls, and layer visibility in selected states. | Rendered structure matches the reference within documented preview limits. | `tests/structure/render-tree.test.mjs`, `tests/structure/circular-control-geometry.test.mjs`, `tests/structure/ordinary-shape-radii.test.mjs` |
| REN-04 | Tabs and galleries | Switch supported tabs and gallery slides; use arrows/keyboard where supported; inspect state-specific artwork. | Correct content is shown for each supported state and controls do not imply unsupported behavior. | `tests/structure/gallery-interaction.test.mjs`, `tests/structure/category-gallery.test.mjs`, `tests/structure/gallery-playback-controls.test.mjs` |
| REN-05 | Responsive/mobile | Inspect relevant mobile-instream and mobile-expandable states, including Fit/1× and branch-level reflow where present. | Behavior follows the documented presentation and reflow rules; unrelated branches remain stable. | `tests/structure/mobile-expandable-responsive.test.mjs`, `tests/structure/fixed-artboard-viewport.test.mjs` |
| FIND-01 | Findings discovery | Review Overview/Review summary counts and open findings from their originating routes. | Counts and destinations are understandable and lead to relevant evidence. | `tests/qa-engine.test.mjs`, `tests/structure/overview-navigation.test.mjs` |
| FIND-02 | Text QA disclosure | Check optical-kerning risk and measurement-failure disclosure in canvas and review panel; verify it does not depend on a debug query. | Required visible marker and review control appear for applicable cases. | `tests/structure/photoshop-text-presentation.test.mjs` |
| AST-01 | Missing/invalid assets | Use a package with a known missing or invalid asset, if available; inspect placeholder and filename detail. | Affected asset is clearly identified; missing content is not silently blank. | `tests/feedback/feedback-flow.test.mjs` |
| AST-02 | Package limits | Review ZIP/package size, creative-wide video size and duration rules, including documented exemptions. | Warnings match the documented rule and identify a practical next action. | `tests/structure/package-limits.test.mjs` |
| UX-01 | Navigation and destinations | Navigate Overview, creative destinations, Assets, CTV/OTT when available, and return paths. | Reviewer can reach the relevant surface and return without losing the review context unexpectedly. | `tests/structure/overview-navigation.test.mjs` |
| UX-02 | Compare/Single and audio | Switch modes; verify default mute state, per-size sound selection, and saved selection across mode/surface changes. | Only the intended size is audible in Compare; Single view follows the documented audio behavior. | `tests/structure/preview-playback.test.mjs`, `tests/structure/gallery-playback-controls.test.mjs` |
| UX-03 | Video lifecycle | Switch creative tabs, app sections, browser focus, and back; test auto-pause/resume and manual pause. | Outgoing video pauses; returning behavior and sound state follow the documented lifecycle. | `tests/structure/preview-playback.test.mjs` |
| UX-04 | Teaser preview | Inspect available formats, ordering, centering, horizontal overflow, and generation status. | Available formats are presented as expected; missing formats are omitted cleanly and status remains clear. | `tests/teaser/teaser-layout.test.mjs`, `tests/teaser/teaser-order.test.mjs` |
| FB-01 | Feedback form | Check category-specific fields, reference URL validation, optional description/steps, screenshots, and attachments. | Fields and validation match the selected category and screenshots retain their context. | `tests/feedback/feedback-flow.test.mjs` |
| FB-02 | Feedback evidence bundle | Download a test bundle; inspect `feedback.json`, selected diagnostics/assets, active preview capture, and evidence folders. | Bundle captures the selected state/category with expected evidence; capture failures are reported without discarding other evidence. | `tests/feedback/feedback-flow.test.mjs`, `tests/feedback/box-upload.test.mjs` |

The automated files above are pointers for reviewers and maintainers. Do not mark a manual case passed solely because a test exists or passes.

## 7. Recording results and defects

### Result values

- **Not started** — assigned but untouched.
- **In progress** — reviewer is executing the case.
- **Pass** — all stated checks passed with enough evidence to support the result.
- **Fail** — observed behavior violates the pass condition; create or link a Finding.
- **Needs improvement** — usable, but has a documented usability or quality gap; create/link a Finding if action is needed.
- **Blocked** — cannot execute because of an environment, source, package, or reference dependency; record the blocker/owner.
- **Not applicable** — scenario is absent from this package; state why.

### Finding severity

- **Blocker:** package cannot be reviewed/loaded, critical content is wrong or missing, or the defect invalidates release confidence for the affected use case.
- **High:** major rendering, asset, interaction, or findings defect with no safe workaround for expected reviewers.
- **Medium:** localized defect with a practical workaround; should be fixed or explicitly accepted before release.
- **Low:** cosmetic or minor usability issue that does not undermine review correctness.

Severity is a triage aid; the release lead records the actual release impact and rationale.

### Minimum finding record

Every Finding should include: short title, severity, status, affected build/package, case ID, creative size/tab/slide/state, steps to reproduce, expected result, actual result, evidence, feedback-bundle reference, owner, and retest outcome. Avoid copying a whole feedback bundle into Notion; store the approved bundle in the team's evidence location and link it.

## 8. Release gates and recommendation

### Ready to release

- Source, candidate build, and package identities are confirmed and recorded.
- All required cases have an outcome; there are no unexplained **Blocked** cases hidden as passes.
- No open Blocker or High finding remains.
- Medium findings are fixed or have a named approver and recorded acceptance rationale.
- Feedback flow produced a usable evidence bundle for the test report.
- Fixed findings have a passing retest on the candidate build or a clearly documented exception.

### Hold

Recommend hold when a gate fails, when a critical reference/input is missing for a required parity claim, or when build/source identity is uncertain. List each blocker, owner, next action, and the exact scenario/state to rerun.

### Decision record

The Review Cycle page must end with **Release**, **Release with accepted follow-ups**, or **Hold**, plus approver, date, tested build, remaining risks, and links to open findings.

## 9. Notion workspace structure

Create a parent page named **Turbo QA Studio — Release Reviews**. Add three databases and relate them. This makes progress visible while keeping detailed bug evidence in the existing feedback bundle.

### Database A — Review Cycles

One row per candidate/review round.

| Property | Type | Purpose |
|---|---|---|
| Review | Title | Example: `7.15.7 — November release review` |
| Status | Status | Setup, Ready, In progress, Triage, Retest, Decided |
| Candidate build | Text | Host build and embedded preview version |
| Confirmed source | URL or Text | Exact source path/link and confirmation date |
| Creative package | Text/URL | Package identity and shared location |
| Production reference | URL/Text | Reference or `None — parity not assessed` |
| Review lead | Person | Accountable for cycle and decision |
| Reviewers | People | Assigned reviewers |
| Start / Decision due | Date | Review window |
| Test cases | Relation → Test Cases | Cases included in this cycle |
| Findings | Relation → Findings | Issues found in this cycle |
| Progress | Rollup | Count completed outcomes / total required cases |
| Decision | Select | Release, Release with accepted follow-ups, Hold |
| Decision rationale | Text | Gate summary, accepted risks, and blockers |

### Database B — Test Cases

One row per catalog case, reused across cycles.

| Property | Type | Purpose |
|---|---|---|
| Case | Title | Example: `REN-02 — Text and typography` |
| Case ID | Text | Stable ID from section 6 |
| Area | Select | Source, Package, Rendering, Findings, Assets, UX, Feedback |
| Required | Checkbox | Whether this cycle requires execution |
| Procedure | Page content/Text | Steps and pass condition from the catalog |
| Review Cycle | Relation → Review Cycles | Cycle assignment |
| Assignee | Person | Responsible reviewer |
| Result | Status | Values from section 7 |
| Build / Package | Text | Exact tested inputs |
| Actual result | Text | What happened |
| Evidence | Files/URL | Screenshot or approved evidence location |
| Finding | Relation → Findings | Link when failed/needs improvement |
| Executed at | Date | Review date |
| Retest result | Select | Pending, Pass, Fail, N/A |

Use a Test Case database template with these page headings: **Setup**, **Steps**, **Expected**, **Actual**, **Evidence**, **Finding link**, **Retest**. Put the reusable procedure in the page body; use the database properties for progress and filtering.

### Database C — Findings

One row per distinct defect or follow-up. A feedback report may contain multiple findings; link each to its report/bundle as appropriate.

| Property | Type | Purpose |
|---|---|---|
| Finding | Title | Short, observable statement |
| Finding ID | ID or Text | Stable reference |
| Severity | Select | Blocker, High, Medium, Low |
| Status | Status | New, Triaged, Fixing, Ready for retest, Verified, Accepted, Won't fix |
| Review Cycle | Relation → Review Cycles | Originating cycle |
| Test Case | Relation → Test Cases | Reproducing case |
| Owner | Person | Fix owner |
| Affected build/state | Text | Build, size, tab, slide, mode, viewport |
| Reproduction | Text | Minimal numbered steps |
| Expected / Actual | Text | Difference observed |
| Feedback bundle | URL/Files | Approved evidence location, not duplicate archive contents |
| First seen / Fixed build | Date/Text | Trace and retest context |
| Retest | Select | Pending, Pass, Fail |
| Release impact | Text | Block/hold/accepted rationale |

## 10. Useful Notion views and working rhythm

On the parent page, add linked views:

- **Active cycle:** filter Review Cycles to Status is not Decided.
- **My test cases:** Test Cases filtered to Assignee is me and Result is not Pass/Not applicable.
- **Blocked cases:** Result is Blocked, grouped by Review Cycle.
- **Open high severity:** Findings where Severity is Blocker or High and Status is not Verified/Accepted/Won't fix.
- **Retest queue:** Findings where Status is Ready for retest.
- **Decision history:** Review Cycles grouped by Decision and sorted newest first.

Suggested cadence: reviewers update Test Case rows during execution; the review lead triages findings once daily during active review; owners update Findings as fixes move; the release approver records the decision in the Review Cycle page. Use comments for discussion, but keep final actual/expected results in the database fields so views remain useful.

## 11. Daily progress snapshot

Post or update this compact summary in the active Review Cycle page:

```text
Date:
Build / package:
Cases: __ required | __ passed | __ failed | __ blocked | __ not started
Open findings: __ blocker | __ high | __ medium | __ low
New blockers / missing inputs:
Fixes ready for retest:
Decision risks:
Next owner actions:
```

## 12. Inputs still needed to start this cycle

1. Confirm whether the current runtime pointer is the latest approved source, or provide the newer source file.
2. Identify the creative package and production reference to review (or explicitly state that this is a product-flow review without creative parity checks).
3. Name the review lead/reviewers and the candidate build/environment.
4. Share the Notion workspace/page to use if you want this structure created directly there; no Notion connection is currently available in this session, so this document provides the setup schema and workflow.
