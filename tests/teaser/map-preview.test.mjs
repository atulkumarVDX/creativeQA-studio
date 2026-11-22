import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("lib/map-preview.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("exports", "module", compiled)(compiledModule.exports, compiledModule);
const { buildMapPreviewConfig } = compiledModule.exports;

function bytes(text) { return new TextEncoder().encode(text); }
function png(width, height) {
  const data = new Uint8Array(24);
  data.set([0x89, 0x50, 0x4e, 0x47], 0);
  new DataView(data.buffer).setUint32(16, width);
  new DataView(data.buffer).setUint32(20, height);
  return data;
}

test("builds a Mapbox preview config from the locationMap feed and matching assets", () => {
  const layers = [
    { layerID: 100, parentLayerID: 0, name: "locationMap1" },
    { layerID: 101, parentLayerID: 100, name: "default" },
    { layerID: 102, parentLayerID: 100, name: "pin" },
    { layerID: 103, parentLayerID: 100, name: "loading" },
    { layerID: 104, parentLayerID: 100, name: "noData" },
    { layerID: 105, parentLayerID: 100, name: "popup", bounds: { width: { _value: 250 }, height: { _value: 150 } } },
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
    ["data.json", bytes(data)], ["pin-102-2x.png", png(48, 70)],
    ["button-107-2x.png", png(200, 42)], ["logo-108-2x.png", png(140, 36)], ["default-101.png", png(20, 20)],
    ["loading-103.png", png(20, 20)], ["noData-104.png", png(20, 20)],
  ], "pk.test");

  assert.equal(config.components.length, 1);
  const { stores: componentStores, ...component } = config.components[0];
  assert.deepEqual(component, {
    rootLayerId: 100, defaultLayerId: 101, frameLayerId: 106, popupWidth: 250, popupHeight: 150, pinLayerId: 102,
    loadingLayerId: 103, noDataLayerId: 104, popupLayerId: 105, buttonLayerId: 107,
    logoLayerId: 108, dataMarkerLayerId: 110,
  });
  assert.equal(config.stores.length, 2);
  assert.deepEqual(componentStores, config.stores);
  assert.equal(config.stores[0].long, -74.01);
  assert.match(config.pinImages["102"].src, /^data:image\/png;base64,/);
  assert.deepEqual([config.pinImages["102"].width, config.pinImages["102"].height], [24, 35]);
  assert.match(config.buttonImages["100"].src, /^data:image\/png;base64,/);
  assert.deepEqual([config.buttonImages["100"].width, config.buttonImages["100"].height], [100, 21]);
  assert.deepEqual([config.logoImages["100"].width, config.logoImages["100"].height], [70, 18]);
  assert.match(config.defaultImages["100"], /^data:image\/png;base64,/);
  assert.match(config.loadingImages["100"], /^data:image\/png;base64,/);
  assert.match(config.noDataImages["100"], /^data:image\/png;base64,/);
  assert.equal(config.styleUrl, "mapbox://styles/mapbox/streets-v11");
  assert.deepEqual(config.settings, {
    zoomLevel: 12, minZoom: 2, maxZoom: 19, zoomControl: false,
    attributionControl: false, twoFingersEnabled: true, popupWidth: 250, popupHeight: 180,
    tooltip: "visible", showCloseBtn: true, openPopByDefault: true,
  });
  assert.equal(config.accessToken, "pk.test");
});

test("prefers full-resolution role artwork when both normal and retina files exist", () => {
  const config = buildMapPreviewConfig([
    { layerID: 1, name: "locationMap" },
    { layerID: 2, parentLayerID: 1, name: "default" },
    { layerID: 3, parentLayerID: 1, name: "pin" },
  ], [["pin-3.png", png(24, 35)], ["pin-3-2x.png", png(48, 70)]], "pk.test");
  assert.deepEqual([config.pinImages["3"].width, config.pinImages["3"].height], [24, 35]);
  assert.equal(Buffer.from(config.pinImages["3"].src.split(",")[1], "base64").length, 24);
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
  assert.deepEqual(config.components[0].stores, []);
  assert.equal(buildMapPreviewConfig([{ layerID: 1, name: "locationMapExtra" }], [], "pk.test"), null);
});

test("associates each map with its declared data feed instead of the first data.json", () => {
  const layers = [
    { layerID: 10, name: "locationMap1" },
    { layerID: 11, parentLayerID: 10, name: "default" },
    { layerID: 12, parentLayerID: 10, name: "data" },
    { layerID: 13, parentLayerID: 12, name: "data.json" },
    { layerID: 20, name: "locationMap2" },
    { layerID: 21, parentLayerID: 20, name: "default" },
    { layerID: 22, parentLayerID: 20, name: "data" },
    { layerID: 23, parentLayerID: 22, name: "data.json" },
  ];
  const files = [
    ["maps/one/data.json", bytes(JSON.stringify({ listing: { stores: [{ id: "one", lat: 25.79, long: -80.22 }] } }))],
    ["maps/two/data.json", bytes(JSON.stringify({ listing: { stores: [{ id: "two", lat: 37.8, long: -122.27 }] } }))],
  ];
  const config = buildMapPreviewConfig(layers, files, "pk.test", [
    { layerID: 13, fileName: "maps/one/data.json" },
    { layerID: 23, fileName: "maps/two/data.json" },
  ]);

  assert.deepEqual(config.components.map(component => [component.rootLayerId, component.stores.map(store => store.id)]), [
    [10, ["one"]], [20, ["two"]],
  ]);
});

test("does not guess between multiple feeds when a map has no file reference", () => {
  const config = buildMapPreviewConfig([
    { layerID: 1, name: "locationMap" },
    { layerID: 2, parentLayerID: 1, name: "default" },
    { layerID: 3, parentLayerID: 1, name: "data" },
    { layerID: 4, parentLayerID: 3, name: "data.json" },
  ], [
    ["one/data.json", bytes(JSON.stringify({ listing: { stores: [{ id: "one", lat: 25.79, long: -80.22 }] } }))],
    ["two/data.json", bytes(JSON.stringify({ listing: { stores: [{ id: "two", lat: 37.8, long: -122.27 }] } }))],
  ], "pk.test");

  assert.deepEqual(config.components[0].stores, []);
});

test("512px tile requests cover the same geography as markers at map zoom 12", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const tileOptions = page.match(/const tileLayer = L\.mapbox\.styleLayer\(mapConfig\.styleUrl, (\{[^;]+\})\);/)[1];
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

test("uses the production Mapbox Streets style layer and layers popups above pins", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /mapbox\.js\/v3\.3\.1\/mapbox\.js/);
  assert.match(page, /mapbox\.js\/v3\.3\.1\/mapbox\.css/);
  assert.match(page, /L\.mapbox\.styleLayer\(mapConfig\.styleUrl, \{ tileSize: 512, zoomOffset: -1/);
  assert.match(source, /styleUrl: "mapbox:\/\/styles\/mapbox\/streets-v11"/);
  assert.match(page, /leaflet-pane\.leaflet-popup-pane \{ z-index:800/);
  assert.match(page, /leaflet-pane\.leaflet-marker-pane \{ z-index:600/);
  assert.match(page, /border-radius:8px/);
  assert.match(page, /popupAnchor: \[Math\.round\(popupWidth \/ 2\), 2 - iconHeight - 10\]/);
  assert.match(page, /storeMarker\.bindPopup\(addStorePopup\(store, component\), \{ minWidth: popupWidth, maxWidth: popupWidth, maxHeight: popupHeight, offset: \[0, 0\], closeButton: mapConfig\.settings\?\.showCloseBtn !== false, autoClose: true/);
  assert.match(page, /max-width:calc\(var\(--tqa-popup-width,253px\) - 2px\) !important; max-height:calc\(var\(--tqa-popup-height,115px\) - 2px\)/);
  assert.doesNotMatch(page, /width:calc\(var\(--tqa-popup-width,253px\) - 2px\) !important; height:calc\(var\(--tqa-popup-height,115px\) - 2px\)/);
  assert.match(page, /image\.style\.cssText = 'display:block;width:100px;height:21px'/);
  assert.match(page, /leaflet-popup-content-wrapper::after/);
  assert.match(page, /L\.icon\(\{ \.\.\.iconOptions, iconUrl: pinImage\.src \}\)/);
  assert.match(page, /buttonImage\.src/);
  assert.match(page, /logoImages\?\.\[String\(component\.rootLayerId\)\]/);
  assert.doesNotMatch(page, /LEARN MORE/);
  assert.doesNotMatch(page, /tqa-map-fallback-pin/);
  assert.doesNotMatch(page, /html: marker/);
  assert.doesNotMatch(page, /mapbox-gl-js|mapboxgl\.Map/);
});

test("the injected preview bridge remains valid plain JavaScript", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const start = page.indexOf("const bridgeScript = ") + "const bridgeScript = ".length;
  const end = page.indexOf("\n\nfunction buildPreviewDocument", start);
  const expression = page.slice(start, end).trim().replace(/;$/, "");
  const document = new Function("BRIDGE_TOKEN", `return ${expression}`)("test-token");
  const script = document.slice(document.indexOf(">") + 1, document.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new vm.Script(script));
});

test("shows a failure state when every basemap tile request fails", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const tileBlock = page.slice(page.indexOf("const tileLayer = L.mapbox.styleLayer"), page.indexOf("const logoControl", page.indexOf("const tileLayer = L.mapbox.styleLayer")));
  assert.match(tileBlock, /let tileErrorCount = 0/);
  assert.ok(tileBlock.indexOf("tileLayer.on('tileerror'") < tileBlock.indexOf("tileLayer.addTo(map)"));
  assert.match(tileBlock, /tileErrorCount > 0 && !hasLoadedTiles/);
  assert.match(tileBlock, /Map tiles failed to load\. Check the configured Mapbox public token and its allowed website address\./);
});
