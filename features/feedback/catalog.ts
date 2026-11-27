import type { FeedbackCaseStatus, FeedbackType } from "@/features/feedback/create-feedback-bundle";

export type FeedbackTestCase = { id: string; area: string; priority: "High" | "Medium"; name: string; pass: string };

export const FEEDBACK_TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: "visual-mismatch", label: "Visual mismatch" },
  { value: "finding-issue", label: "Finding looks incorrect" },
  { value: "asset-validation", label: "Asset validation issue" },
  { value: "package-loading", label: "Package loading issue" },
  { value: "preview-interaction", label: "Preview interaction issue" },
  { value: "screenshot-export", label: "Screenshot or report issue" },
  { value: "app-ui", label: "App UI issue" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other issue" },
];

export const FEEDBACK_TYPE_AREAS: Partial<Record<FeedbackType, string[]>> = {
  "visual-mismatch": ["Creative rendering"],
  "finding-issue": ["QA findings"],
  "asset-validation": ["Asset validation"],
  "package-loading": ["Creative rendering", "User experience"],
  "preview-interaction": ["Creative rendering", "User experience"],
  "screenshot-export": ["Feedback", "User experience"],
  "app-ui": ["User experience"],
};

export const FEEDBACK_TYPE_LABELS = Object.fromEntries(FEEDBACK_TYPE_OPTIONS.map(option => [option.value, option.label])) as Record<FeedbackType, string>;

export const FEEDBACK_TEST_CASES: FeedbackTestCase[] = [
  { id: "CR-01", area: "Creative rendering", priority: "High", name: "Upload a valid creative package", pass: "The package loads and the expected creative preview is available." },
  { id: "CR-02", area: "Creative rendering", priority: "High", name: "Compare representative text with production", pass: "Fonts, size, weight, line breaks, wrapping, alignment, spacing, and position match, or differences are documented." },
  { id: "CR-03", area: "Creative rendering", priority: "High", name: "Compare images and backgrounds", pass: "Image content, crop, placement, background, and visible treatment match the reference." },
  { id: "CR-04", area: "Creative rendering", priority: "High", name: "Check creative dimensions and scale", pass: "Each reviewed size uses the expected source geometry and is presented according to its supported view mode." },
  { id: "CR-05", area: "Creative rendering", priority: "High", name: "Activate a CTA or button", pass: "The supported action responds as expected for the package and review flow. Record the exact control and destination/state." },
  { id: "CR-06", area: "Creative rendering", priority: "High", name: "Switch tabs and slides", pass: "The correct state appears and navigation follows the creative’s expected behavior." },
  { id: "CR-07", area: "Creative rendering", priority: "High", name: "Exercise galleries, sliders, or carousels", pass: "Supported controls show the correct content and state without getting stuck or showing unrelated slides." },
  { id: "CR-08", area: "Creative rendering", priority: "Medium", name: "Exercise hotspots or popups", pass: "The expected content appears and can be dismissed or navigated as intended." },
  { id: "CR-09", area: "Creative rendering", priority: "Medium", name: "Exercise map or store-locator content", pass: "The map, pins, popups, and supported interactions appear as expected." },
  { id: "CR-10", area: "Creative rendering", priority: "High", name: "Play video and review sound controls", pass: "Video displays and plays; sound, mute/unmute, and play/pause behavior are understandable and usable." },
  { id: "CR-11", area: "Creative rendering", priority: "High", name: "Change creative state while video is playing", pass: "Playback follows the expected pause/resume and saved-state behavior; manually paused video does not unexpectedly resume." },
  { id: "CR-12", area: "Creative rendering", priority: "High", name: "Compare multiple supported creative sizes", pass: "Each selected size renders its own expected content without size/state mix-ups." },
  { id: "QF-01", area: "QA findings", priority: "High", name: "Review findings generated for the package", pass: "Findings relate to the supplied creative and applicable rules." },
  { id: "QF-02", area: "QA findings", priority: "High", name: "Manually verify a reported issue", pass: "The issue is observable or supported by the relevant specification/reference." },
  { id: "QF-03", area: "QA findings", priority: "High", name: "Check for false positives", pass: "Correct content or behavior is not reported as defective without a valid reason." },
  { id: "QF-04", area: "QA findings", priority: "High", name: "Check a known issue against findings", pass: "The known issue is surfaced where the app is expected to detect it; otherwise record the missed issue and its evidence." },
  { id: "QF-05", area: "QA findings", priority: "Medium", name: "Review finding descriptions and locations", pass: "The wording is clear and identifies the affected content or area well enough to investigate." },
  { id: "QF-06", area: "QA findings", priority: "Medium", name: "Review suggested actions", pass: "Any suggested next step is relevant and practical; do not assume a fix suggestion exists for every finding." },
  { id: "QF-07", area: "QA findings", priority: "Medium", name: "Review finding categories", pass: "The category fits the observed issue and helps the reviewer route it." },
  { id: "QF-08", area: "QA findings", priority: "Medium", name: "Review finding severity/priority", pass: "The indicated urgency is proportionate to the impact; note cases where severity is absent or misleading." },
  { id: "QF-09", area: "QA findings", priority: "Medium", name: "Review readability and accessibility of findings", pass: "Text, status cues, keyboard access, and actions are understandable; report barriers without implying the app automatically audits accessibility unless it explicitly says so." },
  { id: "AV-01", area: "Asset validation", priority: "High", name: "Load a package with known-valid assets", pass: "Valid assets pass the applicable checks without misleading warnings." },
  { id: "AV-02", area: "Asset validation", priority: "High", name: "Load a package with a known missing asset", pass: "The missing asset is identified clearly and does not appear as an unexplained blank." },
  { id: "AV-03", area: "Asset validation", priority: "High", name: "Review an asset over an individual size limit", pass: "The limit violation is reported with enough detail to identify the file and rule." },
  { id: "AV-04", area: "Asset validation", priority: "High", name: "Review package video against the creative-wide size rule", pass: "Total video size is checked against the documented limit; documented exemptions are handled as specified." },
  { id: "AV-05", area: "Asset validation", priority: "High", name: "Review a ZIP against the package-size limit", pass: "A package over the applicable limit is flagged with a clear explanation." },
  { id: "AV-06", area: "Asset validation", priority: "High", name: "Review a video within the duration limit", pass: "The video passes the duration check." },
  { id: "AV-07", area: "Asset validation", priority: "High", name: "Review a video exceeding the duration limit", pass: "It is flagged and the applicable escalation guidance is shown." },
  { id: "AV-08", area: "Asset validation", priority: "High", name: "Review first-view validation", pass: "The relevant first-view requirements and limits are evaluated against the applicable specification." },
  { id: "AV-09", area: "Asset validation", priority: "Medium", name: "Review unsupported or invalid image formats", pass: "Unsupported content is identified clearly and handled without an unexplained crash." },
  { id: "AV-10", area: "Asset validation", priority: "Medium", name: "Review an asset with incorrect constrained dimensions", pass: "The issue is flagged when the applicable rule requires it." },
  { id: "AV-11", area: "Asset validation", priority: "High", name: "Review a known broken or incorrect asset reference", pass: "The affected reference/file is identified." },
  { id: "AV-12", area: "Asset validation", priority: "Medium", name: "Review validation messages", pass: "Errors and warnings explain what failed and why in language a reviewer can act on." },
  { id: "AV-13", area: "Asset validation", priority: "High", name: "Load a package with multiple known validation failures", pass: "Applicable failures are reported together without masking one another or adding unsupported claims." },
  { id: "UX-01", area: "User experience", priority: "High", name: "Open the candidate app", pass: "The app loads without an unexplained error and shows the expected build." },
  { id: "UX-02", area: "User experience", priority: "High", name: "Navigate between creative preview and findings", pass: "Reviewers can move between them and understand where they are." },
  { id: "UX-03", area: "User experience", priority: "Medium", name: "Navigate relevant preview sections", pass: "Available sections are discoverable and return paths are clear." },
  { id: "UX-04", area: "User experience", priority: "Medium", name: "Review the findings interface", pass: "Findings are readable, scannable, and understandable without relying on undocumented knowledge." },
  { id: "UX-05", area: "User experience", priority: "Medium", name: "Review pass, warning, and error indicators", pass: "Different states are visually and textually distinguishable." },
  { id: "UX-06", area: "User experience", priority: "High", name: "Use the app during normal interactions", pass: "The interface remains responsive and stable while switching states and sections." },
  { id: "UX-07", area: "User experience", priority: "High", name: "Load a large representative package", pass: "The app remains usable or communicates a clear limit/error instead of failing silently." },
  { id: "UX-08", area: "User experience", priority: "High", name: "Load an invalid package", pass: "The app explains the problem and gives a recoverable path." },
  { id: "UX-09", area: "User experience", priority: "Medium", name: "Review incomplete or unsupported package content", pass: "The app identifies limitations and handles the content gracefully." },
  { id: "UX-10", area: "User experience", priority: "Medium", name: "Assess the end-to-end review workflow", pass: "You can complete the review without unnecessary steps or unclear handoffs; note specific friction." },
  { id: "FB-01", area: "Feedback", priority: "High", name: "Create a clearly labeled test bug report", pass: "The closest feedback type can be selected and the issue can be described." },
  { id: "FB-02", area: "Feedback", priority: "Medium", name: "Create a suggestion for an improvement or capability", pass: "The suggestion is captured through the existing Suggestion type." },
  { id: "FB-03", area: "Feedback", priority: "High", name: "Report an incorrect or missed QA finding", pass: "The finding issue type can be selected and the report can identify the relevant test case and creative state." },
  { id: "FB-04", area: "Feedback", priority: "Medium", name: "Enter a description and reproduction steps", pass: "Text is retained in the downloaded bundle." },
  { id: "FB-05", area: "Feedback", priority: "Medium", name: "Paste a screenshot or attach supporting evidence", pass: "Evidence appears in the form and is included in the bundle with its context." },
  { id: "FB-06", area: "Feedback", priority: "Medium", name: "Check conditional reference validation", pass: "A visual mismatch requires a valid CCRV or Showcase reference; other report types can proceed without one." },
  { id: "FB-07", area: "Feedback", priority: "High", name: "Download and inspect the feedback bundle", pass: "The bundle contains the report, current package/preview context, and selected evidence." },
  { id: "FB-08", area: "Feedback", priority: "High", name: "Follow the displayed submission handoff", pass: "The reviewer can upload the downloaded ZIP to the approved Box File Request page and record the resulting reference." },
];

export const CASE_STATUS_OPTIONS: FeedbackCaseStatus[] = ["Not started", "In progress", "Pass", "Fail", "Needs improvement", "Blocked", "Not applicable"];
