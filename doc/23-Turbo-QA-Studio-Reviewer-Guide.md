# Turbo QA Studio — Reviewer Guide

**Status:** Draft for review  
**Candidate build:** Confirm before circulation; the current repository pointer is 7.15.7  
**Purpose:** Pre-release testing with representative production creative packages

## Why we are testing

We are preparing Turbo QA Studio for broader testing. Please use this review to assess whether it renders and behaves as expected against production creative, reports useful QA findings, validates package assets accurately, and fits naturally into your review workflow.

The goal is to find defects and practical improvements before wider adoption. Please compare against the production creative and applicable specifications whenever those references are available. If a reference or test input is missing, say so rather than guessing.

## What to review

### 1. Creative rendering and production parity

**Goal:** Check that the uploaded package is represented accurately and that supported interactions behave as expected.

- Upload a representative, real production package and confirm it loads.
- Compare text against the production reference: font, size, weight, wrapping, line breaks, alignment, spacing, and position.
- Compare imagery and layout: dimensions, crop, placement, background, and visible content.
- Review each relevant creative size, tab, and gallery slide.
- Try interactive elements present in the creative, such as tabs, CTAs, galleries, sliders, hotspots, maps, or carousels. Check only components included in the package and supported by the preview.
- Review video playback, audio, mute/unmute, play/pause, looping, and behavior when changing creative states, where applicable.
- Check responsive states and supported creative formats.

**Good result:** No unexplained visual or interaction differences from the supplied production reference. Note the exact size and state for any mismatch. The preview is a QA aid; do not assume it replaces checking the production experience in its target environment.

### 2. QA findings

**Goal:** Check whether findings are accurate, understandable, and useful to the reviewer.

- Review the findings shown for the package and verify a sample against the creative and its specifications.
- Note findings that appear incorrect or are difficult to understand.
- Where you know a defect exists, check whether the app surfaces it; record missed issues as well as false positives.
- Check whether the finding is categorized and prioritized sensibly, and whether its explanation points to the relevant creative or asset.
- Review the findings interface for readability, clear status cues, keyboard access, and understandable actions.
- Suggest checks that would make the review more complete or efficient.

**Good result:** Findings are relevant, clear, and actionable. A missing finding can only be assessed when the expected issue is known from a reference, specification, or prior report.

### 3. Asset validation

**Goal:** Check whether package and asset warnings reflect the supplied requirements.

- Check for missing, broken, incorrectly referenced, or unsupported assets.
- Review file-size and total-package limits against the applicable specification.
- Review first-view validation where it applies to the package.
- Check video file size and duration requirements where video is present.
- Where relevant, inspect image dimensions, file formats, and asset integrity.
- Check that pass, warning, and error messages explain the issue clearly.
- If the package contains multiple known issues, check whether each applicable one is surfaced without misleading extra warnings.

**Good result:** Validation matches the applicable requirements, identifies the affected file or condition, and gives enough information to understand the next action.

### 4. User experience and workflow

**Goal:** Decide whether the app helps you complete a creative QA review comfortably and efficiently.

- Open the app and load a package; note confusing steps, delays, or instability.
- Move between the creative preview, findings, asset information, and other relevant preview sections.
- Check whether important issues and validation states are easy to spot and understand.
- Try supported navigation and playback controls, including keyboard operation where available.
- Observe how the app handles large packages, incomplete assets, invalid packages, or unsupported content when those cases are available.
- Note where the app saves time, creates extra work, or leaves you unsure what to do next.

**Good result:** You can get to the creative and its review information, understand the current state, and continue or recover from expected errors without unnecessary friction.

### 5. Feedback and issue reporting

**Goal:** Check that the existing feedback flow can capture a useful report without creating a separate reporting system.

- Use **Report feedback** for a real issue or a clearly labeled test report.
- Choose the closest feedback type. Use **Suggestion** for an improvement or new capability idea.
- Include the relevant test case ID in the description or reproduction steps, for example `CR-05`.
- Describe what you expected and what actually happened. For visual mismatches, include a valid CCRV or Showcase reference; the form requires one for this category.
- Include a screenshot or supporting file when it helps explain the issue.
- Review the evidence summary, download the feedback bundle, and upload the ZIP to the team’s approved Box File Request page using the link shown by the app.

The app records package and preview context in the bundle automatically. The feedback form does not currently have a dedicated Test Case ID field, so include the ID in your description or reproduction steps. Do not send a pass result through feedback; feedback is for issues and suggestions.

**Good result:** The feedback bundle downloads and contains enough information to understand and reproduce the report. Record the resulting bundle name or submission reference with your review notes.

## Suggested review order

1. Load the agreed production package and confirm it opens.
2. Review rendering across the agreed sizes and states.
3. Review QA findings against the production reference and specifications.
4. Review asset validation, including any known invalid or missing-asset examples.
5. Review navigation, playback, responsive behavior, and general workflow.
6. Use the feedback flow for any issue or improvement that needs follow-up.
7. Summarize key defects, validation gaps, usability suggestions, and your overall readiness assessment.

Prioritize changed or high-risk areas, then sample the rest. Use real packages where possible. Include both valid packages and known issue examples when available.

## Test case checklist

Use these IDs when describing observations. Execute the cases that apply to the supplied package and review scope. Mark a case **Not applicable** when its component or content is absent, and explain why. Priority is a review-order guide: **High** cases affect core review confidence; **Medium** cases add useful coverage.

### Creative rendering and production parity

| ID | Priority | Test case | Expected result |
|---|---|---|---|
| CR-01 | High | Upload a valid creative package. | The package loads and the expected creative preview is available. |
| CR-02 | High | Compare representative text with production. | Fonts, size, weight, line breaks, wrapping, alignment, spacing, and position match, or differences are documented. |
| CR-03 | High | Compare images and backgrounds. | Image content, crop, placement, background, and visible treatment match the reference. |
| CR-04 | High | Check creative dimensions and scale. | Each reviewed size uses the expected source geometry and is presented according to its supported view mode. |
| CR-05 | High | Activate a CTA or button. | The supported action responds as expected for the package and review flow. Record the exact control and destination/state. |
| CR-06 | High | Switch tabs and slides. | The correct state appears and navigation follows the creative’s expected behavior. |
| CR-07 | High | Exercise galleries, sliders, or carousels that are present. | Supported controls show the correct content and state without getting stuck or showing unrelated slides. |
| CR-08 | Medium | Exercise hotspots or popups that are present. | The expected content appears and can be dismissed or navigated as intended. |
| CR-09 | Medium | Exercise map or store-locator content that is present. | The map, pins, popups, and supported interactions appear as expected. |
| CR-10 | High | Play video and review sound controls. | Video displays and plays; sound, mute/unmute, and play/pause behavior are understandable and usable. |
| CR-11 | High | Change creative state while video is playing; return to it. | Playback follows the expected pause/resume and saved-state behavior; manually paused video does not unexpectedly resume. |
| CR-12 | High | Compare multiple supported creative sizes. | Each selected size renders its own expected content without size/state mix-ups. |

### QA findings

| ID | Priority | Test case | Expected result |
|---|---|---|---|
| QF-01 | High | Review findings generated for the package. | Findings relate to the supplied creative and applicable rules. |
| QF-02 | High | Manually verify a reported issue. | The issue is observable or supported by the relevant specification/reference. |
| QF-03 | High | Check for false positives. | Correct content or behavior is not reported as defective without a valid reason. |
| QF-04 | High | Check a known issue against findings. | The known issue is surfaced where the app is expected to detect it; otherwise record the missed issue and its evidence. |
| QF-05 | Medium | Review finding descriptions and locations. | The wording is clear and identifies the affected content or area well enough to investigate. |
| QF-06 | Medium | Review suggested actions, if shown. | Any suggested next step is relevant and practical; do not assume a fix suggestion exists for every finding. |
| QF-07 | Medium | Review finding categories. | The category fits the observed issue and helps the reviewer route it. |
| QF-08 | Medium | Review finding severity/priority, if shown. | The indicated urgency is proportionate to the impact; note cases where severity is absent or misleading. |
| QF-09 | Medium | Review readability and accessibility of the findings experience. | Text, status cues, keyboard access, and actions are understandable; report barriers without implying the app automatically audits accessibility unless it explicitly says so. |

### Asset validation

| ID | Priority | Test case | Expected result |
|---|---|---|---|
| AV-01 | High | Load a package with known-valid assets. | Valid assets pass the applicable checks without misleading warnings. |
| AV-02 | High | Load a package with a known missing asset. | The missing asset is identified clearly and does not appear as an unexplained blank. |
| AV-03 | High | Review an asset that exceeds an applicable individual size limit. | The limit violation is reported with enough detail to identify the file and rule. |
| AV-04 | High | Review package video against the creative-wide video-size rule. | Total video size is checked against the documented limit; documented exemptions are handled as specified. |
| AV-05 | High | Review a ZIP against the package-size limit. | A package over the applicable limit is flagged with a clear explanation. |
| AV-06 | High | Review a video within the duration limit. | The video passes the duration check. |
| AV-07 | High | Review a video exceeding the duration limit. | It is flagged and the applicable escalation guidance is shown. |
| AV-08 | High | Review first-view validation for a package where it applies. | The relevant first-view requirements and limits are evaluated against the applicable specification. |
| AV-09 | Medium | Review unsupported or invalid image formats. | Unsupported content is identified clearly and handled without an unexplained crash. |
| AV-10 | Medium | Review an asset with known incorrect dimensions where dimensions are constrained. | The issue is flagged when the applicable rule requires it. |
| AV-11 | High | Review a known broken or incorrect asset reference. | The affected reference/file is identified. |
| AV-12 | Medium | Review validation messages. | Errors and warnings explain what failed and why in language a reviewer can act on. |
| AV-13 | High | Load a package with multiple known validation failures. | Applicable failures are reported together without masking one another or adding unsupported claims. |

### User experience and workflow

| ID | Priority | Test case | Expected result |
|---|---|---|---|
| UX-01 | High | Open the candidate app. | The app loads without an unexplained error and shows the expected build. |
| UX-02 | High | Navigate between the creative preview and findings. | Reviewers can move between them and understand where they are. |
| UX-03 | Medium | Navigate to the relevant preview sections, such as Assets or CTV/OTT when available. | Available sections are discoverable and return paths are clear. |
| UX-04 | Medium | Review the findings interface. | Findings are readable, scannable, and understandable without relying on undocumented knowledge. |
| UX-05 | Medium | Review pass, warning, and error indicators where shown. | Different states are visually and textually distinguishable. |
| UX-06 | High | Use the app during normal interactions. | The interface remains responsive and stable while switching states and sections. |
| UX-07 | High | Load a large representative package. | The app remains usable or communicates a clear limit/error instead of failing silently. |
| UX-08 | High | Load an invalid package if a safe example is available. | The app explains the problem and gives a recoverable path. |
| UX-09 | Medium | Review incomplete or unsupported package content. | The app identifies limitations and handles the content gracefully. |
| UX-10 | Medium | Assess the end-to-end review workflow. | You can complete the review without unnecessary steps or unclear handoffs; note specific friction. |

### Feedback and issue reporting

| ID | Priority | Test case | Expected result |
|---|---|---|---|
| FB-01 | High | Create a clearly labeled test bug report. | The closest feedback type can be selected and the issue can be described. |
| FB-02 | Medium | Create a suggestion for an improvement or new capability. | The suggestion is captured through the existing Suggestion type. |
| FB-03 | High | Report an incorrect or missed QA finding. | The finding issue type can be selected and the report can identify the relevant test case and creative state. |
| FB-04 | Medium | Enter a description and reproduction steps. | Text is retained in the downloaded bundle. |
| FB-05 | Medium | Paste a screenshot or attach supporting evidence. | Evidence appears in the form and is included in the bundle with its context. |
| FB-06 | Medium | Check conditional reference validation. | A visual mismatch requires a valid CCRV or Showcase reference; other report types can proceed without one. |
| FB-07 | High | Download and inspect the feedback bundle. | The bundle contains the report, current package/preview context, and selected evidence. |
| FB-08 | High | Follow the displayed submission handoff. | The reviewer can upload the downloaded ZIP to the approved Box File Request page and record the resulting reference. |

Feedback bundles download locally; a download alone does not register a report with the team. Complete the approved Box handoff for reports that need follow-up. Use a clearly labeled test report for FB-01–FB-08 and follow the review lead’s direction about whether to submit it.

## How to describe an observation

For every issue or suggestion, include as many of these details as apply:

- **Test case ID:** for example `QF-03`.
- **Package and build:** package name/version and the Turbo QA Studio build.
- **Creative state:** size, tab, slide, mode, and viewport, if relevant.
- **Steps:** the shortest repeatable path to the observation.
- **Expected:** what production or the specification says should happen.
- **Actual:** what Turbo QA Studio showed or did.
- **Evidence:** screenshot, recording, production reference, or feedback-bundle name.
- **Type:** bug, incorrect finding, asset validation issue, usability improvement, or new capability suggestion.

Please distinguish a defect from an improvement idea. If expected behavior is unclear or the reference is unavailable, label the observation as a question or unverified concern.

## Review conclusion

At the end of your review, send a short summary with:

1. Overall assessment: **Pass**, **Needs improvement**, or **Fail**.
2. The most important defects, especially anything that could prevent accurate review or release.
3. Any false positives, missed issues, or asset-validation gaps.
4. Usability improvements or new capability suggestions.
5. Areas not reviewed and why (for example, missing package, production reference, or supported component).

Use these ratings for an area or the overall review:

- **Pass:** reviewed and no material issue found.
- **Needs improvement:** usable, but one or more issues should be addressed or explicitly accepted.
- **Fail:** a significant defect prevents reliable review in the tested area.
- **Not tested / Not applicable:** explain the missing input or why the area does not apply.

## Review inputs to confirm before circulation

- Confirm the candidate build and the latest approved source file.
- Provide the production creative package(s) and the corresponding reference(s) or specifications.
- Identify any known issue examples that reviewers should use to assess false positives and missed findings.
- Provide the approved Box File Request link or confirm that reviewers should use the link displayed in the app.

Progress tracking and a shared test-case tracker will be designed separately after this reviewer guide is approved.
