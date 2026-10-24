# Turbo QA Studio

Turbo QA Studio validates and reviews VDX Turbo export packages. The QA dashboard and current Turbo Preview 7.12.3 run in one interface. Main-unit QA remains browser-based; CTV/OTT video previews and Box feedback submission use a separate local service.

## What is included

- Turbo structure and artboard checks
- asset inventory and declared-reference validation
- copy and tab-wide element consistency checks
- typography and production-rendering risk checks
- searchable findings and assets
- the full interactive Turbo Preview renderer
- 2× screenshot capture, a structured PNG ZIP, and an optional CSM review PDF
- downloadable JSON QA reports
- direct Box feedback submission with contextual CCRV/Showcase validation, active-preview evidence, and an optional source package
- CTV/OTT teaser video previews generated from package assets by the local FFmpeg service

Main-unit ZIP inspection runs in the browser. CTV/OTT previews send the selected package to the local renderer through a same-origin proxy. Feedback ZIPs are prepared in memory and sent by that local service to the configured Box folder only after the user chooses **Submit Feedback**. See [Feedback Debug Bundle](doc/19-Feedback-Debug-Bundle.md) for setup and privacy boundaries.

## Local development

Requirements: Node.js 22.13 or newer; FFmpeg/ffprobe on `PATH` for CTV/OTT previews.

```sh
npm ci
npm run dev
```

For direct feedback submission, copy `.env.example` to `.env.local` and provide the Box Client Credentials Grant values and destination folder ID. Never commit `.env.local` or place the client secret in browser code.

Open the local URL shown in the terminal, then select a Turbo ZIP package.

## Production build

```sh
npm run build
```

The app bundle is generated in `dist/`. The latest embedded main-unit preview is compiled into the JavaScript; source files under `preview/` are not published as separate pages. CTV/OTT rendering also needs the companion local renderer and is not provided by static files alone.

`preview/current-preview.ts` is the single app preview pointer. To promote a release, keep its import, version and path aligned with the HTML `PREVIEW_BUILD` and CTV/OTT renderer health build. Superseded files are retained for historical comparison; only the pointer's HTML enters the app bundle. See [Preview Build Inventory](doc/18-Preview-Build-Inventory.md).

To test the production build locally:

```sh
npm start
```

## Static hosting

The main QA app can be hosted from `dist/` on a static web server or CDN. **CTV/OTT rendering will be unavailable** there unless the FFmpeg renderer is deployed alongside it and `/api/ctv-ott` is proxied to that service. The current local `npm start` stack provides this automatically; a CDN-only deployment does not.

Common hosting settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.13` or newer

### Updates and browser caching

Serve HTML with the HTTP response header `Cache-Control: no-store`. Vite gives
changed JavaScript and CSS files new hashed filenames; fetching the latest HTML
ensures browsers discover them on the next page load. An already-open tab needs
a normal reload to use a new release.

`public/.htaccess` is copied to `dist/.htaccess` for Apache hosting. Upload this
hidden file alongside `index.html`. It requires `mod_headers` and permission to
use header directives through `AllowOverride FileInfo` or equivalent hosting
configuration. Nginx and other servers ignore `.htaccess`; configure the HTML
response header in that server or CDN instead. The supplied Nginx example
includes the HTML rule.

Verify the deployed `index.html` response headers in browser Developer Tools
(Network) contain `Cache-Control: no-store`. Existing cached HTML may require a
one-time hard reload until its old cache lifetime expires; purge any CDN cache
when first enabling the rule. Upload assets before replacing `index.html`, and
retain previous hashed assets during release transitions for existing tabs.

The build uses relative asset paths, so the static files work at a domain root or inside a subdirectory. CTV/OTT API calls use `/api/ctv-ott` at the domain root and must be routed there even if the static files live under a subdirectory.

For a single Linux server that serves static files and renders CTV/OTT without requiring software on each viewer's computer, use the [static-server deployment guide](deploy/README.md). It packages the current 7.12.3 build, keeps the local service on server loopback, and routes the browser's same-origin API through authenticated HTTPS.

## Validation

```sh
npm run typecheck
npm test
npm run build
```
