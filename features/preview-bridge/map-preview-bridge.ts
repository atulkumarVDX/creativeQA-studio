export function buildMapPreviewBridgeSource(): string {
  return String.raw`
  let mapConfig = null;
  let leafletLoadPromise = null;
  const mapPaints = new Map();
  const mapInstances = new WeakMap();
  function loadLeaflet() {
    if (window.L && window.L.mapbox) return Promise.resolve(window.L);
    if (leafletLoadPromise) return leafletLoadPromise;
    leafletLoadPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-tqa-leaflet-css]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://api.mapbox.com/mapbox.js/v3.3.1/mapbox.css';
        css.dataset.tqaLeafletCss = 'true';
        document.head.appendChild(css);
      }
      if (!document.querySelector('style[data-tqa-mapbox-popup]')) {
        const popupStyle = document.createElement('style');
        popupStyle.dataset.tqaMapboxPopup = 'true';
        popupStyle.textContent = '.leaflet-container { font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif; }' +
          '.leaflet-pane.leaflet-popup-pane { z-index:800 !important; } .leaflet-pane.leaflet-marker-pane { z-index:600 !important; }' +
          '.leaflet-popup { margin-bottom:0; } .leaflet-popup-content-wrapper { position:relative; overflow:visible !important; border-radius:8px 8px 8px 0; background:#fff; padding:1px; box-shadow:0 3px 14px rgba(0,0,0,.4); }' +
          '.leaflet-popup-content { box-sizing:border-box; max-width:calc(var(--tqa-popup-width,253px) - 2px) !important; max-height:calc(var(--tqa-popup-height,115px) - 2px); margin:0; padding:10px 10px 15px; color:#252525; font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif; }' +
          '.theme-bubble .leaflet-popup { filter:drop-shadow(0 6px 12px rgba(0,0,0,.4)); }' +
          '.theme-bubble .leaflet-popup-content-wrapper { border-radius:8px; box-shadow:none; }' +
          '.theme-bubble .leaflet-popup-tip-container { position:absolute; width:32px; height:32px; transform:translate(-40%,-60%); background:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xNCw0IEw0LDI4IEwyOCwxOCB6IiBmaWxsPSIjRkZGRkZGIi8+PC9zdmc+); }' +
          '.theme-bubble .leaflet-popup-tip { display:none; }' +
          '.leaflet-popup-close-button { z-index:3; width:20px !important; height:20px !important; padding:0 !important; color:#33415b !important; font:18px/20px Arial,sans-serif !important; }' +
          '.leaflet-popup-content a, .leaflet-marker-icon { cursor:pointer; } .tqa-leaflet-marker { background:transparent; border:0; }';
        document.head.appendChild(popupStyle);
      }
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox.js/v3.3.1/mapbox.js';
      script.async = true;
      script.onload = () => window.L && window.L.mapbox ? resolve(window.L) : reject(new Error('Leaflet Mapbox did not initialize.'));
      script.onerror = () => reject(new Error('Leaflet Mapbox could not be loaded. Check your internet connection.'));
      document.head.appendChild(script);
    });
    return leafletLoadPromise;
  }
  function showMapFallback(container, message) {
    container.replaceChildren();
    container.style.display = 'grid';
    container.style.placeItems = 'center';
    container.style.background = '#eef1f4';
    container.style.color = '#364152';
    container.style.padding = '12px';
    container.style.boxSizing = 'border-box';
    container.style.font = '12px/1.4 Arial, sans-serif';
    container.style.textAlign = 'center';
    container.textContent = message;
  }
  function showMapStateImage(container, source) {
    if (!source) return null;
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.dataset.tqaMapState = 'true';
    image.style.cssText = 'position:absolute;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);max-width:100%;max-height:100%;object-fit:contain;pointer-events:none';
    container.appendChild(image);
    return image;
  }
  function clearMapOverlays(stage) {
    if (!stage) return;
    stage.querySelectorAll('[data-tqa-map-layer]').forEach(node => {
      const map = mapInstances.get(node);
      if (map) map.remove();
      node.remove();
    });
  }
  function addStorePopup(store, component) {
    const content = document.createElement('div');
    content.style.cssText = 'box-sizing:border-box;width:100%;height:auto;padding:0;color:#252525;text-align:center;font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif';
    const logo = mapConfig.logoImages?.[String(component.rootLayerId)];
    if (logo?.src) {
      const image = document.createElement('img');
      image.src = logo.src; image.alt = store.label || 'Store';
      image.style.cssText = 'display:block;margin:0 auto 14px;max-width:100%;object-fit:contain;width:' + (logo.width || 60) + 'px;height:' + (logo.height || 30) + 'px';
      content.appendChild(image);
    } else {
      const title = document.createElement('strong');
      title.textContent = store.label || 'Store';
      title.style.cssText = 'display:block;margin:0 0 14px;font-size:12px;font-weight:400';
      content.appendChild(title);
    }
    const address = document.createElement('div');
    const firstAddressLine = [store.address, store.city].filter(Boolean).join(', ');
    const secondAddressLine = [store.state, store.zip].filter(Boolean).join(' ');
    address.textContent = [firstAddressLine ? firstAddressLine + (store.city ? ',' : '') : '', secondAddressLine].filter(Boolean).join('\n');
    address.style.cssText = 'color:#252525;font-size:12px;line-height:20px;white-space:pre-line';
    content.appendChild(address);
    if (store.phone) {
      const phone = document.createElement('div');
      phone.textContent = store.phone;
      content.appendChild(phone);
    }
    try {
      const cta = new URL(store.cta || '');
      if (cta.protocol === 'https:') {
        const link = document.createElement('a');
        link.href = cta.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'display:inline-block;margin-top:5px;line-height:0;cursor:pointer';
        const buttonImage = mapConfig.buttonImages?.[String(component.rootLayerId)];
        if (buttonImage?.src) {
          const image = document.createElement('img');
          image.src = buttonImage.src; image.alt = '';
          image.style.cssText = 'display:block;width:100px;height:21px';
          link.appendChild(image);
          content.appendChild(link);
        }
      }
    } catch { /* Ignore malformed campaign links. */ }
    return content;
  }
  function renderMapOverlays(entry, activeTab, activeSlide) {
    if (!mapConfig || !entry?.stageEl || !entry?.byId || !entry?.childrenOf) return;
    const stage = entry.stageEl;
    if (!stage.isConnected) return;
    clearMapOverlays(stage);
    for (const component of mapConfig.components || []) {
      const root = entry.byId.get(component.rootLayerId);
      const target = entry.byId.get(component.defaultLayerId);
      const frameTarget = component.frameLayerId == null ? null : entry.byId.get(component.frameLayerId);
      if (!root || !target) continue;
      const defaultElement = stage.querySelector('[data-structure-layer-id="' + component.defaultLayerId + '"]');
      if (!defaultElement) continue;
      const frameElement = component.frameLayerId == null ? null : stage.querySelector('[data-structure-layer-id="' + component.frameLayerId + '"]');
      const geometryElement = frameElement || defaultElement;
      const geometryTarget = frameTarget || target;
      const parent = defaultElement.parentElement;
      if (!parent) continue;
      const mapElement = document.createElement('div');
      mapElement.classList.add('theme-bubble');
      mapElement.dataset.tqaMapLayer = String(component.rootLayerId);
      mapElement.setAttribute('aria-label', 'Interactive store map');
      mapElement.style.position = 'absolute';
      for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height', 'transform', 'transformOrigin', 'clipPath', 'borderRadius']) {
        if (geometryElement.style[property]) mapElement.style[property] = geometryElement.style[property];
      }
      mapElement.style.zIndex = defaultElement.style.zIndex || String(target.itemIndex || 0);
      mapElement.style.pointerEvents = 'auto';
      mapElement.style.overflow = 'visible';
      const popupWidth = component.popupWidth ?? mapConfig.settings?.popupWidth ?? 250;
      const popupHeight = component.popupHeight ?? mapConfig.settings?.popupHeight ?? 180;
      mapElement.style.setProperty('--tqa-popup-width', String(popupWidth) + 'px');
      mapElement.style.setProperty('--tqa-popup-height', String(popupHeight) + 'px');
      parent.appendChild(mapElement);
      defaultElement.style.display = 'none';
      if (frameElement) frameElement.style.display = 'none';
      for (const layerId of [component.pinLayerId, component.loadingLayerId, component.noDataLayerId, component.popupLayerId, component.buttonLayerId, component.logoLayerId, component.dataMarkerLayerId]) {
        if (layerId == null) continue;
        const layerElement = stage.querySelector('[data-structure-layer-id="' + layerId + '"]');
        if (layerElement) layerElement.style.display = 'none';
      }
      if (!mapConfig.accessToken) {
        showMapFallback(mapElement, 'Map preview needs a Mapbox public token. Configure VITE_MAPBOX_ACCESS_TOKEN when building the site.');
        showMapStateImage(mapElement, mapConfig.defaultImages?.[String(component.rootLayerId)]);
        continue;
      }
      const loadingImageSource = mapConfig.loadingImages?.[String(component.rootLayerId)];
      loadLeaflet().then(L => {
        if (!mapElement.isConnected) return;
        L.mapbox.accessToken = mapConfig.accessToken;
        const points = (component.stores || mapConfig.stores || []).filter(store => Number.isFinite(store.lat) && Number.isFinite(store.long));
        if (!points.length) {
          showMapStateImage(mapElement, mapConfig.noDataImages?.[String(component.rootLayerId)] || mapConfig.defaultImages?.[String(component.rootLayerId)]);
          return;
        }
        const first = points[0];
        const map = L.map(mapElement, {
          zoomControl: mapConfig.settings?.zoomControl === true,
          attributionControl: mapConfig.settings?.attributionControl === true,
          minZoom: mapConfig.settings?.minZoom ?? 2, maxZoom: mapConfig.settings?.maxZoom ?? 19,
          tap: mapConfig.settings?.twoFingersEnabled !== false,
        }).setView([first.lat, first.long], mapConfig.settings?.zoomLevel ?? 12);
        // Leaflet projects a 256px world; 512px tiles need one lower URL zoom
        // so their geographic bounds match the markers (map zoom 12 => tile z11).
        const tileLayer = L.mapbox.styleLayer(mapConfig.styleUrl, { tileSize: 512, zoomOffset: -1, maxZoom: mapConfig.settings?.maxZoom ?? 19, attribution: '© Mapbox © OpenStreetMap' });
        let tileErrorCount = 0;
        let loadingImage = null;
        tileLayer.once('load', () => {
          const hasLoadedTiles = Boolean(mapElement.querySelector('.leaflet-tile-loaded'));
          if (hasLoadedTiles && loadingImage?.isConnected) loadingImage.remove();
          if (tileErrorCount > 0 && !hasLoadedTiles && mapElement.isConnected) {
            showMapFallback(mapElement, 'Map tiles failed to load. Check the configured Mapbox public token and its allowed website address.');
          }
        });
        tileLayer.on('tileerror', () => {
          tileErrorCount += 1;
          window.setTimeout(() => {
            if (mapElement.isConnected && !mapElement.querySelector('.leaflet-tile-loaded')) {
              showMapFallback(mapElement, 'Map tiles failed to load. Check the configured Mapbox public token and its allowed website address.');
            }
          }, 1500);
        });
        tileLayer.addTo(map);
        const logoControl = L.control({ position: 'bottomleft' });
        logoControl.onAdd = () => {
          const logo = L.DomUtil.create('div', 'mapbox-logo leaflet-control mapbox-logo-true');
          logo.setAttribute('aria-label', 'Mapbox');
          return logo;
        };
        logoControl.addTo(map);
        loadingImage = showMapStateImage(mapElement, loadingImageSource);
        mapInstances.set(mapElement, map);
        map.whenReady(() => {
          points.forEach((store, index) => {
            const pinImage = mapConfig.pinImages?.[String(component.pinLayerId)];
            const scale = entry.scale || 1;
            const iconWidth = Math.max(1, (pinImage?.width || 24) * scale);
            const iconHeight = Math.max(1, (pinImage?.height || 35) * scale);
            const iconOptions = {
              iconSize: [iconWidth, iconHeight],
              iconAnchor: [iconWidth / 2, iconHeight],
              // Keep the production bubble tail aligned with the marker while
              // accounting for the rendered pin height.
              popupAnchor: [popupWidth / 2 + 9, -iconHeight],
              className: 'tqa-leaflet-marker',
            };
            const icon = pinImage?.src
              ? L.icon({ ...iconOptions, iconUrl: pinImage.src })
              : L.divIcon({ ...iconOptions, iconSize: [1, 1], iconAnchor: [0, 0], html: '' });
            if (!pinImage?.src) mapElement.dataset.tqaMissingPinArtwork = 'true';
            const storeMarker = L.marker([store.lat, store.long], { icon }).addTo(map);
            storeMarker.bindPopup(addStorePopup(store, component), { minWidth: popupWidth, maxWidth: popupWidth, maxHeight: popupHeight, offset: [0, 0], closeButton: mapConfig.settings?.showCloseBtn !== false, autoClose: true, closeOnClick: false });
            if (index === 0 && mapConfig.settings?.openPopByDefault !== false) storeMarker.openPopup();
          });
          map.invalidateSize();
        });
      }).catch(error => { if (mapElement.isConnected) showMapFallback(mapElement, error?.message || 'Leaflet Mapbox could not be loaded.'); });
    }
  }
  const previewApi = window.CSM_PREVIEW;
  if (previewApi && typeof previewApi.paintArtboard === 'function') {
    const paintArtboard = previewApi.paintArtboard;
    previewApi.paintArtboard = function(entry, activeTab, activeSlide, activeCategory) {
      clearMapOverlays(entry?.stageEl);
      const result = paintArtboard.call(this, entry, activeTab, activeSlide, activeCategory);
      mapPaints.set(entry.stageEl, { entry, activeTab, activeSlide });
      mapPaints.forEach((paint, stage) => { if (!stage.isConnected) mapPaints.delete(stage); });
      requestAnimationFrame(() => renderMapOverlays(entry, activeTab, activeSlide));
      return result;
    };
  }
  function handleMapConfig(config) {
    mapConfig = config || null;
    if (mapConfig) {
      loadLeaflet().then(() => mapPaints.forEach(paint => renderMapOverlays(paint.entry, paint.activeTab, paint.activeSlide))).catch(() => {
        mapPaints.forEach(paint => renderMapOverlays(paint.entry, paint.activeTab, paint.activeSlide));
      });
    }
  }
`;
}
