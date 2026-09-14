# Screenshot regression checks

Production source: `preview/turbo-preview-7.8.0.html`. Fixtures contain generated artwork, not client assets. Node tests use the repository's installed Babel parser; no new runtime capture dependency is required. Use the repository's supported Node version (22.13 or newer).

```sh
node --test tests/screenshot/capture.test.mjs
python3 tests/screenshot/create-fixtures.py
node tests/screenshot/create-browser-harness.mjs
```

Serve the repository locally and open `tests/screenshot/browser-harness.html`. Load a fixture with the regular file picker, choose resolution/scope/policy, and start capture. The test-only `#captureTestDiagnostics` output reopens the actual produced ZIP with CRC verification and lists decoded PNG dimensions and sampled pixels. Regenerate the harness after production source changes. Generated ZIPs and harness HTML are ignored by Git.

| Fixture | Expected result |
|---|---|
| complete.zip | Six PNGs across two sizes. Red/green slide states and a blue tab state; includes nested assets and the painter's -2x retry. |
| missing.zip, tolerant | Six PNGs; five complete and one degraded, naming color-8.png. |
| missing.zip, complete-asset | Five PNGs; one failed job with the same missing filename. |
| disclaimer.zip, tolerant | Six degraded PNGs; each reports the shared `$LOC$assets/disclaimerLogo.svg` omission. Valid assets/logo.svg resolves locally. |
| cancel.zip | 300 planned states. Cancel during capture; completed PNGs survive, and every other state is cancelled or skipped. |
| video.zip | Generated when FFmpeg is installed. One 160×120 PNG at the default 2×, with the green frame at 5 seconds from a six-second clip that starts red. Sample approximately [0,254,0,255]; exact channels depend on codec/browser. |

For complete.zip at 2×, dimensions are 160×120 and 856×1244. Selected-size scope in the default focused preview produces three states for 428×622. Retry after the strict missing-image fixture produces one planned state in a separately labeled retry archive.

QA Studio was also checked through its normal parent picker and embedded Preview. The parent and iframe package names agree; Replace package disables during capture and re-enables after cancellation. The twelve automated tests include the iframe readiness/transfer bridge.

Validation here covers generated fixtures in the Codex in-app browser, production-function tests with mocks, TypeScript, and targeted lint. It does not certify all browsers, file:// behavior, proprietary fonts, imported SVG/CSS resource variants, or production-renderer parity. See `doc/08-Screenshot-Capture-Tool.md` for those release gates.
