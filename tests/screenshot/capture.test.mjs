import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const html = readFileSync(new URL('../../preview/turbo-preview-7.8.0.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
const ast = parse(script);
const functions = new Map();
function collect(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') functions.set(node.id.name, script.slice(node.start, node.end));
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') collect(value);
  }
}
collect(ast);
const context = vm.createContext({ Blob, Uint8Array, DataView, DOMException, AbortController, setTimeout, clearTimeout, captureLimits: { timeoutMs: 12 } });
vm.runInContext(['auditStatesForEntry', 'capturePathSegment', 'planCapture', 'verifyCapturePng', 'boundedCapture', 'captureVideoTime', 'resolveDisclaimerAsset'].map(name => functions.get(name)).join('\n'), context);
const plain = value => JSON.parse(JSON.stringify(value));
const entry = (name, tabs = {}) => ({ model: { name, width: 80, height: 60, tabOrder: Object.keys(tabs), tabs } });

test('plans only states available within each ad size', () => {
  const jobs = context.planCapture([
    entry('80x60', { tab1: { gallery: { slideOrder: ['slide1', 'slide2'] } }, tab2: {} }),
    entry('160x600'),
  ]);
  assert.deepEqual(plain(jobs.map(job => job.path)), ['80x60/tab1/slide1.png', '80x60/tab1/slide2.png', '80x60/tab2/frame.png', '160x600/frame.png']);
});

test('filename allocation cannot overwrite case or sanitization collisions', () => {
  const jobs = context.planCapture([
    entry('A/B', { 'x/y': { gallery: { slideOrder: ['S/T', 's:t', 'S/T--2'] } }, 'X:Y': {} }),
    entry('a:b'), entry('A-B--2'), entry('..'), entry('CON'),
  ]);
  const paths = jobs.map(job => job.path.toLowerCase());
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every(path => path.split('/').every(segment => !['.', '..'].includes(segment))));
  assert.equal(context.capturePathSegment('CON'), '_CON');
  assert.equal(context.capturePathSegment('a\u0000b'), 'a-b');
  assert.equal(context.capturePathSegment('..'), 'untitled');
});

function fakePng(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  return new Blob([bytes], { type: 'image/png' });
}

test('rejects empty, invalid, or unexpectedly scaled PNG output', async () => {
  await context.verifyCapturePng(fakePng(428, 622), 428, 622);
  await assert.rejects(context.verifyCapturePng(fakePng(375, 622), 428, 622), /dimensions/);
  await assert.rejects(context.verifyCapturePng(new Blob(['not png']), 80, 60), /PNG/);
  await assert.rejects(context.verifyCapturePng(new Blob([]), 80, 60), /empty/);
});

test('bounded waits handle timeout, cancellation, and already-aborted rejected work', async () => {
  const controller = new AbortController();
  await assert.rejects(context.boundedCapture(new Promise(() => {}), controller.signal, 'Render'), { name: 'CaptureTimeoutError' });
  const cancelled = context.boundedCapture(new Promise(() => {}), controller.signal, 'Render');
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  await assert.rejects(context.boundedCapture(Promise.reject(new Error('late failure')), controller.signal, 'Render'), { name: 'AbortError' });
});

function runner({ failAt = -1, abortAt = -1, timeoutAt = -1, degradeAt = -1, budget = 100000, setupFails = false, zipFails = false } = {}) {
  const elements = new Map();
  const element = () => ({ textContent: '', value: '1', disabled: false, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } },
    setAttribute() {}, addEventListener() {}, appendChild() {}, replaceChildren() {}, querySelectorAll() { return []; }, remove() {}, click() {} });
  const document = { documentElement: { dataset: {} }, getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element, body: element() };
  document.getElementById('capturePolicy').value = 'tolerant';
  document.getElementById('captureScope').value = 'all';
  const archives = [];
  class Zip {
    constructor() { this.files = {}; archives.push(this); }
    file(path, data) { this.files[path] = data; }
    async generateAsync() { if (zipFails) throw new Error('ZIP test failure'); return new Blob(['zip']); }
  }
  let frame = 0;
  const errors = [];
  const ctx = vm.createContext({ Blob, Uint8Array, DataView, DOMException, AbortController, setTimeout, clearTimeout, URL, performance,
    document, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, window: { dispatchEvent() {}, htmlToImage: {}, JSZip: Zip, CSM_PREVIEW_BUILD: '7.8.0' }, JSZip: Zip,
    screenshotsBtn: element(), screenshotScaleSelect: document.getElementById('scale'), resetBtn: element(), pkgNameEl: { textContent: 'fixture.zip' },
    allEntries: [entry('80x60')], includedNames: new Set(['80x60']), console: { info() {} }, clearError() {}, showError(message) { errors.push(message); },
    P: { buildArtboardEl(e) { e.stageEl = element(); e.unavailableEl = element(); return element(); }, paintArtboard() {} },
    htmlToImage: { async toBlob() {
      const index = frame++;
      if (index === failAt) throw new Error('render test failure');
      if (index === timeoutAt) { const error = new Error('render timeout'); error.name = 'CaptureTimeoutError'; throw error; }
      if (index === abortAt) vm.runInContext('captureRun.controller.abort()', ctx);
      return fakePng(80, 60);
    } },
  });
  const start = script.indexOf('  const captureLimits =');
  const end = script.indexOf('  function setLoading', start);
  vm.runInContext(functions.get('auditStatesForEntry') + '\n' + script.slice(start, end).replace('maxPngBytes: 128 * 1024 * 1024', 'maxPngBytes: ' + budget), ctx);
  ctx.captureTestBudget = budget;
  ctx.captureTestSetupFails = setupFails;
  ctx.captureTestDegradeAt = degradeAt;
  vm.runInContext(`captureFontCss = async () => { if (captureTestSetupFails) throw new Error('font test failure'); return ''; };
    let testPrepared = 0;
    prepareCaptureStage = async (stage, policy, signal, warnings) => { if (testPrepared++ === captureTestDegradeAt) warnings.push('missing fixture image'); };`, ctx);
  // The isolated harness changes limits; production limits remain frozen.
  return { ctx, archives, errors, run: async () => {
    const jobs = [1, 2, 3].map(index => ({ entry: entry('80x60'), id: '1:' + index, path: `80x60/frame${index}.png`, tab: null, slide: null }));
    await ctx.captureAllScreenshots({ jobs, policy: 'tolerant', scope: 'all' });
    return plain(vm.runInContext('lastCapture.report', ctx));
  } };
}

test('a failed frame advances progress and does not prevent later captures', async () => {
  const run = runner({ failAt: 0 });
  const report = await run.run();
  assert.deepEqual(report.counts, { captured: 2, degraded: 0, failed: 1, cancelled: 0, skipped: 0 });
  assert.equal(report.jobs.length, report.total);
  assert.equal(vm.runInContext('captureRun', run.ctx), null);
  assert.equal(run.ctx.resetBtn.disabled, false);
});

test('degraded captures remain PNG successes and are counted separately', async () => {
  const report = await runner({ degradeAt: 1 }).run();
  assert.equal(report.counts.degraded, 1);
  assert.equal(report.counts.captured, 2);
  assert.equal(report.counts.failed, 0);
});

test('cancelled and timed-out runs account for unattempted jobs', async () => {
  const cancelled = await runner({ abortAt: 1 }).run();
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(cancelled.counts, { captured: 1, degraded: 0, failed: 0, cancelled: 1, skipped: 1 });
  const timed = await runner({ timeoutAt: 0 }).run();
  assert.equal(timed.status, 'timeout');
  assert.equal(timed.counts.skipped, 2);
});

test('font setup failure yields a complete diagnostic manifest', async () => {
  const report = await runner({ setupFails: true }).run();
  assert.equal(report.status, 'setup-failed');
  assert.equal(report.counts.skipped, 3);
  assert.match(report.globalError, /font test failure/);
});

test('ZIP failure restores the upload and capture controls', async () => {
  const run = runner({ zipFails: true });
  await run.run();
  assert.equal(vm.runInContext('captureRun', run.ctx), null);
  assert.equal(run.ctx.resetBtn.disabled, false);
  assert.match(run.errors[0], /ZIP test failure/);
});

test('PNG memory budget stops the run without dropping completed frames', async () => {
  const report = await runner({ budget: 30 }).run();
  assert.equal(report.status, 'memory-limit');
  assert.deepEqual(report.counts, { captured: 1, degraded: 0, failed: 1, cancelled: 0, skipped: 1 });
});

test('iframe bridge answers late readiness pings and creates package events in its own realm', () => {
  const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
  const pageAst = parse(page, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const declaration = pageAst.program.body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === 'bridgeScript'));
  const listeners = new Map(), messages = [], dispatched = [];
  const input = { files: null, dispatchEvent(event) { dispatched.push(event.type); } };
  const frame = vm.createContext({ String, Boolean,
    window: { addEventListener(type, listener) { listeners.set(type, listener); }, parent: { postMessage(message) { messages.push(message); } } },
    document: { documentElement: { dataset: {} }, getElementById() { return input; } },
    File: class { constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; } },
    Event: class { constructor(type) { this.type = type; } },
    DataTransfer: class { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } },
  });
  vm.runInContext(page.slice(declaration.start, declaration.end) + '\nwindow.testBridge = bridgeScript;', frame);
  const bridgeJs = frame.window.testBridge.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
  vm.runInContext(bridgeJs, frame);
  const notify = listeners.get('message');
  assert.equal(messages.length, 1);
  notify({ data: { type: 'tqa:ping', token: 'turbo-qa-preview-7.8.0' } });
  assert.equal(messages.length, 2);
  assert.equal(messages[1].type, 'tqa:preview-ready');
  notify({ data: { type: 'tqa:load-package', token: 'turbo-qa-preview-7.8.0', buffer: new ArrayBuffer(1), name: 'fixture.zip' } });
  assert.deepEqual(dispatched, ['change']);
  assert.equal(input.files[0].name, 'fixture.zip');
  listeners.get('csm:capture-state')({ detail: { busy: true } });
  assert.equal(messages.at(-1).busy, true);
});

test('parent transfers a package without assigning foreign-realm input events', async () => {
  const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('async function loadPreviewFile(');
  const end = page.indexOf('\nfunction SeverityIcon', start);
  const source = page.slice(start, end).replace('frame: HTMLIFrameElement | null, file: File', 'frame, file');
  const transfer = vm.createContext({ BRIDGE_TOKEN: 'turbo-qa-preview-7.8.0' });
  vm.runInContext(source, transfer);
  const messages = [], buffer = new ArrayBuffer(4);
  await transfer.loadPreviewFile({ contentWindow: { postMessage(...args) { messages.push(args); } } }, { name: 'fixture.zip', type: 'application/zip', async arrayBuffer() { return buffer; } });
  assert.equal(messages[0][0].buffer, buffer);
  assert.equal(messages[0][0].token, 'turbo-qa-preview-7.8.0');
  assert.equal(messages[0][2][0], buffer);
});


test('video snapshots select five seconds and stay inside short clips', () => {
  assert.equal(context.captureVideoTime(12), 5);
  assert.equal(context.captureVideoTime(1), 0.999);
  assert.equal(context.captureVideoTime(0.0005), 0);
  assert.throws(() => context.captureVideoTime(Infinity), /duration/);
  assert.throws(() => context.captureVideoTime(0), /duration/);
});

test('disclaimer template paths use exact matches or a unique flattened basename', () => {
  context.URL = URL;
  const assets = new Map([['disclaimerLogo.svg', 'blob:logo'], ['nested/photo.svg', 'blob:photo']]);
  assert.equal(context.resolveDisclaimerAsset('$LOC$assets/disclaimerLogo.svg', '', assets), 'blob:logo');
  assert.equal(context.resolveDisclaimerAsset('photo.svg', 'nested/', assets), 'blob:photo');
  assets.set('other/disclaimerLogo.svg', 'blob:other');
  assert.equal(context.resolveDisclaimerAsset('unknown/disclaimerLogo.svg', '', assets), null);
  assert.equal(context.resolveDisclaimerAsset('$LOC$assets/disclaimerLogo.svg', '', assets), 'blob:logo');
  assert.equal(context.resolveDisclaimerAsset('disclaimerLogo.svg', '', assets), 'blob:logo');
  assert.equal(context.resolveDisclaimerAsset('missing.svg', '', assets), null);
});

test('successful PNGs with asset warnings never enter the failures file', async () => {
  const run = runner({ degradeAt: 1 });
  await run.run();
  assert.ok(!run.archives[0].files['_capture-failures.txt']);
  assert.match(run.archives[0].files['_capture-warnings.txt'], /missing fixture image/);
});
