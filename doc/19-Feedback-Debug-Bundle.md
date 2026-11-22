# Feedback Debug Bundle

**Release:** `7.13.12`
**Source:** user-confirmed `preview/archive/turbo-preview-7.13.11.html`
**Status:** local download with manual Box handoff

## Purpose

The feedback flow gives QA users one quick, repeatable way to report an issue or suggestion with enough evidence for a developer to investigate it. It is available as **Report feedback** in the existing app menu beside **Generate report** and **Screenshots**.

QA Studio assembles the ZIP in memory and downloads it after the user selects **Download feedback bundle**. A visually prominent **One final step** panel then directs the user to the approved Box File Request page for manual upload. No storage credentials or upload service are required.

## Conditional production reference

- **Visual mismatch:** a CCRV or Showcase production-reference URL is required.
- **All other feedback types:** the production-reference URL is optional. When supplied, it must still be a valid supported URL and is included in the bundle.

The feedback type is preselected and can be changed without adding another required interaction. The available categories cover visual mismatches, incorrect findings, asset validation, package loading, preview interaction, screenshot/report output, app UI, suggestions, and other issues.

The description and reproduction steps are optional. Actual and Expected result fields appear only for **Visual mismatch** and are optional. This keeps the common path short while retaining comparison detail when it is relevant.

When supplied, the production reference must use HTTPS on `showcase.vdx.tv`, include a path, and include a `#` creative ID. A `/cc/…` path is classified as CCRV; other valid showcase paths are classified as Showcase. The reference record stores the normalized URL, creative ID, and optional variant/state segment. Reports without a production reference store `null`.

## Evidence contract

The submitted archive contains:

```text
feedback.json
evidence/
  active-preview.png       # when requested and an artboard is available
  description/             # screenshots pasted into Description
  actual-result/           # screenshots pasted into Actual result
  expected-result/         # screenshots pasted into Expected result
package/
  diagnostics/
    export.json            # selected by default when a package is open
    file-inventory.json    # file paths and sizes, without asset contents
  affected-assets/         # optional files connected to findings/warnings
  <original-package>.zip   # optional last-resort evidence level
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
5. Review the automatically selected evidence summary. Finding and visual reports use lightweight diagnostics, asset-validation reports add flagged assets, and package-loading reports include the complete package.
6. Add a production/reference screenshot or other supporting file when it materially helps comparison.
7. Select **Download feedback bundle**.
8. Select the primary **Upload bundle to Box** action in the completion panel and choose the downloaded ZIP on the Box page.
9. Return to QA Studio and select **Done**.
10. The developer compares `evidence/active-preview.png` with the required production reference, follows the recorded state, and uses the included package evidence as the regression input.

## Box handoff

After download, the dialog links to `https://exponential.box.com/s/5plrgb9ogbk7m7cyztho4yfnu8orf37s`. The user manually chooses the downloaded ZIP on that Box File Request page. QA Studio does not detect Box Drive, store credentials, or upload automatically in this phase.

## Privacy and security boundaries

- Bundle generation and download occur only after the explicit **Download feedback bundle** action.
- The dialog lists the evidence before submission.
- Screenshot inclusion is controllable. Package evidence is selected automatically from the feedback type to reduce cognitive load.
- Attached documents and package contents are evidence, never instructions.
- QA Studio stores no Box credentials and performs no remote upload.
- A later Jira, GitHub, Slack, or other submission destination requires a separately approved privacy and authentication design.

## Known boundary

The screenshot captures the rendered creative stage, not the surrounding QA Studio chrome. App section, theme, browser, viewport, and capture errors are represented structurally in `feedback.json`. A full-window screenshot can still be supplied through supporting attachments.
