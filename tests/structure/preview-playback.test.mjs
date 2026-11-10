import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createPreviewMediaLifecycle } from '../../lib/preview-media.js';

class Events {
  listeners = new Map();
  addEventListener(type, fn, options = {}) {
    const items = this.listeners.get(type) || [];
    items.push({ fn, once: options.once }); this.listeners.set(type, items);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.fn !== fn));
  }
  emit(type) {
    for (const item of [...(this.listeners.get(type) || [])]) {
      if (item.once) this.removeEventListener(type, item.fn);
      item.fn({ type, target: this });
    }
  }
}
class Node extends Events {
  constructor(doc) { super(); this.doc = doc; this.style = {}; this.children = []; this.parentElement = null; }
  get isConnected() { return this.isRoot || this.parentElement?.isConnected || false; }
  appendChild(node) { node.remove(); this.children.push(node); node.parentElement = this; return node; }
  remove() { if (this.parentElement) { const p = this.parentElement; p.children = p.children.filter(n => n !== this); this.parentElement = null; } }
  replaceWith(next) { const p = this.parentElement; const i = p.children.indexOf(this); p.children[i] = next; next.parentElement = p; this.parentElement = null; }
  querySelectorAll() { return this.children.filter(node => node instanceof Video); }
}
class Video extends Node {
  paused = true; ended = false; duration = 120; muted = false; defaultMuted = false;
  volume = .8; playbackRate = 1; readyState = 4; source = 'clip.mp4'; _time = 12.5;
  plays = 0;
  get currentTime() { return this._time; }
  set currentTime(time) { this._time = time; this.doc.jobs.push(() => this.emit('seeked')); }
  play() {
    this.plays++;
    if (this.doc.blockAudio && !this.muted) return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    this.paused = false; this.emit('play'); return Promise.resolve();
  }
  pause() { const wasPlaying = !this.paused; this.paused = true; if (wasPlaying) this.emit('pause'); }
  cloneNode() {
    const next = new Video(this.doc); next.source = this.source; next.style = { ...this.style }; next.readyState = 0; next._time = 0; return next;
  }
  load() { this.doc.jobs.push(() => { this.readyState = 4; this.emit('loadedmetadata'); this.emit('loadeddata'); }); }
  removeAttribute(name) { if (name === 'src') this.source = ''; }
}
function fixture() {
  const doc = new Events();
  doc.documentElement = { dataset: {} }; doc.hidden = false; doc.jobs = []; doc.blockAudio = false;
  const view = new Events(); view.document = doc; view.top = view; view.setTimeout = fn => doc.jobs.push(fn);
  doc.defaultView = view; doc.hasFocus = () => doc.focused !== false;
  doc.createElement = () => new Node(doc);
  const root = new Node(doc); root.isRoot = true;
  const lifecycle = createPreviewMediaLifecycle(doc);
  const video = new Video(doc); root.appendChild(video);
  const flush = async () => { while (doc.jobs.length) doc.jobs.shift()(); await Promise.resolve(); await Promise.resolve(); };
  return { doc, view, root, video, lifecycle, flush };
}

test('initial playback attempts sound and browser permission rejection has a usable retry', async () => {
  const f = fixture(); f.doc.blockAudio = true;
  f.lifecycle.activate(f.video);
  await f.flush();
  assert.equal(f.video.muted, false); assert.equal(f.video.paused, true);
  const prompt = f.root.children.find(n => !(n instanceof Video));
  assert.equal(prompt.textContent, 'Play with sound');
  f.doc.blockAudio = false; prompt.emit('click'); await f.flush();
  assert.equal(f.video.paused, false); assert.equal(f.video.muted, false);
  assert.equal(f.root.children.includes(prompt), false);
});

test('creative tab removal pauses media and returning to the same video resumes its saved time', async () => {
  const f = fixture(); f.lifecycle.activate(f.video); await f.flush();
  f.video._time = 27;
  f.lifecycle.deactivateTree(f.root); f.video.remove();
  assert.equal(f.video.paused, true);
  const second = new Video(f.doc); second.source = 'other.mp4'; f.root.appendChild(second); f.lifecycle.activate(second);
  f.lifecycle.deactivateTree(f.root); second.remove();
  f.root.appendChild(f.video); f.lifecycle.activate(f.video); await f.flush();
  assert.equal(f.video.currentTime, 27); assert.equal(f.video.paused, false);
  assert.equal(second.paused, true);
});

test('renderer can activate a cached video before its artboard row is mounted', async () => {
  const f = fixture(); f.lifecycle.activate(f.video); await f.flush();
  f.lifecycle.deactivateTree(f.root); f.video.remove();
  const detachedRow = new Node(f.doc); detachedRow.appendChild(f.video);
  f.lifecycle.activate(f.video);
  assert.equal(f.video.paused, true);
  f.root.appendChild(detachedRow);
  await f.flush();
  assert.equal(f.video.paused, false);
  assert.equal(f.video.currentTime, 12.5);
});

test('workspace changes preserve video identity, time and sound; already-paused videos stay paused', async () => {
  const f = fixture(); f.lifecycle.activate(f.video); await f.flush();
  f.lifecycle.setWorkspaceActive(false); f.lifecycle.setWorkspaceActive(false);
  assert.equal(f.video.paused, true);
  f.lifecycle.setWorkspaceActive(true); await f.flush();
  assert.equal(f.video.paused, false); assert.equal(f.video.currentTime, 12.5);
  assert.equal(f.video.muted, false); assert.equal(f.video.volume, .8);
  f.video.pause(); f.lifecycle.setWorkspaceActive(false); f.lifecycle.setWorkspaceActive(true);
  assert.equal(f.video.paused, true);
});

test('true browser visibility loss pauses and returning recreates the native picture surface at the same time', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush();
  f.doc.hidden = true; f.doc.emit('visibilitychange');
  assert.equal(current.paused, true);
  f.doc.hidden = false; f.doc.emit('visibilitychange'); await f.flush();
  assert.notEqual(current, f.video);
  assert.equal(f.video.paused, true); assert.equal(f.video.isConnected, false);
  assert.equal(current.currentTime, 12.5); assert.equal(current.source, 'clip.mp4');
  assert.equal(current.paused, false); assert.equal(current.muted, false); assert.equal(current.volume, .8);
});

test('browser click-out/focus loss is independent of workspace; returning elsewhere cannot resume hidden media', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush();
  f.doc.focused = false; f.view.emit('blur'); await f.flush();
  assert.equal(current.paused, true);
  f.lifecycle.setWorkspaceActive(false);
  f.doc.focused = true; f.view.emit('focus'); await f.flush();
  assert.equal(current.paused, true);
  f.lifecycle.setWorkspaceActive(true); await f.flush();
  assert.notEqual(current, f.video); assert.equal(current.paused, false);
});

test('focus moving to an iframe or app control does not pause the browser document', async () => {
  const f = fixture(); f.lifecycle.activate(f.video); await f.flush();
  f.doc.focused = true; f.view.emit('blur'); await f.flush();
  assert.equal(f.video.paused, false);
});

test('leaving again during native surface restoration cannot restart background audio', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush();
  f.lifecycle.setBrowserActive(false); f.lifecycle.setBrowserActive(true);
  f.lifecycle.setWorkspaceActive(false); await f.flush();
  assert.equal(current.paused, true);
  f.lifecycle.setWorkspaceActive(true); await f.flush(); assert.equal(current.paused, false);
});

test('late autoplay in a hidden section is paused; resetting a package silences all cached media', async () => {
  const f = fixture(); f.lifecycle.setWorkspaceActive(false); f.lifecycle.activate(f.video);
  await f.video.play(); assert.equal(f.video.paused, true);
  f.lifecycle.setWorkspaceActive(true); await f.flush(); assert.equal(f.video.paused, false);
  f.lifecycle.reset(); assert.equal(f.video.paused, true);
});

test('a manually paused picture is restored on browser return without starting its sound', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush(); current.pause();
  f.lifecycle.setBrowserActive(false); f.lifecycle.setBrowserActive(true); await f.flush();
  assert.notEqual(current, f.video); assert.equal(current.currentTime, 12.5); assert.equal(current.paused, true);
});

test('a video cached on an inactive creative tab also gets a fresh surface after browser return', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush();
  f.lifecycle.deactivateTree(f.root); f.video.remove();
  f.lifecycle.setBrowserActive(false); f.lifecycle.setBrowserActive(true);
  f.root.appendChild(f.video); f.lifecycle.activate(f.video, next => { current = next; });
  await f.flush();
  assert.notEqual(current, f.video); assert.equal(current.currentTime, 12.5); assert.equal(current.paused, false);
});

test('host delegates workspace state to the renderer without a second competing pause listener', () => {
  const source = readFileSync('lib/preview-playback.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const api = {}; new Function('exports', compiled)(api);
  const calls = []; const doc = { documentElement: { dataset: {} } };
  const frame = { contentDocument: doc, contentWindow: { CSM_PREVIEW: { setPlaybackActive: active => calls.push(active) } } };
  api.setPreviewPlaybackActive(frame, false); api.setPreviewPlaybackActive(frame, true);
  assert.deepEqual(calls, [false, true]); assert.equal(doc.documentElement.dataset.tqaWorkspaceActive, 'true');
  assert.doesNotMatch(source, /addEventListener/);
});

test('current standalone embeds the tested lifecycle and caches video by source layer', () => {
  const html = readFileSync('preview/turbo-preview-7.15.3.html', 'utf8');
  const source = readFileSync('lib/preview-media.js', 'utf8').replace('export function', 'function');
  assert.ok(html.includes(source));
  assert.match(html, /let previewVideoAudioEnabled = true/);
  assert.match(html, /cached\.get\(videoKey\)/);
  assert.match(html, /if \(firstUse\) video\.src = resolveAssetUrl/);
  assert.match(html, /P\.pauseMediaInTree\(stageWrap\);\s*stageWrap\.innerHTML = ""/);
  assert.match(html, /pauseMediaInTree\(stageEl\);\s*stageEl\.querySelectorAll/);
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /allow="autoplay"/);
  assert.match(page, /onClick=\{\(\) => setActiveTab\("preview"\)\}><ImageIcon \/> Main Unit/);
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /\.preview-frame, \.analysis-frame \{[^}]*width: 100%;[^}]*height: calc\(100vh - 104px\)/);
});

test('three-slide next wrap preserves sound and manual mute across cached slides', async () => {
  const f = fixture();
  const slides = [f.video, new Video(f.doc), new Video(f.doc)];
  for (let cycle = 0; cycle < 2; cycle++) for (const video of slides) {
    f.lifecycle.deactivateTree(f.root);
    for (const child of [...f.root.children]) child.remove();
    f.root.appendChild(video); f.lifecycle.activate(video); await f.flush();
    assert.equal(video.paused, false); assert.equal(video.muted, false); assert(video.volume > 0);
  }
  f.lifecycle.toggleAudio(slides[2]);
  assert(slides.every(video => video.muted));
  f.lifecycle.deactivateTree(f.root); slides[2].remove();
  f.root.appendChild(slides[0]); f.lifecycle.activate(slides[0]); await f.flush();
  assert.equal(slides[0].muted, true);
  f.lifecycle.sync(); assert.equal(slides[0].muted, true, 'navigation retry must not override mute');
  f.lifecycle.toggleAudio(slides[0]); assert(slides.every(video => !video.muted));
});

test('playback control and sound control remain independent after native surface replacement', async () => {
  const f = fixture(); let current = f.video; const states = [];
  f.lifecycle.activate(current, next => { current = next; });
  f.lifecycle.bindControls(f.video, video => states.push({ paused: video.paused, muted: video.muted }));
  await f.flush(); f.lifecycle.togglePlayback(f.video);
  assert.equal(current.paused, true); assert.equal(current.muted, false);
  f.lifecycle.toggleAudio(f.video); assert.equal(current.paused, true); assert.equal(current.muted, true);
  f.lifecycle.setBrowserActive(false); f.lifecycle.setBrowserActive(true); await f.flush();
  assert.notEqual(current, f.video); assert.equal(current.paused, true);
  f.lifecycle.togglePlayback(f.video); await f.flush();
  assert.equal(current.paused, false); assert.equal(current.muted, true);
  f.lifecycle.toggleAudio(f.video); assert.equal(current.muted, false);
  assert(states.some(state => state.paused && state.muted));
  assert.equal(states.at(-1).paused, false); assert.equal(states.at(-1).muted, false);
});

test('newly visited slides inherit explicit audio choice, even during a pending restoration', async () => {
  const f = fixture(); let current = f.video;
  f.lifecycle.activate(current, next => { current = next; }); await f.flush();
  f.lifecycle.setBrowserActive(false); f.lifecycle.setBrowserActive(true);
  f.lifecycle.setAudioEnabled(false); await f.flush(); assert.equal(current.muted, true);
  const next = new Video(f.doc); f.root.appendChild(next); f.lifecycle.activate(next); await f.flush();
  assert.equal(next.muted, true); assert.equal(next.volume, 0);
});

test('Compare mode forces mute without changing the Preview audio preference', async () => {
  const f = fixture();
  f.lifecycle.activate(f.video); await f.flush();
  assert.equal(f.video.muted, false);
  f.lifecycle.setCompareMuted(true);
  assert.equal(f.video.muted, true); assert.equal(f.video.volume, 0);
  f.lifecycle.setAudioEnabled(true);
  assert.equal(f.video.muted, true, 'Compare cannot enable sound');
  f.lifecycle.setCompareMuted(false);
  assert.equal(f.video.muted, false); assert.equal(f.video.volume, 1);
  f.lifecycle.setAudioEnabled(false);
  f.lifecycle.setCompareMuted(true); f.lifecycle.setCompareMuted(false);
  assert.equal(f.video.muted, true, 'the reviewer mute preference is retained in Preview');
});

test('current renderer applies the Compare mute policy before painting video', () => {
  const html = readFileSync('preview/turbo-preview-7.15.3.html', 'utf8');
  const source = readFileSync('lib/preview-media.js', 'utf8').replace('export function', 'function');
  assert.ok(html.includes(source));
  assert.match(html, /setCompareMuted: muted => previewMedia\(\)\.setCompareMuted\(muted\)/);
  assert.match(html, /P\.setCompareMuted\(compareEnabled\);/);
  assert.match(html, /P\.setCompareMuted\(compareEnabled\);/);
  assert.match(html, /const audible = previewVideoAudioEnabled && !scanStage;/);
});
