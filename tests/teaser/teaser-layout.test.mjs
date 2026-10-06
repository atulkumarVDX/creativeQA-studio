import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTeaserGeometry, mobileInstreamMotion } from '../../lib/teaser-layout.js';

test('derives mixed package teaser ISI rectangles from exported pre-qualifier dimensions', () => {
  assert.deepEqual(deriveTeaserGeometry(970, 250, 770, 250), {
    creative: { top: 0, left: 200, width: 770, height: 250 },
    isi: { top: 0, left: 0, width: 200, height: 250 },
  });
  assert.deepEqual(deriveTeaserGeometry(300, 600, 300, 500), {
    creative: { top: 100, left: 0, width: 300, height: 500 },
    isi: { top: 0, left: 0, width: 300, height: 100 },
  });
  assert.deepEqual(deriveTeaserGeometry(300, 250, 301, 167), {
    creative: { top: 83, left: 0, width: 300, height: 167 },
    isi: { top: 0, left: 0, width: 300, height: 83 },
  });
});

test('supports requested 33 percent layouts and packages without teaser ISI', () => {
  assert.deepEqual(deriveTeaserGeometry(970, 250, 650, 250).isi, {
    top: 0, left: 0, width: 320, height: 250,
  });
  assert.deepEqual(deriveTeaserGeometry(300, 250, 300, 167).isi, {
    top: 0, left: 0, width: 300, height: 83,
  });
  assert.equal(deriveTeaserGeometry(320, 50, 320, 50).isi, null);
});

test('models the documented three-second mobile instream peek-a-boo', () => {
  assert.deepEqual(mobileInstreamMotion(4, 15), {
    phase: 'video', reveal: 0, scale: 1, transitionStart: 5,
  });
  assert.equal(mobileInstreamMotion(5.5, 15).phase, 'shrink');
  assert.equal(mobileInstreamMotion(5.5, 15).scale, 0.76);
  assert.deepEqual(mobileInstreamMotion(6.5, 15), {
    phase: 'reveal', reveal: 1, scale: 0.52, transitionStart: 5,
  });
  assert.equal(mobileInstreamMotion(7.5, 15).phase, 'expand');
  assert.equal(mobileInstreamMotion(8, 15).scale, 1);
});
