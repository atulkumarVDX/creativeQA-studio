# Turbo QA Studio — Account Migration Handover

Prepared: 10 November 2026  
Source account: Account A (ChatGPT Free)  
Destination account: Account B (ChatGPT Go)

## Purpose

Use this document to recreate the working context for Turbo QA Studio in Account B. This is a project handover, not a transfer of account ownership, subscription, or original ChatGPT chat records.

## 1. Project identity and local environment

- Project name: Turbo QA Studio
- Main local folder: `/Users/atul/Documents/Photoshop Automation/Preview Package/turbo-qa-studio`
- Typical local app URL: `http://localhost:5173/`
- Other preview URLs/ports mentioned: `localhost:5174`, `localhost:4174`
- Renderer port conflict previously encountered: `127.0.0.1:4177` (`EADDRINUSE`)
- Node version used for current development: `v22.22.2`
- npm version noted: `10.9.7`
- Node `20.18.1` was insufficient for the Vite version in use; Vite required Node `20.19+` or `22.12+`.
- Vite version noted: `8.0.13`
- Build warning previously observed: large `index.js` chunk, approximately 1,037 kB uncompressed / 294 kB gzip.
- Static deployment URL previously mentioned: `https://creative.exponential.com/creative/atul.kumar/projects/turbo-qa/index.html`

**Important:** These are historical notes. Verify the current repository, package scripts, installed dependencies, build number, and deployment configuration before changing anything.

## 2. Mandatory collaboration and file-access rules

The user is a designer, not a developer. Explain technical work in clear, step-by-step, non-jargon language.

- Work only inside the Turbo QA Studio project folder listed above.
- Do not inspect unrelated folders or files.
- If a file/sample outside the project is needed, ask the user for its exact path or ask them to place it inside the project.
- Do not open Finder or unrelated system locations to search for assets.
- Follow the project's `AGENTS.md` instructions. If it is missing, ask the user to provide or confirm the correct instructions; do not invent its contents.
- Before declaring work complete, run the relevant checks and test the feature in the browser.
- Report exactly what was changed, what was tested, the result, and any remaining limitations.
- Preserve existing PSD/export-driven behaviour. Do not replace source-driven visuals with arbitrary hardcoded representations.
- Explain commands one step at a time when the user needs to run them.

## 3. Product purpose

Turbo QA Studio is a local creative QA and preview application for reviewing advertising creative packages. It reads creative/package assets and configuration, renders previews, and helps designers inspect and validate creatives. The user wants QA interaction and useful production-like preview behaviour, not a complete imitation of every production-system feature.

## 4. Major feature areas and decisions

### A. Creative validation

Earlier first-view validation rules supplied by the user:

- Respect the priority container.
- Teaser logo maximum: 10 KB.
- Primary video maximum: 30 seconds / 2.5 MB for the relevant banner validation rule.
- Poster maximum: 30 KB, JPG/JPEG.
- Updated video encoding guidance removed HD and made optional primary settings.
- Do not load an image through an image container; secondary image should be a child container.
- Heavy custom fonts may use text-image treatment.
- MainUnit first-view assets must be below 500 KB, excluding video and including poster plus teaser logo.
- The user wanted the unnecessary panel “Static first-tab candidates, including hidden and rollover” removed/simplified.
- A dark-mode filter visibility issue was reported: filters visible in light mode but not dark mode.

A separate package-level validation requirement was later specified:

- Maximum total size of all video files included in a creative: **500 MB**.
- Maximum ZIP/package size: **600 MB**.
- Maximum video duration: **4 minutes 30 seconds**.
- Videos longer than 4:30 should be escalated to the AdEx team.
- Existing behaviour at the time: 4:30 duration validation was already implemented for primary and CTV/OTT videos; longer videos produced errors and renderer rejection.
- Gaps identified before implementation: total 500 MB video check missing; ZIP check missing (CTV/OTT allowed up to 1 GB); AdEx escalation wording missing.
- User requested implementation in build **7.15.5**.

**Do not confuse the banner-specific 2.5 MB / 30-second rule with the later package-wide 500 MB total-video rule.** They serve different validation purposes. Verify the current implementation and intended creative type before changing either.

### B. Mapbox / store locator

- User wanted local Mapbox behaviour to match the production Vivarin example.
- Sample package mentioned: `sample/creative/vivarian_map.zip`.
- Configuration details supplied: `zoomLevel: 12`, `maxZoom: 19`, `minZoom: 2`, planned release `2.2`, `zoomControl: false`, `attributionControl: false`, `twoFingersEnabled: true`, pins `stores` / `pin0`.
- Desired popup: only one visible at a time; rounded production-like popup with a pointer/tip at the lower-left, positioned above the pin.
- Hide PSD-origin map artifacts.
- User reported the latest map as fixed after a browser-testing block.

A supplied file named `Mapbox local preview setup.txt` contains a prior operational note: the Library download of `vivarian_map.zip` failed because the download service could not resolve its host. The user was asked to download `vivarian_map.zip` from their Library and place it in:
`/Users/atul/Documents/Photoshop Automation/Preview Package/turbo-qa-studio/tmp/`
Then say “ready” so it can be inspected. This note does not prove that the ZIP has since been copied or integrated. Confirm before relying on it.

### C. Click tracking / pixel tracking

- `export.json` was manually checked by the user and did not contain embedded tracking details at that time.
- User wanted a default outbound click-through URL of `https://www.vdx.tv/` in the QA preview first.
- User wanted destination/tracking details embedded in `export.json` if feasible.
- User expected PSD layer groups named `buttonN` to represent clickable CTA/button areas.
- A patch was confirmed to make qualifying `buttonN` groups clickable.
- A later issue: logo / TRYNGOLZA heading area was not clickable even though the user expected the `buttonN` rule to apply.
- A prior discussion noted that the app did not modify/download an updated `export.json`; production action schema and eligible button roles were unresolved.

Do not claim full production pixel tracking or export.json tracking support unless verified against the current code and an actual exported package.

### D. Video playback and navigation

Expected behaviour specified by the user:

- On load, video should play with sound.
- Switching within the creative pauses playback; returning to the video tab or any tab containing video resumes it.
- Switching app sections from Main Unit to Findings pauses playback; returning to Main Unit resumes it.
- Losing browser-tab focus pauses playback; returning to the app/Main Unit resumes it.
- User later clarified not to leave video paused on return.
- Historical bugs included audio continuing while the video frame disappeared, hidden video with audible sound, and video stopping entirely.
- For RM gallery video controls, user wanted play/pause in the circular control, not a sound icon inside it.
- Mute control(s) should appear over the video at bottom-right, matching the production Signatera tab 2 reference.
- With three video slides, after looping, videos were reported to become muted until the frame was clicked.
- Build 7.13.9 was requested after a pause button alignment issue (not centred in the circular control).

Re-test all these states; historical reports do not establish current behaviour.

### E. Progress indicators

- When PSD contains both circular and progress-bar groups, the user reported that Turbo QA displayed both.
- Desired logic: show `progressBar` / `circularBar` only if enabled in its layer group; the dot rule is overridden in this case.
- User later said this was fixed and asked that the implementation be explained as a proper fix, not a workaround.

### F. Galleries and interactive components

**RM Gallery**
- Production reference: `showcase.vdx.tv/cc/j/0/#oPQbIA` tab 3 and Vonjo tab 2 “About MF”.
- Requested arrows and slide transition; auto transition / circular progress initially out of scope.
- Move/animate only the slide parent wrapper, not the entire artboard.
- Arrows, tabs, logo and safety content remain fixed.
- Mixed slide counts across sizes were an issue; per-size wrapping was later accepted “for now”.
- Historical code issues included `slideKey` / `NO_EXPORT_PREFIX`; a fix was reported with 151 tests passing, typecheck and build succeeding, but mixed-size behaviour later remained incomplete.

**Category Gallery**
- Sample: `sample/basetemplates/template/categoryGallery_Map/auto_template11_v1.psd.zip`
- Production comparison reference: `ccpreview/14126630#...`
- Features discussed: home grid, arrows/autoplay/swipe, category navigation, home button, category previous/next.

**Comparison Slider**
- Sample: `sample/basetemplates/template/comparisonslider/cg_template6_v1.psd.zip`
- Active dot style: 12 × 12 circle, 2 px, `rgb(68, 96, 222)`.

**Hotspot**
- Sample: `sample/basetemplates/template/travel_template5_v1/travel_template5_v1.psd.zip`
- Latest requested behaviour: first hotspot popup open by default.

### G. Other product requirements

- Teaser mobile instream sizing and generated-video target handling were discussed.
- QA artboard order should follow package artboard sequence.
- Docker CTV/OTT documentation, `.env.example`, and a Mac launcher command were discussed.
- User wants QA click tracking, but not a complete production-system mimic.
- Missing fonts were reported while functionality otherwise appeared to work.

## 5. Version history and current-version caution

Versions discussed across the project include 7.12.x, 7.13.6, 7.13.8, 7.13.9, and later validation work targeting 7.15.5. The user corrected an earlier version reference from 7.12.2 to 7.12.3; later 7.12.5 was discussed. A requested 7.13.0 preview file was missing even though the browser path `preview/turbo-preview-7.13.0.html` had been used.

**Latest known requested target:** 7.15.5 for the package/video validation implementation. This is not proof that 7.15.5 is the current checked-in or deployed build. Inspect the repository and ask the user before assuming the active version.

## 6. Working verification checklist

Before each implementation is marked complete:

1. Confirm the project root and read `AGENTS.md`.
2. Check current Git status / existing changes before editing.
3. Confirm the active Node version (`22.22.2` was the known working version).
4. Identify the relevant source files and existing tests.
5. Make the smallest appropriate change; preserve source-driven behaviour.
6. Run the relevant tests and typecheck.
7. Run the production build.
8. Start or use the local preview without creating a port conflict.
9. Browser-test the actual creative and affected interactions.
10. Report results, build/version impact, and remaining limitations.

## 7. Account migration process

### From Account A

1. Sign in to Account A.
2. Open **Settings → Data Controls → Export Data**.
3. Request the export and wait for the download email / notification.
4. Download the ZIP while signed in to Account A.
5. Extract the ZIP.
6. Locate `conversations.json` (large exports may contain numbered conversation JSON files).
7. Keep the original ZIP as an archive. Do not delete Account A or its project.

### Into Account B

1. Sign in to Account B (Go).
2. Create a new Project named **Turbo QA Studio**.
3. Add project instructions based on this handover and the actual repository `AGENTS.md`.
4. Upload this handover document.
5. Upload the relevant Turbo QA Studio conversation export JSON. If it is too large, split it or upload the relevant numbered conversation files separately.
6. Upload essential project documentation and source files, subject to the destination project's file limits.
7. Start a new chat inside the new Project and ask ChatGPT to index the handover and conversation archive, identify decisions and unresolved items, and use the archive as historical reference.

### Important limitations

OpenAI's export-and-upload process makes the old conversations available as reference in a new chat. It does not recreate each original chat, restore the original sidebar, merge accounts, or automatically transfer settings, memories, subscriptions, Projects, or all project files. Keep Account A available as the source archive.

Go projects currently allow more uploaded files per project than Free projects according to the Projects help page, but verify the live limit shown in Account B.

## 8. What is still needed for a genuinely complete handover

- Account A's `conversations.json` export, or the relevant split conversation JSON files.
- The current project repository/source folder, ideally as a ZIP or accessible local project.
- The actual `AGENTS.md` and project-specific instructions.
- Current sample creative packages and reference files that are needed for ongoing work.
- Current `.env.example` and setup documentation. Do not upload real `.env` secrets, API tokens, passwords, or credentials into the migration archive.
- Confirmation of the current checked-in and deployed build version.
- Any external service connection setup that Account B must authorize again.

## 9. Starter prompt for the first chat in Account B

I have migrated the Turbo QA Studio project from another ChatGPT account. Treat the uploaded “Turbo QA Studio — Account Migration Handover” as the project continuity brief and the uploaded conversation export as historical source material.

First, read and organize the material. Produce:
1. A chronological project decision log, preserving dates and distinguishing user decisions from assistant suggestions.
2. A feature inventory with current status (implemented / partially implemented / unresolved / needs verification).
3. A list of known bugs and regressions.
4. A list of pending tasks and the latest confirmed build/version.
5. A list of files, samples, credentials, or context still missing.

Do not assume that an old assistant claim means the current code still behaves that way. Verify against the current repository before making changes. Follow `AGENTS.md` and all project working constraints in the handover. Work only inside the Turbo QA Studio project folder; ask before accessing any other path. Explain technical steps in designer-friendly language and browser-test before declaring work complete.

## 10. Source note

This handover is compiled from project context and prior discussions available at preparation time. It is not a substitute for the complete Account A export or the current source repository. Where a status is historical or uncertain, it is explicitly marked for verification.
