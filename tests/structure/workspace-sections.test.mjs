import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const overview = readFileSync("features/overview/overview-section.tsx", "utf8");
const findings = readFileSync("features/findings/findings-section.tsx", "utf8");
const assets = readFileSync("features/assets/assets-section.tsx", "utf8");

test("workspace page delegates Overview, Findings, and Assets rendering to feature sections", () => {
  assert.match(page, /import \{ OverviewSection \} from "@\/features\/overview\/overview-section"/);
  assert.match(page, /import \{ FindingsSection \} from "@\/features\/findings\/findings-section"/);
  assert.match(page, /import \{ AssetsSection \} from "@\/features\/assets\/assets-section"/);
  assert.match(page, /activeTab === "overview" && <OverviewSection/);
  assert.match(page, /activeTab === "findings" && <FindingsSection/);
  assert.match(page, /activeTab === "assets" && <AssetsSection/);
  assert.match(page, /onFocusFinding=\{focusFinding\}/);
  assert.match(page, /onOpenAssetFindings=\{openAssetFindings\}/);
  assert.match(page, /filteredFindings = useMemo\(\(\) => filterFindings/);
  assert.match(page, /filteredAssets = useMemo\(\(\) => filterAssets/);
});

test("Findings section keeps filtering and preview navigation as typed callbacks", () => {
  assert.match(findings, /export type FindingsSectionProps = \{/);
  assert.match(findings, /onSeverityToggle: \(severity: Severity\) => void/);
  assert.match(findings, /onQueryChange: \(query: string\) => void/);
  assert.match(findings, /onFocusFinding: \(finding: Finding\) => void/);
  assert.match(findings, /onChange=\{event => onQueryChange\(event\.target\.value\)\}/);
  assert.match(findings, /onClick=\{\(\) => onFocusFinding\(finding\)\}/);
  assert.match(findings, /No matching findings/);
});

test("Overview and Assets retain their navigation, summaries, and inventory controls", () => {
  assert.match(overview, /onOpenMainUnit: \(\) => void/);
  assert.match(overview, /onShowSeverity: \(severity: Severity\) => void/);
  assert.match(overview, /onOpenAssetFindings: \(assetPath: string\) => void/);
  assert.match(overview, /Package at a glance/);
  assert.match(overview, /onClick=\{\(\) => onShowSeverity\("error"\)\}/);
  assert.match(assets, /filteredAssets: AssetRecord\[\]/);
  assert.match(assets, /onScopeChange: \(scope: string\) => void/);
  assert.match(assets, /aria-label="Asset scope"/);
  assert.match(assets, /<TableBody>/);
});
