import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const { trips } = JSON.parse(readFileSync(new URL("../public/plan/trips.json", import.meta.url), "utf8"));

test("trips.json has 26 trips, each start one of the three towns", () => {
  assert.equal(trips.length, 26);
  for (const t of trips) assert.ok(["christchurch", "queenstown", "picton"].includes(t.start), t.key);
});

test("every trip has days, every day a town and at least one item", () => {
  for (const t of trips) {
    assert.ok(t.days.length > 0, t.key);
    assert.ok(t.ends, t.key);
    for (const d of t.days) {
      assert.ok(d.town, t.key);
      assert.ok(d.items.length > 0, t.key);
    }
  }
});

test("every item has siteId, siteName, slotIndex >= 0, durationSlots >= 1, timeLabel, durationLabel", () => {
  for (const t of trips)
    for (const d of t.days)
      for (const i of d.items) {
        assert.ok(i.siteId && i.siteName, t.key);
        assert.ok(i.slotIndex >= 0 && i.durationSlots >= 1, i.siteId);
        assert.match(i.timeLabel, /^\d{1,2}:\d{2} (AM|PM)$/);
        assert.ok(i.durationLabel, i.siteId);
        assert.ok(Array.isArray(i.category), i.siteId);
      }
});

test("keys are unique", () => {
  assert.equal(new Set(trips.map((t) => t.key)).size, trips.length);
});

test("every item has a fallback photo that exists under public/img/places", () => {
  for (const t of trips)
    for (const d of t.days)
      for (const i of d.items) {
        assert.match(i.fallback, /^(types|categories)\/[\w-]+$/, i.siteId);
        assert.ok(existsSync(new URL(`../public/img/places/${i.fallback}.webp`, import.meta.url)), i.fallback);
      }
});
