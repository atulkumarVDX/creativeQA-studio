# Turbo QA Studio

Turbo QA Studio is a complete, browser-only application for validating and reviewing VDX Turbo export packages. The QA dashboard and Turbo Preview 7.8.4 renderer are delivered through one interface and one production build.

## What is included

- Turbo structure and artboard checks
- asset inventory and declared-reference validation
- copy and tab-wide element consistency checks
- typography and production-rendering risk checks
- searchable findings and assets
- the full interactive Turbo Preview renderer
- 2× screenshot capture, a structured PNG ZIP, and an optional CSM review PDF
- downloadable JSON QA reports

ZIP packages are processed locally in the browser. The application has no API, database, upload service, or server-side runtime requirement.

## Local development

Requirements: Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal, then select a Turbo ZIP package.

## Production build

```sh
npm run build
```

The complete static application is generated in `dist/`. The latest preview engine is embedded in the compiled JavaScript; the source files under `preview/` are not published as separate pages.

To test the production build locally:

```sh
npm start
```

## Static hosting

Upload the contents of `dist/` to any static web server or CDN. No rewrite rules, environment variables, Worker runtime, or backend process are required.

Common hosting settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.13` or newer

The build uses relative asset paths, so it works at a domain root or inside a subdirectory.

## Validation

```sh
npm run typecheck
npm test
npm run build
```
