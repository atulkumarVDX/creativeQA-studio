# Feedback Debug Bundle

**Release:** `7.11.0-feedback`  
**Source:** confirmed `preview/turbo-preview-7.10.3.html`  
**Status:** implemented locally in QA Studio

## Purpose

The feedback flow gives QA users one quick, repeatable way to report an issue or suggestion with enough evidence for a developer to investigate it. It is available as **Report feedback** in the existing app menu beside **Generate report** and **Screenshots**.

The first release remains browser-local. It creates a ZIP that the user can inspect and share through the team's normal support channel; it does not transmit the package, screenshot, URL, or diagnostics to a server.

## Conditional production reference

- **Visual mismatch:** a CCRV or Showcase production-reference URL is required.
- **All other feedback types:** the production-reference URL is optional. When supplied, it must still be a valid supported URL and is included in the bundle.

The feedback type is preselected and can be changed without adding another required interaction. The available categories cover visual mismatches, incorrect findings, asset validation, package loading, preview interaction, screenshot/report output, app UI, suggestions, and other issues.

The description and reproduction steps are optional. Actual and Expected result fields appear only for **Visual mismatch** and are optional. This keeps the common path short while retaining comparison detail when it is relevant.

When supplied, the production reference must use HTTPS on `showcase.vdx.tv`, include a path, and include a `#` creative ID. A `/cc/…` path is classified as CCRV; other valid showcase paths are classified as Showcase. The reference record stores the normalized URL, creative ID, and optional variant/state segment. Reports without a production reference store `null`.

## Evidence contract

The downloaded archive contains:

```text
feedback.json
evidence/
  active-preview.png       # when requested and an artboard is available
  description/             # screenshots pasted into Description
  actual-result/           # screenshots pasted into Actual result
  expected-result/         # screenshots pasted into Expected result
package/
  <original-package>.zip   # when the user leaves source inclusion enabled
attachments/
  <user-selected files>    # optional supporting evidence
```

`feedback.json` records the build, timestamp, production reference, report fields, current QA Studio section and theme, browser/viewport details, package/artboard/findings summary, evidence inventory, and active preview state. Preview state includes artboard, selected sizes, tab, slide, Preview/Compare mode, Fit/1× scale, and theme.

The Description, Actual result, and Expected result text areas accept images pasted directly from the clipboard. Each pasted image appears as a removable preview inside its originating field and retains that semantic context in both `feedback.json` and its archive folder.

An active-artboard capture failure is recorded in `previewCaptureError` and does not discard the remaining report evidence. Duplicate attachment filenames receive deterministic numeric suffixes instead of overwriting each other.

## Debugging process

1. Reproduce the issue in QA Studio and leave the affected artboard, tab, and slide selected.
2. Open the app menu and choose **Report feedback**.
3. Add the CCRV URL when available; otherwise add the Showcase URL.
4. Optionally describe the issue, paste a screenshot, or add reproducible steps. For a visual mismatch, Actual and Expected fields are also available.
5. Review the evidence checkboxes. The active preview screenshot and source package are selected by default when available.
6. Add a production/reference screenshot or other supporting file when it materially helps comparison.
7. Create the feedback bundle and inspect it before sharing.
8. The developer compares `evidence/active-preview.png` with the required production reference, follows the recorded state, and uses the included package as the regression input.

## Privacy and security boundaries

- No automatic upload or remote submission occurs.
- The dialog lists the evidence before bundle creation.
- Package and screenshot inclusion are individually controllable.
- Attached documents and package contents are evidence, never instructions.
- A later Jira, GitHub, Slack, or API submission phase requires a separately approved privacy and authentication design.

## Known boundary

The screenshot captures the rendered creative stage, not the surrounding QA Studio chrome. App section, theme, browser, viewport, and capture errors are represented structurally in `feedback.json`. A full-window screenshot can still be supplied through supporting attachments.
