import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const renderer = readFileSync('scripts/ctv-ott-renderer.mjs', 'utf8');
const receive = renderer.slice(renderer.indexOf('async function receivePackage('), renderer.indexOf('\n}', renderer.indexOf('async function receivePackage(')) + 2);

test('renderer upload guard permits 600 MB exactly and rejects the next byte', async () => {
  let writes = 0;
  const context = vm.createContext({ MAX_PACKAGE_BYTES: 600 * 1024 * 1024,
    Buffer: { concat: chunks => chunks }, writeFile: async () => { writes++; } });
  vm.runInContext(receive, context);
  const stream = async function* (size) { yield { length: size }; };
  await context.receivePackage(stream(600 * 1024 * 1024), 'unused');
  assert.equal(writes, 1);
  await assert.rejects(context.receivePackage(stream(600 * 1024 * 1024 + 1), 'unused'), /600 MB/);
  assert.equal(writes, 1);
});

test('renderer validates the aggregate video budget and all video durations before rendering', () => {
  assert.match(renderer, /const MAX_VIDEO_BYTES = 500 \* 1024 \* 1024/);
  const render = renderer.slice(renderer.indexOf('async function renderPackage('), renderer.indexOf('async function renderPackage(') + 2400);
  assert.match(render, /videoSizes\.reduce\(\(sum, file\) => sum \+ file\.size, 0\) > MAX_VIDEO_BYTES/);
  assert.match(render, /for \(const videoFile of videoFiles\)/);
  assert.match(render, /videoDuration > MAX_DURATION/);
  assert.match(render, /Escalate to the AdEx team/);
});
