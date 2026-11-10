# Baseline and freeze — 2026-11-10

## Release candidate

- Confirmed source candidate: `7.15.5`.
- `preview/current-preview.ts` selects `preview/turbo-preview-7.15.5.html` and declares version `7.15.5`.
- The renderer health endpoint in `scripts/ctv-ott-renderer.mjs` still reports `7.12.4`. The selected preview and app pointer report `7.15.5`, so the release identities are not aligned and the deployment builder will reject packaging this tree as 7.15.5.
- The 7.15.5 HTML is present in `preview/` as an untracked file. The supplied latest source path resolves to this project preview file, and its embedded `PREVIEW_BUILD` is 7.15.5.
- No 7.15.5 static-server archive is present in `outputs/`; current archives there are 7.11.16 and 7.12.3.

## Git snapshot before this note was added

- Branch: `bug-fixes`
- HEAD: `5571697` — `gallery behavior: arrows are enabled only for supported gallery types, with consistent keyboard and accessibility behavior. The docs and regression coverage were updated, and the obsolete 7.11.1 distribution ZIP was removed.`
- Tracked modified entries (26):
  `.env.example`, `README.md`, `app/globals.css`, `app/page.tsx`, `components/teaser-preview.tsx`,
  `doc/01-PRD.md`, `doc/02-Technical-Spec.md`, `doc/03-UI-UX-Guidelines.md`, `doc/04-Decisions-Log.md`,
  `doc/05-Docs-Maintenance.md`, `doc/06-Text-Render-Issue-Catalog.md`, `doc/07-Layer-Structure-Rulebook.md`,
  `doc/13-Character-Compatibility-Watchlist.md`, `doc/18-Preview-Build-Inventory.md`,
  `doc/19-Feedback-Debug-Bundle.md`, `doc/20-First-View-Validation.md`, `doc/layer-structure/rules.json`,
  `lib/qa-engine.ts`, `preview/current-preview.ts`, `scripts/ctv-ott-renderer.mjs`,
  `tests/feedback/feedback-flow.test.mjs`, `tests/qa-engine.test.mjs`, `tests/structure/ctv-ott.test.mjs`,
  `tests/structure/current-preview.test.mjs`, `tests/structure/photoshop-text-presentation.test.mjs`,
  `tests/structure/render-tree-fix.test.mjs`.
- Untracked entries (44):
  `Turbo QA Studio Controls.command`, `doc/Turbo_QA_Studio_Account_Migration_Handover.md`,
  `doc/Turbo_QA_Studio_Account_Migration_Handover.md.zip`, `generated_images/`, `lib/preview-media.js`,
  `lib/preview-playback.ts`, `lib/preview-progress.js`, preview HTML builds `7.12.6`, `7.13.0`–`7.13.12`,
  `7.14.0`–`7.14.3`, and `7.15.0`–`7.15.5`, `scripts/structure/embed-media-lifecycle.mjs`,
  `scripts/structure/embed-progress-clock.mjs`, `tests/fixtures/circular-control-geometry.json`,
  and the structure tests `category-gallery`, `circular-control-geometry`, `gallery-playback-controls`,
  `overview-navigation`, `package-limits`, `paragraph-spacing`, `preview-playback`, `preview-progress`,
  `slide-progress-variants`, and `slide-progress`.
- No entries were staged at snapshot time. Nothing was cleaned up, moved, or discarded.

## Samples and deployment

- No VONJO ZIP was found in the project's `sample/creative` or `samples` folders. Add the latest user-supplied VONJO archive to the project samples before package validation.
- Documented static app path: run `npm run build`, publish `dist/`, and serve with the project's static-server/CDN configuration.
- CTV/OTT requires the companion renderer and same-origin `/api/ctv-ott` routing; static files alone do not provide rendering.
- Documented Linux package path: `outputs/turbo-qa-studio-<current-version>-static-server.tar.gz`, extracted under `/srv/turbo-qa-studio/releases/turbo-qa-studio-<current-version>` on the VM. Docker Compose keeps renderer port 4177 on loopback; the approved HTTPS gateway proxies the API routes.
- This confirms the repository's documented path only; no live VM or gateway was accessed.
- The deployment builder derives its package version from `preview/current-preview.ts` and checks the HTML and renderer identities before packaging.

## Environment and freeze

- Observed Node.js: `v20.11.0`; npm: `10.2.4`.
- Project package metadata requires Node.js `>=22.13.0`. Use a compatible Node version before attempting the production build/package.
- Freeze unrelated feature work from this point. Preserve the captured working tree as-is until release decisions and package validation are complete.

## Documentation follow-up

- `README.md` still says the static-server guide packages 7.12.3, while the deployment builder derives the current pointer dynamically.
- `doc/18-Preview-Build-Inventory.md` names 7.15.5 at its header, but its current-version table omits 7.15.5 and later cleanup text still calls 7.11.16 current. Its inventory date is 2026-11-03. Reconcile the stale sections after the baseline is accepted and the release is validated.
