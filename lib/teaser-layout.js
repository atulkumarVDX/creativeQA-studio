/**
 * Derive the teaser's creative and ISI rectangles from the package's
 * ISI-aware pre-qualifier image. Turbo packages export that image at the
 * exact size of the creative region that remains beside or below the ISI.
 */
export function deriveTeaserGeometry(fullWidth, fullHeight, assetWidth, assetHeight) {
  const width = Math.min(fullWidth, assetWidth || fullWidth);
  const height = Math.min(fullHeight, assetHeight || fullHeight);
  if (width < fullWidth) {
    return {
      creative: { top: 0, left: fullWidth - width, width, height: fullHeight },
      isi: { top: 0, left: 0, width: fullWidth - width, height: fullHeight },
    };
  }
  if (height < fullHeight) {
    return {
      creative: { top: fullHeight - height, left: 0, width: fullWidth, height },
      isi: { top: 0, left: 0, width: fullWidth, height: fullHeight - height },
    };
  }
  return {
    creative: { top: 0, left: 0, width: fullWidth, height: fullHeight },
    isi: null,
  };
}

/**
 * Return the normalized motion for Turbo's three-second mobile instream
 * peek-a-boo. The transition runs once per source-video loop: shrink for one
 * second, hold for one second, then expand for one second.
 */
export function mobileInstreamMotion(currentTime, duration = 15) {
  const safeDuration = Number.isFinite(duration) && duration >= 3 ? duration : 15;
  const safeTime = Number.isFinite(currentTime) && currentTime >= 0
    ? currentTime % safeDuration
    : 0;
  const start = Math.min(Math.max(safeDuration / 3, 3), safeDuration - 3);
  const elapsed = safeTime - start;
  const smooth = value => value * value * (3 - 2 * value);
  let reveal = 0;
  let phase = "video";

  if (elapsed >= 0 && elapsed < 1) {
    reveal = smooth(elapsed);
    phase = "shrink";
  } else if (elapsed >= 1 && elapsed < 2) {
    reveal = 1;
    phase = "reveal";
  } else if (elapsed >= 2 && elapsed < 3) {
    reveal = 1 - smooth(elapsed - 2);
    phase = "expand";
  }

  return {
    phase,
    reveal,
    scale: 1 - reveal * 0.48,
    transitionStart: start,
  };
}
