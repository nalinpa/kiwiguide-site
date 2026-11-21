import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire(import.meta.url);
const Q = req("../public/plan/quiz.js");
const { monthsOf, startDateFor, stepFromHash, seasonOf, seasonLine, STEPS } = Q;
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const NOV20 = new Date(2026, 10, 20);
const at = (name) => STEPS.indexOf(name);
const full = { start: "dunedin", days: 12, season: "summer", month: { month: 0, year: 2027 }, pace: "some", drive: 240, vibes: ["nature", "relax"], into: ["Scenic", "Walks"], food: true, activities: ["hot-pools"], pick: "built-dunedin-12-loop" };

test("steps in order: the owner's order, a break after days and after the vibe", () => {
  assert.deepEqual(STEPS, ["start", "days", "break1", "season", "month", "pace", "drive", "vibe", "break2", "into", "food", "activities", "choice", "reveal", "account", "done"]);
});

test("cleanState old shape: today's saved quiz gives a clean state at the first unanswered step", () => {
  const old = { start: "queenstown", band: "weekend", idx: 8, liked: ["shotover-jet"], season: "summer", month: { month: 0, year: 2027 }, pick: "queenstown-weekend" };
  let c;
  assert.doesNotThrow(() => { c = Q.cleanState(old, NOV20); });
  assert.equal(c.start, "queenstown");
  assert.equal(c.days, null);
  assert.equal(c.season, null);
  assert.equal(c.pick, null);
  assert.equal(Q.firstOpenStep(c, at("reveal")), at("days"));
  assert.equal(Q.cleanState("junk", NOV20).start, null);
  assert.equal(Q.cleanState({ start: "constructor" }, NOV20).start, null);
});

test("cleanState: a full state passes; a bad answer drops it and everything after", () => {
  assert.deepEqual(Q.cleanState(full, NOV20), full);
  const a = Q.cleanState({ ...full, days: 2 }, NOV20);
  assert.equal(a.days, null); assert.equal(a.pace, null); assert.equal(a.start, "dunedin");
  const b = Q.cleanState({ ...full, drive: 999 }, NOV20);
  assert.equal(b.drive, null); assert.equal(b.pace, "some"); assert.equal(b.vibes, null);
  const c = Q.cleanState({ ...full, vibes: ["party"] }, NOV20);
  assert.equal(c.vibes, null); assert.equal(c.drive, 240);
  assert.equal(Q.cleanState({ ...full, into: ["Food"] }, NOV20).into, null);
  assert.equal(Q.cleanState({ ...full, food: "yes" }, NOV20).food, null);
  assert.equal(Q.cleanState({ ...full, activities: ["toString"] }, NOV20).activities, null);
  assert.equal(Q.cleanState({ ...full, month: { month: 5, year: 2027 } }, NOV20).month, null);
  const u = Q.cleanState({ ...full, season: "unsure", month: null }, NOV20);
  assert.equal(u.season, "unsure"); assert.equal(u.pace, "some");
});

test("firstOpenStep: no landing past a missing answer; the month only for a season", () => {
  const st = Q.cleanState(full, NOV20);
  assert.equal(Q.firstOpenStep(st, at("account")), at("account"));
  assert.equal(Q.firstOpenStep({ ...st, vibes: null }, at("into")), at("vibe"));
  assert.equal(Q.firstOpenStep({ ...st, vibes: null }, at("break2")), at("vibe"));
  assert.equal(Q.firstOpenStep({ ...st, food: null }, at("choice")), at("food"));
  assert.equal(Q.firstOpenStep({ ...st, season: "unsure", month: null }, at("month")), at("season"));
  assert.equal(Q.firstOpenStep({ ...st, season: "unsure", month: null }, at("pace")), at("pace"));
  assert.equal(Q.firstOpenStep({ ...st, pick: null }, at("reveal")), at("choice"));
  assert.equal(Q.firstOpenStep({ ...st, start: null }, at("days")), 0);
  assert.equal(Q.firstOpenStep(st, at("break1")), at("break1"));
});

test("activitiesFor: skiing only for June to October starts; only what the data has", () => {
  const ids = (d, m) => Q.activitiesFor(d, m).map((a) => a.id);
  const fake = { places: { a: { activities: ["skiing"] }, b: { activities: ["surfing"] } } };
  assert.deepEqual(ids(fake, 6), ["surfing", "skiing"]);
  assert.deepEqual(ids(fake, 9), ["surfing", "skiing"]);
  assert.deepEqual(ids(fake, 0), ["surfing"]);
  assert.deepEqual(ids(fake, 4), ["surfing"]);
  assert.deepEqual(ids(fake, 10), ["surfing"]);
  const real = ids(data, 0);
  assert.ok(real.includes("hot-pools") && !real.includes("skiing"));
  for (const id of real) assert.ok(Object.values(data.places).some((p) => p.activities.includes(id)), id);
  for (const a of Q.activitiesFor(data, 0)) assert.ok(a.label && a.hint, a.id);
});

test("revealState: loading, error, then the builder's options", () => {
  const ans = Q.answersFor(full);
  assert.equal(Q.revealState({ status: "loading" }, ans, () => assert.fail()), "loading");
  assert.equal(Q.revealState({ status: "error" }, ans, () => assert.fail()), "error");
  const seen = [];
  const out = Q.revealState({ status: "ready", data: "D", pack: "P" }, ans, (d, p, a) => { seen.push([d, p, a]); return [{ key: "x" }]; });
  assert.deepEqual(out, [{ key: "x" }]);
  assert.deepEqual(seen, [["D", "P", ans]]);
  assert.deepEqual(ans, { start: "dunedin", days: 12, pace: "some", drive: 240, vibes: ["nature", "relax"], into: ["Scenic", "Walks"], food: true, activities: ["hot-pools"] });
});

test("breakLine: the start town and days, then the vibe's photo", () => {
  const b1 = Q.breakLine(1, { start: "dunedin", days: 12 });
  assert.equal(b1.line, "Dunedin, 12 days. Good pick. The world’s only mainland royal albatross colony is at Taiaroa Head, inside the city limits.");
  assert.match(b1.img, /^https:\/\/api\.blacksands\.app\/images\/southislandguide\//);
  assert.equal(b1.credit, "");
  // one fact about the town itself: no promise of places the route may not visit
  const routeWords = /enough for|time for|the Catlins|Fiordland|Abel Tasman|Mount Cook|Tekapo|Kaikōura|Central Otago/;
  for (const t of ["christchurch", "queenstown", "picton", "dunedin", "nelson", "invercargill"]) {
    const b = Q.breakLine(1, { start: t, days: 7 });
    assert.ok(b.img, t);
    assert.match(b.line, new RegExp("^" + Q.TOWNS.find((x) => x.id === t).name + ", 7 days\\. Good pick\\. \\S.*\\.$"), t);
    assert.doesNotMatch(b.line, routeWords, t);
  }
  const photo = (vibes) => Q.breakLine(2, { vibes }).img;
  assert.match(photo(["adventure"]), /photo-shotover-jet-/);
  assert.match(photo(["nature"]), /photo-diamond-lake-/);
  assert.match(photo(["relax"]), /photo-gore-bay-/);
  assert.match(photo(["sightseeing"]), /photo-pukaki-/);
  assert.match(photo(["relax", "nature"]), /photo-diamond-lake-/);
  const b2 = Q.breakLine(2, { vibes: ["relax"] });
  assert.equal(b2.line, "Over 500 places on the island. Picking the ones that fit you.");
  assert.match(b2.credit, /^Photo: .*Michal Klajban, CC BY-SA 4\.0/);
  assert.ok(Q.breakLine(2, { vibes: [] }).credit);
});

test("measure params: kind, days, start, end, pace, drive, and nothing typed", () => {
  const option = { kind: "built", key: "built-dunedin-12-oneway", label: "South Island in 12 Days", start: "dunedin", end: "christchurch", days: new Array(12).fill({ items: [] }), missing: [] };
  const p = Q.measureParams(option, { ...full, email: "a@b.c" });
  assert.deepEqual(p, { kind: "built", days: 12, start: "dunedin", end: "christchurch", pace: "some", drive: 240 });
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.match(src, /track\("quiz_reveal", Object\.assign\(\{ trip: [^)]*\}, measureParams\(/);
  assert.equal((src.match(/track\("trip_saved", Object\.assign\(\{ trip: st\.pick, replaced: (true|false) \}, measureParams\(/g) || []).length, 2);
});

test("summaryLine: the visitor's own answers, and no 'liked' count", () => {
  const built = { kind: "built" }, sugg = { kind: "suggested" };
  const st = { ...full, vibes: ["relax", "nature"] };
  assert.equal(Q.summaryLine(built, st), "Built for you: Some walking · up to 4 h driving · Relax and Nature · food tips on · hot pools.");
  assert.equal(Q.summaryLine(sugg, { ...st, vibes: [], food: false, activities: [], drive: 120, pace: "easy" }), "Hand-checked trip: Easy · up to 2 h driving · no food tips.");
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.ok(!/You liked|you’ll like|q-liked/.test(src), "no 'liked' marks left on the reveal");
});

test("load retry: an error goes back to idle so the load runs again; the error screen offers it", () => {
  assert.deepEqual(Q.retryLoad({ status: "error" }), { status: "idle" });
  const loading = { status: "loading" }, ready = { status: "ready", data: {} };
  assert.equal(Q.retryLoad(loading), loading);
  assert.equal(Q.retryLoad(ready), ready);
  assert.match(Q.waitScreen("error"), /<button type="button"[^>]*data-act="reload"[^>]*>Try again<\/button>/);
  assert.match(Q.waitScreen("error"), /href="\/#trips"/);
  assert.doesNotMatch(Q.waitScreen("loading"), /data-act="reload"/);
});

test("activity hints are true to the data: no fiords for kayaking", () => {
  assert.equal(Q.ACTIVITIES.find((a) => a.id === "kayaking").hint, "Lakes and bays");
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

test("stepFromHash", () => {
  assert.equal(stepFromHash("#3"), 3);
  assert.equal(stepFromHash("#15"), 15);
  assert.equal(stepFromHash(""), 0);
  assert.equal(stepFromHash("#x"), 0);
  assert.equal(stepFromHash("#99"), 0);
});

test("tripPhotos: a different photo for each trip, never Food, from day 2 on", () => {
  const stop = (id, thumb, category = ["Scenic"]) => ({ siteId: id, thumb, category });
  const a = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("r", "r.webp", ["Food"]), stop("x", "x.webp")] }] };
  const b = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("x", "x.webp"), stop("y", "y.webp")] }] };
  assert.deepEqual(Q.tripPhotos([a, b]), ["x.webp", "y.webp"]);
  const one = { days: [{ items: [stop("g", "g.webp")] }] };
  assert.deepEqual(Q.tripPhotos([one, one]), ["g.webp", "g.webp"]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("n", null)] }] }]), [""]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("f", "f.webp", ["Food"])] }] }]), ["f.webp"]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ free: true, items: [] }] }]), [""]);
});

test("dots: no middle dot survives into a rendered screen", () => {
  const out = Q.dots('<h2>Day 1 <span>· Queenstown</span></h2><p>3 days · Back in</p>');
  assert.ok(!out.includes("·"));
  assert.ok(out.includes("∙ Queenstown") && out.includes("3 days ∙ Back in"));
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.ok(src.includes("root.innerHTML = dots(screens[STEPS[step]]())"), "render passes every screen through dots");
});

test("a stop with no photo gets its fallback URL; a real photo wins", () => {
  assert.equal(Q.stopPhoto({ thumb: null, fallback: "types/coffee" }), "/img/places/types/coffee.webp");
  assert.equal(Q.stopPhoto({ thumb: "a.webp", fallback: "types/coffee" }), "a.webp");
  assert.equal(Q.stopPhoto({ thumb: null }), "");
});

test("the start towns are the builder's six start cities, each with a photo from the image host and a line", () => {
  assert.deepEqual(Q.TOWNS.map((t) => t.id).sort(), data.starts.slice().sort());
  for (const t of Q.TOWNS) {
    assert.match(t.img, /^https:\/\/api\.blacksands\.app\/images\/southislandguide\/[0-9a-f-]+\.webp$/, t.id);
    assert.ok(t.sub && t.name === data.towns[t.id].name, t.id);
  }
});

test("driveLine: the over-limit line", () => {
  assert.equal(Q.driveLine(320, 240), "About 5 h 20 of driving. Over your 4 h limit.");
  assert.equal(Q.driveLine(300, 120), "About 5 h of driving. Over your 2 h limit.");
  assert.equal(Q.driveLine(185, 120), "About 3 h 05 of driving. Over your 2 h limit.");
});
