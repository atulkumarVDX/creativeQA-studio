import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");

test("overview routes each quick action to its matching workspace", () => {
  assert.match(page, /metric-assets" onClick=\{\(\) => setActiveTab\("assets"\)\}/);
  assert.match(page, /<strong>\{formatBytes\(sourcePackage\?\.size \|\| totalBytes\)\}<\/strong><span>\{summary\.assets\.length\} files<\/span>/);
  assert.match(page, /overview-action-grid[\s\S]*?teaserMedia && <button className="quick-link overview-action-card" onClick=\{\(\) => setActiveTab\("teasers"\)\}[\s\S]*?<strong>Teaser preview<\/strong>/);
  assert.match(page, /ctvOttFormats\.length > 0 && <button className="quick-link overview-action-card" onClick=\{openCtvOtt\}[\s\S]*?<strong>CTV\/OTT view<\/strong>/);
});

test("overview video warnings lead to the matching asset findings", () => {
  assert.match(page, /const openAssetFindings = \(assetPath: string\) => \{[\s\S]*?setFindingCategory\("Assets"\)[\s\S]*?setFindingQuery\(assetPath\)[\s\S]*?setActiveTab\("findings"\)/);
  assert.match(page, /onClick=\{\(\) => openAssetFindings\(video\.path\)\}/);
});

test("overview CTAs use Desktop Expandable as their reference size", () => {
  assert.match(page, /<p>CTAs<\/p><strong>\{summary\.ctaCount \?\? "—"\}<\/strong>/);
  assert.match(page, /Counts CTA instances across tabs and slides in the Desktop Expandable reference size/);
  assert.match(page, /Desktop Expandable \(970x546\) was not found, so CTAs cannot be calculated/);
});

test("workspace navigation does not expose a technical analysis completion label", () => {
  assert.doesNotMatch(page, /Static analysis complete/);
  assert.doesNotMatch(page, /className="scan-status"/);
});

test("overview promotes destinations and groups review metrics together", () => {
  assert.match(page, /<section className="stat-grid overview-action-grid" aria-label="Quick access">/);
  assert.match(page, /<span className="eyebrow">PACKAGE REVIEW<\/span><h2>Review summary<\/h2>/);
  assert.match(page, /className="stat-grid overview-metrics review-summary-metrics"/);
});
