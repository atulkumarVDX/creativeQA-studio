import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("lib/map-preview.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("exports", "module", compiled)(compiledModule.exports, compiledModule);
const { buildMapPreviewConfig } = compiledModule.exports;

function bytes(text) { return new TextEncoder().encode(text); }

test("builds a Mapbox preview config from the locationMap feed and matching assets", () => {
  const layers = [
    { layerID: 100, parentLayerID: 0, name: "locationMap1" },
    { layerID: 101, parentLayerID: 100, name: "default" },
    { layerID: 102, parentLayerID: 100, name: "pin" },
    { layerID: 103, parentLayerID: 100, name: "loading" },
    { layerID: 104, parentLayerID: 100, name: "noData" },
    { layerID: 105, parentLayerID: 100, name: "popup" },
    { layerID: 106, parentLayerID: 100, name: "frame" },
    { layerID: 107, parentLayerID: 100, name: "button" },
    { layerID: 108, parentLayerID: 100, name: "logo" },
    { layerID: 109, parentLayerID: 100, name: "data" },
    { layerID: 110, parentLayerID: 109, name: "data.json" },
  ];
  const data = JSON.stringify({ listing: { stores: [
    { id: "1", label: "Walgreens", lat: 40.71, long: -74.01, cta: "https://example.com" },
    { id: "2", lat: "40.72", long: "-74.02" },
    { id: "bad", lat: "unknown", long: -74 },
  ] } });
  const config = buildMapPreviewConfig(layers, [
    ["data.json", bytes(data)], ["pin-102.png", new Uint8Array([1, 2, 3])],
    ["button-107.png", new Uint8Array([4, 5, 6])], ["logo-108.png", new Uint8Array([6, 7])], ["default-101.png", new Uint8Array([7])],
    ["loading-103.png", new Uint8Array([8])], ["noData-104.png", new Uint8Array([9])],
  ], "pk.test");

  assert.equal(config.components.length, 1);
  assert.deepEqual(config.components[0], {
    rootLayerId: 100, defaultLayerId: 101, frameLayerId: 106, pinLayerId: 102,
    loadingLayerId: 103, noDataLayerId: 104, popupLayerId: 105, buttonLayerId: 107,
    logoLayerId: 108, dataMarkerLayerId: 110,
  });
  assert.equal(config.stores.length, 2);
  assert.equal(config.stores[0].long, -74.01);
  assert.match(config.pinImages["102"], /^data:image\/png;base64,/);
  assert.match(config.buttonImages["100"], /^data:image\/png;base64,/);
  assert.match(config.logoImages["100"], /^data:image\/png;base64,/);
  assert.match(config.defaultImages["100"], /^data:image\/png;base64,/);
  assert.match(config.loadingImages["100"], /^data:image\/png;base64,/);
  assert.match(config.noDataImages["100"], /^data:image\/png;base64,/);
  assert.equal(config.tileUrl, "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}@2x?access_token=pk.test");
  assert.deepEqual(config.settings, {
    zoomLevel: 12, minZoom: 2, maxZoom: 19, zoomControl: false,
    attributionControl: false, twoFingersEnabled: true, popupWidth: 253,
    tooltip: "visible", showCloseBtn: true, openPopByDefault: true,
  });
  assert.equal(config.accessToken, "pk.test");
});

test("keeps valid location maps available for an empty feed so the no-data state can render", () => {
  assert.equal(buildMapPreviewConfig([], [], "pk.test"), null);
  const config = buildMapPreviewConfig([
    { layerID: 1, name: "locationMap1" },
    { layerID: 2, parentLayerID: 1, name: "default" },
    { layerID: 3, parentLayerID: 1, name: "noData" },
  ], [], "pk.test");
  assert.ok(config);
  assert.equal(config.stores.length, 0);
  assert.equal(config.components[0].rootLayerId, 1);
  assert.equal(buildMapPreviewConfig([{ layerID: 1, name: "locationMapExtra" }], [], "pk.test"), null);
});

test("512px tile requests cover the same geography as markers at map zoom 12", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const tileOptions = page.match(/const tileLayer = L\.tileLayer\(mapConfig\.tileUrl, (\{[^;]+\})\);/)[1];
  const options = new Function("mapConfig", `return (${tileOptions});`)({ settings: { maxZoom: 19 } });
  const zoom = buildMapPreviewConfig([
    { layerID: 1, name: "locationMap" },
    { layerID: 2, parentLayerID: 1, name: "default" },
  ], [], "pk.test").settings.zoomLevel;
  for (const [lat, lng, expected] of [
    [40.7114202, -74.0115337, [11, 602, 770]],
    [0, 0, [11, 1024, 1024]],
    [-33.8688, 151.2093, [11, 1884, 1228]],
  ]) {
    // Leaflet's EPSG:3857 world is 256 * 2^zoom pixels wide.
    const world = 256 * 2 ** zoom;
    const x = Math.floor((lng + 180) / 360 * world / options.tileSize);
    const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * world / options.tileSize);
    assert.deepEqual([zoom + options.zoomOffset, x, y], expected);
  }
});

test("uses the production Leaflet tile endpoint and layers popups above pins", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /mapbox\.js\/v3\.3\.1\/mapbox\.js/);
  assert.match(page, /mapbox\.js\/v3\.3\.1\/mapbox\.css/);
  assert.match(page, /L\.tileLayer\(mapConfig\.tileUrl, \{ tileSize: 512, zoomOffset: -1/);
  assert.match(page, /leaflet-pane\.leaflet-popup-pane \{ z-index:800/);
  assert.match(page, /leaflet-pane\.leaflet-marker-pane \{ z-index:600/);
  assert.match(page, /border-radius:8px/);
  assert.match(page, /popupAnchor: \[Math\.round\(\(mapConfig\.settings\?\.popupWidth \?\? 253\) \/ 2\), 2 - iconHeight - 10\]/);
  assert.match(page, /storeMarker\.bindPopup\(addStorePopup\(store, component\), \{ maxWidth: mapConfig\.settings\?\.popupWidth \?\? 253, offset: \[0, 0\], closeButton: mapConfig\.settings\?\.showCloseBtn !== false, autoClose: true/);
  assert.match(page, /leaflet-popup-content-wrapper::after/);
  assert.match(page, /L\.icon\(\{ \.\.\.iconOptions, iconUrl: pinImage \}\)/);
  assert.match(page, /L\.divIcon\(\{ \.\.\.iconOptions, html: '<span class="tqa-map-fallback-pin"><\/span>' \}\)/);
  assert.doesNotMatch(page, /html: marker/);
  assert.doesNotMatch(page, /mapbox-gl-js|mapboxgl\.Map/);
});
