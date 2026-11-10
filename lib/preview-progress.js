// A clock belongs to one rendered gallery state. Video progress follows the
// decoder; image progress counts only active, unpaused preview time.
export function createPreviewProgressClock(options) {
  const { now, requestFrame, cancelFrame, isActive, getVideo, onFrame, onComplete } = options;
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 3000;
  let elapsed = options.state?.elapsed || 0;
  let paused = options.state?.paused || false;
  let completed = false, disposed = false, stamp = null, frame = null;
  function tick() {
    if (disposed) return;
    const time = now(), active = isActive();
    const video = getVideo?.();
    let fraction, playing;
    if (getVideo) {
      playing = active && !!video && !video.paused && !video.seeking && video.readyState >= 3;
      fraction = video && Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, Math.max(0, video.currentTime / video.duration)) : 0;
    } else {
      playing = active && !paused;
      if (playing && stamp !== null) elapsed = Math.min(duration, elapsed + Math.max(0, time - stamp));
      fraction = elapsed / duration;
    }
    stamp = playing ? time : null;
    onFrame(fraction, playing);
    if (!completed && active && fraction >= 1 && (getVideo ? video?.ended : !paused)) {
      completed = true;
      onComplete?.();
    }
    if (!disposed) frame = requestFrame(tick);
  }
  return {
    start() { if (disposed || frame !== null) return; tick(); },
    toggle() {
      if (getVideo) return;
      // Checkpoint before changing intent, so the last active interval counts.
      if (frame !== null) { cancelFrame(frame); frame = null; }
      tick(); paused = !paused; stamp = isActive() && !paused ? now() : null;
      onFrame(elapsed / duration, isActive() && !paused);
    },
    checkpoint() { if (frame !== null) { cancelFrame(frame); frame = null; } tick(); },
    dispose() { disposed = true; if (frame !== null) cancelFrame(frame); frame = null; stamp = null; },
    snapshot() { return { elapsed, paused }; },
  };
}
