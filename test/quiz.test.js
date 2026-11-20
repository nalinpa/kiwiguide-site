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

test("reopenDeck: a finished deck shows the last card again, taking back its yes", () => {
  const last = CARDS[7].siteId;
  assert.deepEqual(Q.reopenDeck(8, ["hooker-valley-track", last]), { idx: 7, liked: ["hooker-valley-track"] });
  assert.deepEqual(Q.reopenDeck(8, ["hooker-valley-track"]), { idx: 7, liked: ["hooker-valley-track"] });
  assert.deepEqual(Q.reopenDeck(3, ["shotover-jet"]), { idx: 3, liked: ["shotover-jet"] });
});

test("cleanState: bad answers are dropped with everything after them; a good state passes", () => {
  const key = tripsFor(trips, "queenstown", "weekend")[0].key;
  const good = { start: "queenstown", band: "weekend", idx: 8, liked: ["shotover-jet"], season: "summer", month: { month: 0, year: 2027 }, pick: key };
  assert.deepEqual(Q.cleanState(good, trips, NOV20), good);
  assert.equal(Q.cleanState({ ...good, start: "mars" }, trips, NOV20).start, null);
  const b = Q.cleanState({ ...good, pick: "nope" }, trips, NOV20);
  assert.equal(b.pick, null); assert.equal(b.season, "summer");
  const c = Q.cleanState({ ...good, band: "short" }, trips, NOV20); // Queenstown has a 2-day trip, so "short" is valid
  assert.equal(c.band, "short"); assert.equal(c.pick, null);
  const d = Q.cleanState({ ...good, season: "monsoon" }, trips, NOV20);
  assert.equal(d.season, null); assert.equal(d.pick, null); assert.equal(d.band, "weekend");
  assert.equal(Q.cleanState({ ...good, month: { month: 5, year: 2027 } }, trips, NOV20).month, null);
  assert.equal(Q.cleanState("junk", trips, NOV20).start, null);
  assert.equal(Q.cleanState({ ...good, liked: ["x"] }, trips, NOV20).band, "weekend");
});

test("cleanState: idx must be a number; names like constructor are not answers", () => {
  const good = { start: "queenstown", band: "weekend", idx: 8, liked: [], season: "summer", month: null, pick: null };
  const r = Q.cleanState({ ...good, idx: "3" }, trips, NOV20);
  assert.equal(r.idx, 0); assert.equal(r.season, null); assert.equal(r.band, "weekend");
  for (const bad of ["constructor", "__proto__", "toString"]) {
    assert.equal(Q.cleanState({ ...good, start: bad }, trips, NOV20).start, null);
    assert.equal(Q.cleanState({ ...good, band: bad }, trips, NOV20).band, null);
    assert.equal(Q.cleanState({ ...good, season: bad }, trips, NOV20).season, null);
    assert.equal(Q.cleanState({ ...good, pick: bad }, trips, NOV20).pick, null);
  }
});

test("firstOpenStep: season and later need a finished deck", () => {
  const st = { start: "queenstown", band: "weekend", idx: 3, liked: [], season: "summer", month: null, pick: null };
  assert.equal(Q.firstOpenStep(st, 3), 2);
  assert.equal(Q.firstOpenStep(st, 6), 2);
  assert.equal(Q.firstOpenStep(st, 2), 2);
  assert.equal(Q.firstOpenStep({ ...st, idx: 8 }, 3), 3);
  assert.equal(Q.firstOpenStep({ ...st, start: null }, 3), 0);
});

test("strongInterests: the top interest and a runner-up within one; all yes highlights nothing", () => {
  assert.deepEqual(Q.strongInterests([]), []);
  // adventure x2 (shotover, nevis), hikes x1, scenic x1: top adventure, runner-up the first of the rest in order (hikes)
  assert.deepEqual(Q.strongInterests(["shotover-jet", "nevis-bungy", "hooker-valley-track", "cruise-milford-small-boat-cruise"]), ["adventure", "hikes"]);
  // hikes x3 vs food x1: food is two behind, so only hikes
  assert.deepEqual(Q.strongInterests(["hooker-valley-track", "te-anau-glowworm-caves", "pancake-rocks-and-blowholes-walk", "redcliff-te-anau"]), ["hikes"]);
  // a tie at the top keeps both and no runner-up
  assert.deepEqual(Q.strongInterests(["hooker-valley-track", "redcliff-te-anau"]), ["hikes", "food"]);
  assert.deepEqual(Q.strongInterests(CARDS.map((c) => c.siteId)), []);
});

test("tripPhotos: a different photo for each trip, never Food, from day 2 on", () => {
  const stop = (id, thumb, category = ["Scenic"]) => ({ siteId: id, thumb, category });
  const a = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("r", "r.webp", ["Food"]), stop("x", "x.webp")] }] };
  const b = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("x", "x.webp"), stop("y", "y.webp")] }] };
  assert.deepEqual(Q.tripPhotos([a, b]), ["x.webp", "y.webp"]);
  // the same first stop, the only photo: falls back rather than going blank
  const one = { days: [{ items: [stop("g", "g.webp")] }] };
  assert.deepEqual(Q.tripPhotos([one, one]), ["g.webp", "g.webp"]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("n", null)] }] }]), [""]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("f", "f.webp", ["Food"])] }] }]), ["f.webp"]);
  const q = tripsFor(trips, "queenstown", "weekend"), p = Q.tripPhotos(q);
  assert.equal(new Set(p).size, p.length);
});

test("dots: no middle dot survives into a rendered screen", () => {
  const out = Q.dots('<h2>Day 1 <span>· Queenstown</span></h2><p>3 days · Back in</p>');
  assert.ok(!out.includes("·"));
  assert.ok(out.includes("∙ Queenstown") && out.includes("3 days ∙ Back in"));
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.ok(src.includes("root.innerHTML = dots(screens[step]())"), "render passes every screen through dots");
});

test("a stop with no photo gets its fallback URL; a real photo wins", () => {
  assert.equal(Q.stopPhoto({ thumb: null, fallback: "types/coffee" }), "/img/places/types/coffee.webp");
  assert.equal(Q.stopPhoto({ thumb: "a.webp", fallback: "types/coffee" }), "a.webp");
  assert.equal(Q.stopPhoto({ thumb: null }), "");
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [{ thumb: null, fallback: "categories/Food", category: ["Food"] }] }] }]), ["/img/places/categories/Food.webp"]);
});
