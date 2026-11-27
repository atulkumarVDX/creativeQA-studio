import { buildMapPreviewBridgeSource } from "@/features/preview-bridge/map-preview-bridge";
export function buildPreviewBridgeScript(bridgeToken: string): string {
  return (String.raw`
<script>
(() => {
  // Playback lifecycle is controlled by the host, including live-update recovery.
  document.documentElement.dataset.tqaBridge = "ready";
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  ${buildMapPreviewBridgeSource()}
  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.token !== "__TQA_BRIDGE_TOKEN__") return;
    if (event.data.type === "tqa:map-config") {
      handleMapConfig(event.data.config);
      return;
    }
    if (event.data.type === "tqa:ping") {
      window.parent.postMessage({ type: "tqa:preview-ready", token: "__TQA_BRIDGE_TOKEN__" }, "*");
      return;
    }
    if (event.data.type === "tqa:open-screenshots") {
      document.getElementById("screenshotsBtn")?.click();
      return;
    }
    if (event.data.type === "tqa:set-theme") {
      if (event.data.theme === "dark" || event.data.theme === "light") {
        document.getElementById(event.data.theme === "dark" ? "darkModeBtn" : "lightModeBtn")?.click();
      }
      return;
    }
    if (event.data.type === "tqa:focus-finding") {
      if (event.data.finding && typeof window.openQaFinding === "function") window.openQaFinding(event.data.finding);
      return;
    }
    if (event.data.type === "tqa:select-size") {
      const target = String(event.data.size || "").toLowerCase();
      if (document.querySelector('#sizePicker input[type="checkbox"]')) document.getElementById("previewModeBtn")?.click();
      const chip = Array.from(document.querySelectorAll("#sizePicker .chip")).find(node => node.textContent.trim().toLowerCase() === target);
      chip?.querySelector("input")?.click();
      return;
    }
    if (event.data.type === "tqa:capture-mobile-instream") {
      const requestId = String(event.data.requestId || "");
      const selectedSize = Array.from(document.querySelectorAll("#sizePicker .chip"))
        .find(node => node.querySelector("input")?.checked)
        ?.textContent.trim().toLowerCase() || "";
      try {
        const chip = Array.from(document.querySelectorAll("#sizePicker .chip")).find(node => node.textContent.trim().toLowerCase() === "mobile-instream");
        if (!chip) throw new Error("The package has no mobile-instream artboard.");
        const input = chip.querySelector('input[type="checkbox"], input[type="radio"]');
        if (input && !input.checked) input.click();
        await nextFrame(); await nextFrame();
        await new Promise(resolve => setTimeout(resolve, 120));
        const card = Array.from(document.querySelectorAll(".cp-artboard-card")).find(node => node.querySelector(".cp-artboard-label")?.textContent.trim().toLowerCase().startsWith("mobile-instream"));
        const stage = card?.querySelector(".cp-stage");
        if (!stage || !window.htmlToImage) throw new Error("The mobile-instream canvas could not be rendered.");
        // Main Unit presents this authored 970x546 stage at 50% through a CSS
        // transform. Capturing that transform would bake the half-size preview
        // into the generated frame, then Teasers would scale it a second time.
        // Capture the authored stage at full size and let Teasers own the only
        // presentation-scale transform.
        const previousTransform = stage.style.transform;
        stage.style.transform = "none";
        await nextFrame();
        const stageRect = stage.getBoundingClientRect();
        const videoLayer = Array.from(stage.querySelectorAll(".cp-video")).find(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
        const videoRect = videoLayer?.getBoundingClientRect();
        const videoTarget = videoRect ? {
          left: videoRect.left - stageRect.left,
          top: videoRect.top - stageRect.top,
          width: videoRect.width,
          height: videoRect.height,
        } : null;
        let source;
        try {
          source = await window.htmlToImage.toCanvas(stage, { pixelRatio: 1, skipAutoScale: true, width: stage.offsetWidth, height: stage.offsetHeight });
        } finally {
          stage.style.transform = previousTransform;
        }
        const output = document.createElement("canvas");
        output.width = 970; output.height = 546;
        output.getContext("2d").drawImage(source, 0, 0, output.width, output.height);
        window.parent.postMessage({ type: "tqa:mobile-instream-frame", token: "__TQA_BRIDGE_TOKEN__", requestId, dataUrl: output.toDataURL("image/jpeg", .86), videoTarget }, "*");
      } catch (error) {
        window.parent.postMessage({ type: "tqa:mobile-instream-frame-error", token: "__TQA_BRIDGE_TOKEN__", requestId, message: error && error.message ? error.message : String(error) }, "*");
      } finally {
        // Teaser generation temporarily selects mobile-instream because the
        // renderer captures the live artboard. Restore the user's visible
        // size so background generation cannot change Main Unit selection.
        if (selectedSize && selectedSize !== "mobile-instream") {
          const restore = Array.from(document.querySelectorAll("#sizePicker .chip"))
            .find(node => node.textContent.trim().toLowerCase() === selectedSize);
          const input = restore?.querySelector("input");
          if (input && !input.checked) input.click();
        }
      }
      return;
    }
    if (event.data.type === "tqa:capture-feedback") {
      const requestId = String(event.data.requestId || "");
      try {
        const selectedSizes = Array.from(document.querySelectorAll('#sizePicker .chip'))
          .filter(node => node.querySelector('input')?.checked)
          .map(node => node.textContent.trim());
        const cards = Array.from(document.querySelectorAll('.cp-artboard-card'));
        const selectedName = selectedSizes[0]?.toLowerCase() || "";
        const card = cards.find(node => node.querySelector('.cp-artboard-label')?.textContent.trim().toLowerCase().startsWith(selectedName)) || cards[0];
        const stage = card?.querySelector('.cp-stage');
        if (!stage || !window.htmlToImage) throw new Error("No rendered artboard is available to capture.");
        await nextFrame(); await nextFrame();
        const source = await window.htmlToImage.toCanvas(stage, {
          pixelRatio: 1,
          skipAutoScale: true,
          width: stage.offsetWidth,
          height: stage.offsetHeight,
        });
        const activeText = selector => document.querySelector(selector)?.textContent?.trim() || null;
        const label = card.querySelector('.cp-artboard-label');
        const scale = label?.querySelector('.seg-btn.active')?.textContent?.trim() || null;
        window.parent.postMessage({
          type: "tqa:feedback-capture",
          token: "__TQA_BRIDGE_TOKEN__",
          requestId,
          dataUrl: source.toDataURL("image/png"),
          state: {
            artboard: selectedSizes[0] || label?.firstChild?.textContent?.trim() || "unknown",
            selectedSizes,
            tab: activeText('#tabButtons .active'),
            slide: activeText('#slideButtons .active'),
            viewMode: document.getElementById('previewModeBtn')?.classList.contains('active') ? "preview" : "compare",
            scale,
            theme: document.documentElement.dataset.theme || null,
          },
        }, "*");
      } catch (error) {
        window.parent.postMessage({ type: "tqa:feedback-capture-error", token: "__TQA_BRIDGE_TOKEN__", requestId, message: error && error.message ? error.message : String(error) }, "*");
      }
      return;
    }
    if (event.data.type !== "tqa:load-package" || !event.data.buffer) return;
    const file = new File([event.data.buffer], event.data.name || "package.zip", { type: event.data.mimeType || "application/zip" });
    try {
      document.documentElement.dataset.tqaBridge = "received";
      const input = document.getElementById("fileInputZip");
      if (input) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        document.documentElement.dataset.tqaBridge = "dispatched";
      }
    } catch (error) {
      document.documentElement.dataset.tqaBridge = "error";
      window.parent.postMessage({ type: "tqa:preview-error", token: "__TQA_BRIDGE_TOKEN__", message: error && error.message ? error.message : String(error) }, "*");
    }
  });
  window.addEventListener("csm:capture-state", (event) => {
  window.parent.postMessage({ type: "tqa:capture-state", token: "__TQA_BRIDGE_TOKEN__", busy: Boolean(event.detail && event.detail.busy) }, "*");
  });
  const packageMeta = document.getElementById("pkgMeta");
  if (packageMeta && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      const sizeCount = Number.parseInt(packageMeta.textContent || "", 10);
      if (Number.isFinite(sizeCount)) window.parent.postMessage({ type: "tqa:package-meta", token: "__TQA_BRIDGE_TOKEN__", sizeCount }, "*");
    }).observe(packageMeta, { childList: true, characterData: true, subtree: true });
  }
  window.parent.postMessage({ type: "tqa:preview-ready", token: "__TQA_BRIDGE_TOKEN__" }, "*");
})();
</scr` + `ipt>`).replaceAll("__TQA_BRIDGE_TOKEN__", bridgeToken);
}

export function buildPreviewDocument(previewSource: string, bridgeToken: string): string {
  const bridgeScript = buildPreviewBridgeScript(bridgeToken);
  // Insert before the document's final body tag because the bundled source contains literal closing-body text in comments.
  // Force JSZip's MessageChannel fallback to avoid cross-realm MutationObserver instances.
  const observerProbe = "var r,n,e=t.MutationObserver||t.WebKitMutationObserver;if(e){";
  const compatibleSource = previewSource.replace(observerProbe, "var r,n,e=null;if(e){");
  const bodyEnd = compatibleSource.lastIndexOf("</body>");
  const embeddedStyle = '<style id="tqa-embedded-shell">#topBar,.theme-toggle{display:none!important}#controlPanel{top:0!important}</style>';
  return bodyEnd >= 0
    ? `${compatibleSource.slice(0, bodyEnd)}${embeddedStyle}${bridgeScript}${compatibleSource.slice(bodyEnd)}`
    : `${compatibleSource}${embeddedStyle}${bridgeScript}`;
}
