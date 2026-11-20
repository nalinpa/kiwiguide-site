import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const M = createRequire(import.meta.url)("../public/plan/measure.js");
const { consentDefaults, CONSENT_DENIED_REGIONS, track, measureInit, GA_ID } = M;
const KEYS = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"];

function fakeWin(hostname) {
  const appended = [];
  return { appended, location: { hostname }, document: { createElement: () => ({}), head: { appendChild: (s) => appended.push(s) } } };
}
const calls = (w) => w.dataLayer.map((a) => Array.from(a));

test("consentDefaults: denied for the four signals in the listed regions", () => {
  const [region] = consentDefaults();
  KEYS.forEach((k) => assert.equal(region[k], "denied"));
  assert.deepEqual(region.region, CONSENT_DENIED_REGIONS);
});
test("consentDefaults: granted elsewhere, with no region", () => {
  const world = consentDefaults()[1];
  KEYS.forEach((k) => assert.equal(world[k], "granted"));
  assert.equal(world.region, undefined);
});
test("CONSENT_DENIED_REGIONS includes GB, CH, DE, FR and IE, and is the EU 27 + IS LI NO GB CH", () => {
  ["GB", "CH", "DE", "FR", "IE", "IS", "LI", "NO"].forEach((c) => assert.ok(CONSENT_DENIED_REGIONS.includes(c), c));
  assert.equal(CONSENT_DENIED_REGIONS.length, 32);
  assert.equal(new Set(CONSENT_DENIED_REGIONS).size, 32);
});
test("track does nothing and doesn't throw without gtag", () => {
  assert.doesNotThrow(() => track("quiz_start"));
});
test("track sends the event to gtag when it is there", () => {
  const seen = [];
  globalThis.gtag = (...a) => seen.push(a);
  try { track("quiz_step", { step: 1, answer: "short" }); } finally { delete globalThis.gtag; }
  assert.deepEqual(seen, [["event", "quiz_step", { step: 1, answer: "short" }]]);
});
test("the placeholder id loads nothing", () => {
  const w = fakeWin("kiwiguide.app");
  assert.equal(measureInit("G-XXXXXXXXXX", w), false);
  assert.equal(w.appended.length, 0);
  assert.equal(w.gtag, undefined);
});
test("consent defaults are queued before config and before the tag is added", () => {
  const w = fakeWin("kiwiguide.app");
  assert.equal(measureInit(GA_ID, w), true);
  const c = calls(w);
  assert.deepEqual(c.slice(0, 2).map((x) => x.slice(0, 2)), [["consent", "default"], ["consent", "default"]]);
  assert.deepEqual(c.slice(2, 4), [["set", "ads_data_redaction", true], ["set", "url_passthrough", false]]);
  assert.equal(c[5][0], "config");
  assert.equal(w.appended.length, 1);
  assert.equal(w.appended[0].src, "https://www.googletagmanager.com/gtag/js?id=" + GA_ID);
});
test("config has no debug flag on kiwiguide.app, debug_mode elsewhere", () => {
  const live = fakeWin("kiwiguide.app"); measureInit(GA_ID, live);
  assert.deepEqual(calls(live).find((x) => x[0] === "config"), ["config", GA_ID]);
  const test = fakeWin("test.example.workers.dev"); measureInit(GA_ID, test);
  assert.deepEqual(calls(test).find((x) => x[0] === "config"), ["config", GA_ID, { debug_mode: true }]);
});
