import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { buildTrips } = require("../public/plan/builder.js");
const pack = require("../public/plan/pack.js");
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const lookup = (id) => data.places[id];
const blockById = Object.fromEntries(data.blocks.map((b) => [b.id, b]));
const base = { pace: "some", drive: 240, vibes: [], into: [], food: true, activities: [] };
const ask = (a) => buildTrips(data, pack, { ...base, ...a });

// The sweep: every start × length × drive × pace, food on and off; interests vary with the index.
const LENGTHS = [3, 4, 7, 10, 14, 21];
const INTERESTS = [
  { vibes: ["nature", "relax"], into: ["Scenic", "Walks"], activities: ["hot-pools"] },
  { vibes: [], into: [], activities: [] },
  { vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["surfing", "wildlife"] },
];
const sweep = [];
let ms = 0;
for (const start of data.starts) for (const days of LENGTHS) for (const drive of [120, 240, 360])
  for (const pace of ["easy", "some", "hikes"]) for (const food of [true, false]) {
    const answers = { start, days, drive, pace, food, ...INTERESTS[sweep.length % 3] };
    const t0 = performance.now();
    const options = buildTrips(data, pack, answers);
    ms += performance.now() - t0;
    sweep.push({ answers, options });
  }
const name = (a) => `${a.start} ${a.days}d ${a.drive} ${a.pace} food:${a.food}`;
const stays = new Set(data.blocks.filter((b) => b.startTown === b.endTown).map((b) => b.startTown));

const freeCap = (days) => Math.floor(days / 4);
const foodOnly = (p) => p.category.length === 1 && p.category[0] === "Food";

// A route of exactly `days` days within the drive limit, by the builder's rules: blocks within the limit,
// each at most twice and never two days running; at most freeCap(days) free days, each in a town that has a
// town day (a block that starts and ends there); ending in any start city. Depth-first, memoised dead ends.
function withinLimitRouteExists(start, days, drive) {
  const cap = freeCap(days), blocks = data.blocks.filter((b) => b.driveMinutes <= drive), dead = new Set();
  const go = (town, left, free, last, uses) => {
    if (!left) return data.starts.includes(town);
    const key = [town, left, free, last, JSON.stringify(uses)].join("|");
    if (dead.has(key)) return false;
    if (stays.has(town) && free < cap && go(town, left - 1, free + 1, null, uses)) return true;
    for (const b of blocks) {
      if (b.startTown !== town || b.id === last || (uses[b.id] || 0) >= 2) continue;
      if (go(b.endTown, left - 1, free, b.id, { ...uses, [b.id]: (uses[b.id] || 0) + 1 })) return true;
    }
    dead.add(key);
    return false;
  };
  return go(start, days, 0, null, {});
}

test("every answer gets a trip", () => {
  for (const { answers, options } of sweep) {
    assert.ok(options.length >= 1 && options.length <= 3, name(answers));
    for (const o of options) assert.equal(o.days.length, answers.days, name(answers) + " " + o.key);
  }
});

test("days chain", () => {
  for (const { answers, options } of sweep) for (const o of options) {
    let at = answers.start;
    assert.equal(o.start, answers.start);
    for (const d of o.days) {
      if (d.free) {
        assert.equal(d.town, at, name(answers) + " " + o.key);
        assert.deepEqual(d.items, []);
        assert.ok(!d.overLimit);
      } else {
        const b = blockById[d.block];
        assert.ok(b, o.key + " block " + d.block);
        assert.equal(b.startTown, at, name(answers) + " " + o.key);
        assert.equal(d.town, b.endTown);
      }
      at = d.town;
    }
    assert.equal(o.end, at);
    assert.ok(data.starts.includes(o.end), o.key);
  }
});

test("free days: at most a quarter of the trip", () => {
  for (const { answers, options } of sweep) for (const o of options)
    assert.ok(o.days.filter((d) => d.free).length <= freeCap(answers.days), `${name(answers)} ${o.key}`);
});

test("the app would not move a thing", () => {
  for (const { answers, options } of sweep) for (const o of options) {
    const out = pack.packTrip(o.days.map((d, i) => ({ id: "d" + i, items: d.items.map((it) => ({ ...it, id: it.siteId })) })), lookup);
    out.forEach((d, i) => d.items.forEach((it, k) => {
      const was = o.days[i].items[k];
      assert.equal(it.slotIndex, was.slotIndex, `${name(answers)} ${o.key} day ${i + 1} ${it.siteId}`);
      assert.ok(it.slotIndex + it.durationSlots <= 28, `${name(answers)} ${o.key} ${it.siteId} ends late`);
      assert.equal(was.timeLabel, it.timeLabel);
      assert.equal(was.durationLabel, it.durationLabel);
    }));
  }
});

test("no forbidden stops", () => {
  for (const { answers, options } of sweep) for (const o of options) {
    const all = o.days.flatMap((d) => d.items.map((it) => it.siteId));
    for (const d of o.days) for (const it of d.items) {
      assert.ok(data.places[it.siteId], it.siteId);
      const added = !blockById[d.block].items.some((x) => x.siteId === it.siteId);
      // a hand-checked block keeps its own repeats; a stop the builder adds is never anywhere else in the trip
      if (added) assert.equal(all.filter((id) => id === it.siteId).length, 1, `${name(answers)} ${o.key} adds ${it.siteId} twice`);
      assert.deepEqual(Object.keys(it).sort(), ["durationLabel", "durationSlots", "siteId", "siteName", "slotIndex", "timeLabel"]);
    }
  }
});

test("food off", () => {
  for (const { answers, options } of sweep) if (!answers.food) for (const o of options)
    for (const d of o.days) for (const it of d.items) {
      const c = data.places[it.siteId].category;
      assert.ok(!(c.length === 1 && c[0] === "Food"), `${name(answers)} ${it.siteId}`);
    }
});

test("drive limit", () => {
  for (const { answers, options } of sweep) {
    for (const o of options) for (const d of o.days) {
      const over = !d.free && blockById[d.block].driveMinutes > answers.drive;
      assert.equal(!!d.overLimit, over, `${name(answers)} ${o.key}`);
    }
    const built = options.find((o) => o.kind === "built");
    if (built && withinLimitRouteExists(answers.start, answers.days, answers.drive))
      assert.ok(!built.days.some((d) => d.overLimit), name(answers) + " has a route within the limit");
  }
});

test("suggested first", () => {
  const want = data.templates.filter((t) => t.start === "queenstown" && t.blockIds.length === 10);
  assert.equal(want.length, 3);
  const options = ask({ start: "queenstown", days: 10, drive: 360 });
  assert.deepEqual(options.map((o) => o.key), want.map((t) => t.key));
  options.forEach((o, i) => {
    assert.equal(o.kind, "suggested");
    assert.equal(o.label, want[i].label);
    assert.equal(o.end, want[i].end);
    assert.deepEqual(o.days.map((d) => d.block), want[i].blockIds);
  });
});

test("suggested trips are always offered first, over-limit days marked", () => {
  const want = data.templates.filter((t) => t.start === "queenstown" && t.blockIds.length === 10).map((t) => t.key);
  const options = ask({ start: "queenstown", days: 10, drive: 120 });
  assert.deepEqual(options.map((o) => o.key), want);
  assert.ok(options.every((o) => o.kind === "suggested" && o.days.some((d) => d.overLimit)));
  const one = ask({ start: "christchurch", days: 7, drive: 120 });
  assert.equal(one[0].kind, "suggested");
  assert.ok(one.slice(1).every((o) => o.kind === "built"));
});

test("a suggested trip with nothing to personalise is its template, slot for slot", () => {
  const t = data.templates.find((x) => x.start === "queenstown" && x.blockIds.length === 10);
  const [o] = buildTrips(data, pack, { start: "queenstown", days: 10, pace: "some", drive: 360, vibes: [], into: [], food: true, activities: [] });
  assert.equal(o.key, t.key);
  const slim = (items) => items.map((it) => [it.siteId, it.siteName, it.slotIndex, it.durationSlots]);
  o.days.forEach((d, i) => assert.deepEqual(slim(d.items), slim(blockById[t.blockIds[i]].items), `day ${i + 1}`));
});

test("easy drops only a non-featured walk, never a day's only walk, only past three stops", () => {
  for (const { answers, options } of sweep) if (answers.pace === "easy" && answers.food) for (const o of options) {
    const before = new Set();
    for (const d of o.days) {
    if (d.free) continue;
    const items = blockById[d.block].items;
    // in a built trip a non-Food place an earlier day had is dropped too; that isn't Easy's doing
    const gone = items.filter((x) => !d.items.some((it) => it.siteId === x.siteId) &&
      !(o.kind === "built" && !foodOnly(data.places[x.siteId]) && before.has(x.siteId)));
    d.items.forEach((it) => before.add(it.siteId));
    assert.ok(gone.length <= 1, `${name(answers)} ${o.key} ${d.block}`);
    if (!gone.length) continue;
    const p = data.places[gone[0].siteId];
    assert.ok(items.length > 3 && !p.featured && p.category.includes("Walks"), `${name(answers)} ${p.id}`);
    assert.ok(items.filter((x) => data.places[x.siteId].category.includes("Walks")).length >= 2, `${name(answers)} only walk ${p.id}`);
    }
  }
});

test("built trips never repeat a place, except Food places", () => {
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const day = {};
    o.days.forEach((d, i) => d.items.forEach((it) => {
      if (foodOnly(data.places[it.siteId])) return;
      assert.ok(day[it.siteId] === undefined, `${name(answers)} ${o.key} ${it.siteId} on days ${day[it.siteId] + 1} and ${i + 1}`);
      day[it.siteId] = i;
    }));
  }
});

test("hand-checked days stay as they are when nothing is added or removed", () => {
  const slim = (items) => items.map((it) => [it.siteId, it.slotIndex, it.durationSlots]);
  for (const start of ["queenstown", "christchurch", "picton"]) for (const days of [3, 7, 10, 14, 21]) {
    for (const o of ask({ start, days, drive: 360 })) if (o.kind === "suggested") {
      o.days.forEach((d, i) => assert.deepEqual(slim(d.items), slim(blockById[d.block].items), `${o.key} day ${i + 1}`));
    }
  }
});

test("built trips are titled and keyed", () => {
  const options = ask({ start: "dunedin", days: 12 });
  assert.ok(options.length >= 1);
  for (const o of options) {
    assert.equal(o.kind, "built");
    assert.equal(o.label, "South Island in 12 Days");
    assert.equal(o.key, `built-dunedin-12-${o.end === "dunedin" ? "loop" : "oneway"}`);
  }
  assert.ok(options.filter((o) => o.end === "dunedin").length <= 1 && options.filter((o) => o.end !== "dunedin").length <= 1);
});

test("long slow trip from Invercargill", () => {
  const [o] = ask({ start: "invercargill", days: 21, drive: 120 });
  assert.equal(o.days.length, 21);
  assert.ok(o.days.some((d) => d.free && d.items.length === 0));
  o.days.forEach((d, i) => { if (i && !d.free) assert.notEqual(d.block, o.days[i - 1].block); });
  const uses = {};
  for (const d of o.days) if (!d.free) uses[d.block] = (uses[d.block] || 0) + 1;
  assert.ok(Object.values(uses).every((n) => n <= 2));
});

test("never empty", () => {
  const options = ask({ start: "nelson", days: 3, pace: "easy", drive: 120 });
  assert.ok(options.length >= 1);
  assert.equal(options[0].days.length, 3);
  assert.ok(options[0].days.some((d) => d.items.length > 0));
});

test("activity not on route", () => {
  assert.equal(Object.values(data.places).filter((p) => p.activities.includes("skiing")).length, 0);
  const a = { start: "queenstown", days: 7, vibes: ["nature"], into: ["Scenic"] };
  const without = ask(a);
  const withSki = ask({ ...a, activities: ["skiing"] });
  assert.equal(withSki.length, without.length);
  withSki.forEach((o, i) => {
    assert.deepEqual(o.missing, ["skiing"]);
    assert.deepEqual(o.days, without[i].days);
  });
});

test("missing lists exactly the picked activities no stop has", () => {
  for (const { answers, options } of sweep) for (const o of options) {
    const has = new Set(o.days.flatMap((d) => d.items.flatMap((it) => data.places[it.siteId].activities)));
    assert.deepEqual(o.missing, answers.activities.filter((x) => !has.has(x)), name(answers));
  }
});

test("pace: easy trims, big hikes adds long walks", () => {
  const longWalks = (os) => os[0].days.flatMap((d) => d.items).filter((it) => {
    const p = data.places[it.siteId]; return p.category.includes("Walks") && p.slots >= 4;
  }).length;
  const stops = (os) => os[0].days.reduce((n, d) => n + d.items.length, 0);
  const a = { start: "christchurch", days: 14, drive: 360 };
  assert.ok(stops(ask({ ...a, pace: "easy" })) < stops(ask(a)));
  assert.ok(longWalks(ask({ ...a, pace: "hikes" })) > longWalks(ask(a)));
});

test("same answers, same trip", () => {
  const a = { start: "dunedin", days: 12, pace: "some", drive: 240, vibes: ["nature", "relax"], into: ["Nature"], food: true, activities: ["hot-pools"] };
  assert.deepEqual(buildTrips(data, pack, a), buildTrips(data, pack, a));
});

test("fast", () => {
  const avg = ms / sweep.length;
  console.log(`builder: ${sweep.length} calls, ${avg.toFixed(1)} ms average`);
  assert.ok(avg < 50, avg + " ms");
});
