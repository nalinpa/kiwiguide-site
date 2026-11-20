import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const Q = createRequire(import.meta.url)("../public/plan/quiz.js");
const { bandsFor, tripsFor, interestsFrom, CARDS, monthsOf, startDateFor, matchCounts, stepFromHash, seasonOf, seasonLine, BANDS } = Q;
const { trips } = JSON.parse(readFileSync(new URL("../public/plan/trips.json", import.meta.url), "utf8"));
const NOV20 = new Date(2026, 10, 20);

test("bandsFor: Picton has no short; Queenstown and Christchurch have all six", () => {
  assert.equal(BANDS.length, 6);
  const ids = (s) => bandsFor(trips, s).map((b) => b.id);
  assert.deepEqual(ids("queenstown"), ["short", "weekend", "week", "ten", "fortnight", "long"]);
  assert.deepEqual(ids("christchurch"), ["short", "weekend", "week", "ten", "fortnight", "long"]);
  assert.ok(!ids("picton").includes("short"));
});

test("tripsFor: bands, shortest first", () => {
  assert.equal(tripsFor(trips, "queenstown", "ten").length, 3);
  const w = tripsFor(trips, "queenstown", "weekend");
  assert.deepEqual(w.map((t) => t.days.length), [3, 3, 4, 4]);
  assert.equal(tripsFor(trips, "picton", "ten").length, 1);
});

test("interestsFrom: Wine Tours by Bike gives food and adventure, once each", () => {
  assert.deepEqual(interestsFrom(["wine-tours-by-bike"]), ["food", "adventure"]);
  assert.deepEqual(interestsFrom(["wine-tours-by-bike", "nevis-bungy"]), ["food", "adventure"]);
  assert.deepEqual(interestsFrom([]), []);
});

test("CARDS has eight, each with facts, what, yesIf and skipIf", () => {
  assert.equal(CARDS.length, 8);
  for (const c of CARDS) for (const k of ["siteId", "name", "town", "tag", "facts", "what", "yesIf", "skipIf", "img"]) assert.ok(c[k], c.siteId + " " + k);
});

test("monthsOf: each month at its next occurrence, current month included", () => {
  assert.deepEqual(monthsOf("summer", NOV20), [{ month: 11, year: 2026 }, { month: 0, year: 2027 }, { month: 1, year: 2027 }]);
  assert.deepEqual(monthsOf("spring", NOV20), [{ month: 10, year: 2026 }, { month: 8, year: 2027 }, { month: 9, year: 2027 }]);
});

test("startDateFor", () => {
  assert.equal(startDateFor({ season: "summer", month: { month: 0, year: 2027 } }, NOV20), "2027-01-01");
  assert.equal(startDateFor({ season: "spring", month: { month: 10, year: 2026 } }, NOV20), "2026-11-21");
  assert.equal(startDateFor({ season: "winter", month: null }, NOV20), "2027-06-01");
  assert.equal(startDateFor({ season: "spring", month: null }, NOV20), "2026-11-21");
  assert.equal(startDateFor({ season: null, month: null }, NOV20), "2027-01-01");
  assert.equal(startDateFor({ season: "unsure", month: null }, NOV20), "2027-01-01");
  assert.equal(startDateFor({ season: null, month: null }, new Date(2026, 11, 5)), "2027-02-01");
  assert.equal(startDateFor({ season: "summer", month: { month: 11, year: 2026 } }, new Date(2026, 11, 31)), "2027-01-01");
});

test("seasonOf and seasonLine", () => {
  assert.equal(seasonOf(11), "summer"); assert.equal(seasonOf(0), "summer"); assert.equal(seasonOf(4), "autumn");
  assert.equal(seasonOf(6), "winter"); assert.equal(seasonOf(10), "spring");
  assert.match(seasonLine("winter"), /^Winter: /);
  assert.equal(seasonLine(null), null);
  assert.equal(seasonLine("unsure"), null);
});

test("matchCounts: each stop once per interest; none gives []", () => {
  const trip = { days: [{ town: "x", items: [
    { category: ["Walks", "Nature"] }, { category: ["Scenic", "Walks"] }, { category: ["Food"] }, { category: ["Attractions"] },
  ] }] };
  assert.deepEqual(matchCounts(trip, ["hikes", "scenic"]), [
    { label: "hikes and nature stops", count: 2 }, { label: "scenic stop", count: 1 },
  ]);
  assert.deepEqual(matchCounts(trip, ["food"]), [{ label: "food stop", count: 1 }]);
  assert.deepEqual(matchCounts(trip, ["adventure"]), []);
  assert.deepEqual(matchCounts(trip, []), []);
});

test("stepFromHash", () => {
  assert.equal(stepFromHash("#3"), 3);
  assert.equal(stepFromHash(""), 0);
  assert.equal(stepFromHash("#x"), 0);
  assert.equal(stepFromHash("#99"), 0);
});
