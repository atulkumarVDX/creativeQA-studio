# Linux deployment package

The release archive is built for the current preview version in `preview/current-preview.ts`. It includes the static `dist/` site, the matching CTV/OTT renderer and preview HTML, the renderer's Box helper, Nginx examples, and a Docker Compose deployment for the renderer. The Docker container needs no Node.js, FFmpeg, ffprobe, or unzip installation on the VM host; those runtime tools are inside the image.

Build the release from the source workspace with Node.js **22.13 or newer**:

```sh
npm run build
node deploy/build-static-server.mjs
```

The archive is written to `outputs/turbo-qa-studio-<current-version>-static-server.tar.gz`. The builder reads the version from `preview/current-preview.ts`, verifies that the renderer and preview HTML match it, and includes both modules imported by the renderer. Do not upload the source workspace, `node_modules`, sample packages, or historical preview files to a public web root.

## Docker renderer on a separate VM

This deployment suits the setup where the static app remains on its existing host and the VM provides only the rendering API. It requires Docker Engine and the Compose plugin on the VM. The app's HTTPS host or its approved gateway must route `/api/ctv-ott/health`, `/api/ctv-ott/render`, and `/api/ctv-ott/feedback/upload` to the VM. The renderer itself listens inside the container, while Compose publishes it only on host loopback at `127.0.0.1:4177`. Do not expose port 4177 directly to the network.

1. Copy the release archive to the VM and extract it to a versioned directory, for example:

   ```sh
   sudo mkdir -p /srv/turbo-qa-studio/releases
   sudo tar -xzf turbo-qa-studio-<current-version>-static-server.tar.gz -C /srv/turbo-qa-studio/releases
   cd /srv/turbo-qa-studio/releases/turbo-qa-studio-<current-version>
   ```

2. Build and start the renderer using the engineer-approved Docker access:

   ```sh
   sudo install -m 600 /dev/null .env
   sudoedit .env
   ```

   Add the app's exact HTTPS origin, and add Box credentials only if feedback upload should be enabled:

   ```dotenv
   TURBO_APP_ORIGIN=https://creative.exponential.com
   BOX_CLIENT_ID=
   BOX_CLIENT_SECRET=
   BOX_ENTERPRISE_ID=
   BOX_FEEDBACK_FOLDER_ID=
   ```

   Then build and start the container:

   ```sh
   sudo docker compose -f deploy/docker/compose.yaml up -d --build
   sudo docker compose -f deploy/docker/compose.yaml ps
   ```

   The image uses Node.js 22, FFmpeg/ffprobe, and unzip on Debian. The renderer runs as the unprivileged `node` user. Keep `.env` readable only by the administrator and do not commit secrets to the release directory.

3. Verify on the VM:

   ```sh
   curl --fail http://127.0.0.1:4177/health
   sudo docker logs --tail=100 turbo-qa-renderer
   ```

   The health response must report the same current version as the release directory. Test CTV and OTT renders through the authenticated HTTPS app endpoint after the gateway route is configured.

4. For a later release, build and extract the new version into a new directory, then run `sudo docker compose -f deploy/docker/compose.yaml up -d --build` from that directory. Keep the prior release directory for rollback; use its Compose file to rebuild/restart that version if needed.

The renderer accepts packages up to 1 GiB and source videos up to 270 seconds. The Nginx example allows two concurrent renders and uses a 20-minute upstream timeout. The renderer buffers each package in memory, so retain bounded concurrency and load-test before increasing it. Ensure the VM has sufficient free disk for Docker images, temporary render files, and proxy request buffering. The application cleans temporary render files after completion or failure; include an operational check for leftovers after interrupted processes.

## Nginx example

`nginx/turbo-qa-site.conf` is an example for a VM that also serves the static site. If the static site remains on another host, do not copy that site's `root`/`try_files` setup to the renderer VM. Instead, configure the existing HTTPS host or company gateway to proxy the three API routes above to the VM's private HTTPS endpoint. Preserve authentication, the 1 GiB request limit, bounded render concurrency, and the 20-minute render timeout. Protect the health endpoint behind the same approved access control.

The existing Nginx examples keep TCP 4177 private, require HTTPS, and show Basic authentication as a placeholder; replace it with the company-approved authentication gateway. The app calls `/api/ctv-ott/...` at the domain root, so that route must work on the app's domain even when static files are served from a subdirectory.

## Non-Docker alternative

For a server where Node.js 22.13+, FFmpeg, ffprobe, and unzip are installed directly on the host, the archive also includes `turbo-qa-renderer.service` and the example Nginx files. Create a dedicated unprivileged `turboqa` account, point `/srv/turbo-qa-studio/current` at the selected release directory, then install and enable the systemd service as described in the service file and Nginx examples.
