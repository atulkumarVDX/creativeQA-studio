# Static-server deployment — Turbo QA Studio 7.11.16

This release uses **one Linux server**. Nginx serves the built `dist/` files and forwards only `/api/ctv-ott/health` and `/api/ctv-ott/render` to the FFmpeg renderer on `127.0.0.1:4177`. Visitors use a browser; they do not install Node or FFmpeg. Static-only hosting without this API cannot generate CTV/OTT previews.

## Build and contents

Use Node.js **22.13 or newer** in the source workspace:

```sh
node deploy/build-static-server.mjs
```

This produces `outputs/turbo-qa-studio-7.11.16-static-server.tar.gz`. It contains `dist/`, the pinned 7.11.16 renderer, the renderer's matching preview HTML, this guide, and example Nginx/systemd configuration. It does **not** change the app version or runtime source. Do not upload the source workspace, `node_modules`, sample packages, or old preview builds to the public web root.

## Server prerequisites

- Linux server with Nginx, Node.js 22.13+, FFmpeg, ffprobe and `/usr/bin/unzip` installed.
- A DNS name and valid TLS certificate. Keep TCP 4177 closed to the network; the renderer binds to loopback.
- A dedicated, unprivileged `turboqa` service account and sufficient temporary disk space for a ZIP, extraction, intermediate frames and output video. The renderer removes its temporary files after the response completes.
- `htpasswd` (often supplied by `apache2-utils`) if using the example's Basic authentication.
- Authentication at Nginx or the company access gateway. The example protects the **whole site**, including the render API, with an htpasswd file; do not publish an unauthenticated renderer. Use HTTPS before entering credentials.

## Install

1. Upload the release archive to the server and extract its `turbo-qa-studio-7.11.16/` directory under `/srv/turbo-qa-studio/releases/`. Set ownership to `turboqa` and point `/srv/turbo-qa-studio/current` at that directory. The only Nginx web root is `/srv/turbo-qa-studio/current/dist`; the renderer script and preview source HTML must **not** be served directly.
2. Copy `turbo-qa-renderer.service` to `/etc/systemd/system/`. If Node is not `/usr/bin/node`, change `ExecStart` to its absolute Node 22 path. Run `sudo systemctl daemon-reload`, `sudo systemctl enable --now turbo-qa-renderer`, then check `curl http://127.0.0.1:4177/health` **on the server**; it must report build `7.11.16`.
3. Put `nginx/turbo-qa-limits.conf` in `/etc/nginx/conf.d/` (HTTP context). Put `nginx/turbo-qa-site.conf` in `/etc/nginx/sites-available/`, replace `__DOMAIN__`, `__CERT_FILE__`, and `__KEY_FILE__`, and enable the site. Run `sudo htpasswd -c /etc/nginx/turbo-qa.htpasswd YOUR_USERNAME` to create the password file, or replace `auth_basic` with an approved company authentication gateway. Run `sudo nginx -t` before reloading Nginx.
4. Open `https://__DOMAIN__/`, upload a supported export ZIP, and render both CTV and OTT. Verify `https://__DOMAIN__/api/ctv-ott/health` returns 7.11.16 **only after authentication**. The video response should come from the same domain; the browser must not contact `localhost` or `127.0.0.1`.

The Nginx render route permits up to a 1 GiB package, allows **two concurrent renders** so mixed CTV+OTT packages can complete, and uses a 20-minute upstream timeout. Additional simultaneous renders receive HTTP 429. This is a conservative guard because the 7.11.16 renderer buffers each full package in memory. Size CPU/RAM/disk for two simultaneous packages and FFmpeg processes, and load-test before widening concurrency. Nginx may also buffer uploads to its client-body temporary directory; provision that disk accordingly.

## Verification and limits

Run `npm run typecheck`, `npm test`, and `npm run build` in the source workspace before release. The 7.11.16 renderer supports 1920×1080 CTV/OTT artboards, a 1 GiB request cap and source videos up to 270 seconds. It uses package creative assets and the FFmpeg motion pipeline documented in `doc/CTV-OTT-Consolidated-Spec.md` in the source workspace.

This configuration assumes QA Studio is served from the **domain root** because the app calls `/api/ctv-ott/...` from the root. If the site must live under a subpath, that API path still needs to be routed at the domain root. This is a deployment example, not a claim that the current renderer is hardened for an untrusted public internet audience; put it behind managed authentication and review resource controls before broad access.
