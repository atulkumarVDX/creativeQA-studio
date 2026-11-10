// Embedded verbatim (without export) in the standalone current preview.
export function createPreviewMediaLifecycle(doc) {
  const records = new Set();
  const byVideo = new WeakMap();
  let workspaceActive = doc.documentElement.dataset.tqaWorkspaceActive !== "false";
  let browserFocused = true;
  let audioEnabled = null;
  let compareMuted = false;
  const allowed = () => workspaceActive && browserFocused && !doc.hidden;
  const presented = record => record.presented && record.video.isConnected;
  const audioAllowed = () => !compareMuted && audioEnabled !== false;

  function removePrompt(record) {
    record.prompt?.remove();
    record.prompt = null;
  }
  function suspend(record) {
    record.suspended = true;
    record.video.pause();
  }
  function showPrompt(record) {
    if (record.prompt || compareMuted || !presented(record) || !allowed()) return;
    const video = record.video;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "cp-video-play-prompt";
    button.textContent = "Play with sound";
    Object.assign(button.style, {
      position: "absolute", left: video.style.left, top: video.style.top,
      width: video.style.width, height: video.style.height,
      zIndex: String(Number(video.style.zIndex || 0) + 1), pointerEvents: "auto",
      display: "grid", placeItems: "center", color: "white",
      background: "rgba(0,0,0,.25)", border: "0", cursor: "pointer",
      font: "600 16px Arial,sans-serif",
    });
    button.addEventListener("click", () => {
      record.intent = true;
      setAudioEnabled(true);
      play(record);
    });
    video.parentElement?.appendChild(button);
    record.prompt = button;
  }
  function play(record) {
    if (!allowed() || !presented(record) || !record.intent || record.restoring) return;
    const video = record.video;
    record.suspended = false;
    if (!video.paused) return;
    const attempt = video.play();
    attempt?.then(() => {
      if (record.video === video) removePrompt(record);
    }).catch(error => {
      if (record.video !== video || !allowed() || !presented(record)) return;
      if (error.name === "NotAllowedError") showPrompt(record);
    });
  }
  function bind(record, video) {
    byVideo.set(video, record);
    video.addEventListener("play", () => {
      if (record.video !== video) return;
      if (!allowed() || !presented(record)) suspend(record);
      else { record.intent = true; removePrompt(record); }
      record.update?.(record.video);
    });
    video.addEventListener("pause", () => {
      if (record.video === video && video.paused && !video.ended && !record.suspended && allowed() && presented(record)) {
        record.intent = false;
      }
      if (record.video === video) record.update?.(video);
    });
    video.addEventListener("volumechange", () => {
      if (record.video === video) record.update?.(video);
    });
  }
  function setAudioEnabled(enabled) {
    audioEnabled = !!enabled;
    for (const record of records) {
      for (const video of [record.video, record.pending].filter(Boolean)) {
        video.muted = !audioAllowed(); video.defaultMuted = !audioAllowed();
        video.volume = audioAllowed() ? 1 : 0;
      }
      record.update?.(record.video);
      if (audioAllowed()) play(record);
    }
  }
  function setCompareMuted(muted) {
    compareMuted = !!muted;
    for (const record of records) {
      for (const video of [record.video, record.pending].filter(Boolean)) {
        video.muted = !audioAllowed(); video.defaultMuted = !audioAllowed();
        video.volume = audioAllowed() ? 1 : 0;
      }
      record.update?.(record.video);
    }
  }
  // Some browser video surfaces stop painting after a tab/window switch even
  // while the decoder/audio clock keeps running. Recreate that native surface
  // from the same source and seek before resuming; never rebuild the artboard.
  function restoreSurface(record) {
    if (record.restoring || !presented(record)) return;
    const oldVideo = record.video;
    const time = oldVideo.currentTime;
    const next = oldVideo.cloneNode(false);
    next.autoplay = false;
    next.muted = oldVideo.muted;
    next.defaultMuted = oldVideo.defaultMuted;
    next.volume = oldVideo.volume;
    next.playbackRate = oldVideo.playbackRate;
    next.onerror = oldVideo.onerror;
    record.restoring = true;
    record.pending = next;
    suspend(record);
    const finish = () => {
      if (record.pending !== next) return;
      record.pending = null;
      record.restoring = false;
      if (!oldVideo.isConnected || record.video !== oldVideo) {
        next.pause();
        next.removeAttribute("src");
        return;
      }
      removePrompt(record);
      oldVideo.replaceWith(next);
      record.video = next;
      bind(record, next);
      record.onReplace?.(next);
      record.update?.(next);
      record.refreshSurface = false;
      if (allowed()) play(record);
    };
    next.addEventListener("loadedmetadata", () => {
      if (record.pending !== next) return;
      const target = Number.isFinite(next.duration) ? Math.min(time, Math.max(0, next.duration - .001)) : time;
      if (target > 0) {
        next.addEventListener("seeked", finish, { once: true });
        next.currentTime = target;
      } else if (next.readyState >= 2) finish();
      else next.addEventListener("loadeddata", finish, { once: true });
    }, { once: true });
    next.addEventListener("error", () => {
      if (record.pending !== next) return;
      record.pending = null;
      record.restoring = false;
      record.refreshSurface = false;
      play(record);
    }, { once: true });
    next.preload = "auto";
    next.load();
  }
  function sync() {
    for (const record of records) {
      if (!allowed() || !presented(record)) suspend(record);
      else if (record.refreshSurface) restoreSurface(record);
      else play(record);
    }
  }
  function browserActivity(active) {
    const wasActive = browserFocused;
    browserFocused = active;
    if (wasActive && !active) {
      for (const record of records) record.refreshSurface = true;
    }
    sync();
  }
  function checkFocus() {
    let focused = true;
    try { focused = doc.defaultView.top.document.hasFocus(); } catch (_) {}
    browserActivity(!doc.hidden && focused);
  }
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) browserActivity(false);
    else browserActivity(true);
  });
  const view = doc.defaultView;
  const deferFocusCheck = () => view.setTimeout(checkFocus, 0);
  view.addEventListener("blur", deferFocusCheck);
  view.addEventListener("focus", checkFocus);
  view.addEventListener("pagehide", () => browserActivity(false));
  view.addEventListener("pageshow", checkFocus);
  // Parent-window blur also covers click-outs from the embedded preview.
  let parentView;
  try { parentView = view.top; } catch (_) {}
  if (parentView && parentView !== view) {
    parentView.addEventListener("blur", deferFocusCheck);
    parentView.addEventListener("focus", checkFocus);
    view.addEventListener("pagehide", event => {
      if (event.persisted) return;
      parentView.removeEventListener("blur", deferFocusCheck);
      parentView.removeEventListener("focus", checkFocus);
    }, { once: true });
  }
  return {
    getState() {
      return { workspaceActive, browserFocused, hidden: doc.hidden, media: [...records].map(record => ({
        presented: presented(record), intent: record.intent, suspended: record.suspended,
        restoring: record.restoring, paused: record.video.paused,
      })) };
    },
    activate(video, onReplace) {
      let record = byVideo.get(video);
      if (!record) {
        record = { video, presented: true, intent: true, suspended: false, refreshSurface: false, restoring: false, pending: null, prompt: null, onReplace };
        records.add(record);
        bind(record, video);
      }
      if (audioEnabled !== null || compareMuted) {
        video.muted = !audioAllowed(); video.defaultMuted = !audioAllowed();
        video.volume = audioAllowed() ? 1 : 0;
      }
      record.presented = true;
      record.onReplace = onReplace;
      // Artboard cards are painted into a detached layout row, then mounted.
      // Start only after that synchronous render finishes attaching the tree.
      if (!video.isConnected) { Promise.resolve().then(sync); return; }
      if (!allowed()) suspend(record);
      else if (record.refreshSurface) restoreSurface(record);
      else play(record);
    },
    deactivateTree(root) {
      root.querySelectorAll("video, audio").forEach(video => {
        const record = byVideo.get(video);
        if (record) {
          record.presented = false;
          removePrompt(record);
          suspend(record);
        } else video.pause();
      });
    },
    setWorkspaceActive(active) { workspaceActive = active; sync(); },
    setBrowserActive: browserActivity,
    sync,
    playbackAllowed: allowed,
    currentVideo: video => byVideo.get(video)?.video || video,
    bindControls(video, update) {
      const record = byVideo.get(video);
      if (record) { record.update = update; update(record.video); }
    },
    togglePlayback(video) {
      const record = byVideo.get(video);
      if (!record || !presented(record) || !allowed()) return;
      record.intent = record.video.paused;
      if (record.intent) play(record);
      else { record.suspended = false; record.video.pause(); }
      record.update?.(record.video);
    },
    toggleAudio(video) {
      const record = byVideo.get(video);
      if (record) setAudioEnabled(record.video.muted || record.video.volume === 0);
    },
    setAudioEnabled,
    setCompareMuted,
    reset() {
      for (const record of records) {
        suspend(record);
        removePrompt(record);
        if (record.pending) { record.pending.pause(); record.pending.removeAttribute("src"); }
        record.pending = null;
      }
      records.clear();
      audioEnabled = null;
    },
  };
}
