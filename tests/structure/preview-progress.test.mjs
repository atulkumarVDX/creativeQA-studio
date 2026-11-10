import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createPreviewProgressClock } from '../../lib/preview-progress.js';

function fixture(options = {}) {
  let time = 0, active = true, nextId = 0;
  const jobs = new Map(), frames = []; let completions = 0;
  const clock = createPreviewProgressClock({
    now: () => time, requestFrame: fn => { jobs.set(++nextId, fn); return nextId; },
    cancelFrame: id => jobs.delete(id), isActive: () => active,
    onFrame: (fraction, playing) => frames.push({ fraction, playing }),
    onComplete: () => completions++, ...options,
  });
  return { clock, frames, jobs, get completions() { return completions; },
    setActive(value) { active = value; },
    step(ms) { time += ms; const batch = [...jobs.values()]; jobs.clear(); batch.forEach(fn => fn()); },
  };
}

test('image progress uses verified 3000ms gallery default and completes once', () => {
  const f = fixture(); f.clock.start(); f.step(1500);
  assert.equal(f.frames.at(-1).fraction, .5);
  f.step(1500); assert.equal(f.frames.at(-1).fraction, 1); assert.equal(f.completions, 1);
  f.step(3000); assert.equal(f.completions, 1);
});
test('explicit timer duration is honored and playback intent freezes elapsed time', () => {
  const f = fixture({ duration: 8000 }); f.clock.start(); f.step(2000); f.clock.toggle();
  f.step(10000); assert.equal(f.frames.at(-1).fraction, .25); assert.equal(f.frames.at(-1).playing, false);
  f.clock.toggle(); f.step(2000); assert.equal(f.frames.at(-1).fraction, .5);
});
test('inactive app/browser time is excluded and clock snapshots survive remounting', () => {
  const f = fixture(); f.clock.start(); f.step(1000); f.setActive(false); f.step(5000);
  const state = f.clock.snapshot(); assert.equal(state.elapsed, 1000);
  f.clock.dispose(); assert.equal(f.jobs.size, 0);
  const next = fixture({ state }); next.clock.start(); next.step(2000);
  assert.equal(next.frames.at(-1).fraction, 1);
});
test('video progress follows media time through pause, seeking, buffering and duration changes', () => {
  let video = { currentTime: 10, duration: 40, paused: false, seeking: false, readyState: 4, ended: false };
  const f = fixture({ getVideo: () => video }); f.clock.start();
  assert.equal(f.frames.at(-1).fraction, .25);
  video.paused = true; f.step(10000); assert.equal(f.frames.at(-1).fraction, .25);
  video.currentTime = 30; video.seeking = true; f.step(16); assert.equal(f.frames.at(-1).fraction, .75);
  video.seeking = false; video.readyState = 2; f.step(16); assert.equal(f.frames.at(-1).playing, false);
  video = { ...video, currentTime: 20, duration: 80, paused: false, readyState: 4 };
  f.step(16); assert.equal(f.frames.at(-1).fraction, .25); assert.equal(f.frames.at(-1).playing, true);
  video.currentTime = 80; video.ended = true; f.step(16); assert.equal(f.completions, 1);
});
test('unknown/infinite video duration has no false completion', () => {
  const f = fixture({ getVideo: () => ({ duration: Infinity, currentTime: 50, readyState: 0 }) });
  f.clock.start(); f.step(10000); assert.equal(f.frames.at(-1).fraction, 0); assert.equal(f.completions, 0);
});
test('completion may dispose its clock synchronously during a slide change', () => {
  let clock; let finished = 0;
  const f = fixture({ onComplete: () => { finished++; clock.dispose(); } }); clock = f.clock;
  clock.start(); f.step(3000); assert.equal(finished, 1); assert.equal(f.jobs.size, 0);
});
test('current standalone embeds the tested clock and preserves 7.13.8', () => {
  const html = readFileSync('preview/archive/turbo-preview-7.13.9.html', 'utf8');
  assert(html.includes(readFileSync('lib/preview-progress.js', 'utf8').replace('export function', 'function')));
  assert.match(html, /indicator.left \+ \(indicator.width - renderable.width\) \/ 2/);
  assert.match(html, /indicator.top \+ \(indicator.height - renderable.height\) \/ 2/);
  assert.match(html, /entry !== leader/);
  assert.match(html, /gallery.hotspotMode \|\| selectedCategory === "home"/);
  assert.equal(createHash('sha256').update(readFileSync('preview/archive/turbo-preview-7.13.8.html')).digest('hex'), 'caa3ce1d6f8832b51cb2f5923584cfb3eeecf1b9470cacdc08a72db74b48a977');
});

test('runtime centering uses ring bounds across circles and non-square indicators', async () => {
  const vm = await import('node:vm');
  const html = readFileSync('preview/archive/turbo-preview-7.13.9.html', 'utf8');
  const context = vm.createContext({ window: {}, console: { log() {} } });
  vm.runInContext(html.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1], context);
  const api = context.window.CSM_PREVIEW;
  for (const indicator of [{ left: 22, top: 491, width: 40, height: 40 }, { left: 5, top: 8, width: 60, height: 40 }]) {
    const icon = { left: 38, top: 502, width: 14, height: 18, color: 'white' };
    const aligned = api.centerCircularControlIcon(icon, indicator);
    assert.equal(aligned.left + aligned.width / 2, indicator.left + indicator.width / 2);
    assert.equal(aligned.top + aligned.height / 2, indicator.top + indicator.height / 2);
    assert.equal(aligned.width, icon.width); assert.equal(aligned.height, icon.height);
    assert.equal(aligned.color, icon.color); assert.equal(icon.left, 38);
  }
});
