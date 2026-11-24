import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { buildTrips, TOWNS_RANKED, townCost, TOP_UP, onWay, townSpot, closeUp, mayAdd, ONE_DAY, nearbyTowns, DAY_OUT, FAVOURITES } = require("../public/plan/builder.js");
// A town's favourite on a day whose only sights are its favourites (Kaiteriteri in Abel Tasman; Queenstown Gardens and Bay
// Beach) may be a place the trip has been to before
const favs = (d) => FAVOURITES[d.town] || [];
const favouriteStop = (d, it) => favs(d).includes(it.siteId) && d.items.every((x) => favs(d).includes(x.siteId) || foodOnly(data.places[x.siteId]));
const bsrc = readFileSync(new URL("../public/plan/builder.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const Q = require("../public/plan/quiz.js");
const pack = require("../public/plan/pack.js");
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const lookup = (id) => data.places[id];
const blockById = Object.fromEntries(data.blocks.map((b) => [b.id, b]));
// A day's block; a day spent in town (the builder's "rest-<town>", a route's rest day, or "stay-<town>", a trip with no route
// out of its start town at all: Nelson in 2 days) stands for an empty block there
const blockOf = (d) => blockById[d.block] || halfOf(d.block) || (/^(stay|rest)-/.test(d.block || "") ? { id: d.block, startTown: d.town, endTown: d.town, driveMinutes: 0, items: [] } : undefined);
// A day through a town split in two for a night there ("<block>|<town>|1", then "|2"; owner 2026-11-24, Hanmer): the block's
// stops up to its last one in that town, then the rest; its driving the app's way from its start town's hub
function halfOf(id) {
  const m = /^(.+)\|([a-z-]+)\|([12])$/.exec(id || ""), b = m && blockById[m[1]];
  if (!b) return undefined;
  const k = b.items.findLastIndex((it) => lookup(it.siteId).area === m[2]) + 1, one = m[3] === "1";
  const items = one ? b.items.slice(0, k) : b.items.slice(k), startTown = one ? b.startTown : m[2];
  let from = pack.hubs[startTown], slots = 0;
  for (const it of items) { const leg = pack.getLeg(from, it.siteId, lookup); if (leg.drive) slots += leg.slots; from = it.siteId; }
  return { id, startTown, endTown: one ? m[2] : b.endTown, driveMinutes: slots * 30, items };
}
const packed = (items) => pack.packTrip([{ items: [] }, { items }], lookup)[1].items;
const base = { pace: "some", drive: 240, vibes: [], into: [], food: true, activities: [] };
const ask = (a) => buildTrips(data, pack, { ...base, ...a });

// The sweep: every start × length × drive × pace, food on and off; interests vary with the index.
const LENGTHS = [3, 4, 7, 10, 14, 21];
const INTERESTS = [
  { vibes: ["nature", "relax"], into: ["Scenic", "Walks"], activities: ["hot-pools"] },
  { vibes: [], into: [], activities: [] },
  { vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] },
];
const sweep = [];
let ms = 0;
for (const start of data.starts) for (const days of LENGTHS) for (const drive of [120, 240, 360])
  for (const pace of ["easy", "some", "hikes"]) for (const food of [true, false]) {
    // as the quiz sends them: a finish back at the start, another start town the trip can reach (MIN_DAYS), or none
    const other = data.starts.find((x) => x !== start && Q.minDays(start, x) <= days);
    const loop = Q.minDays(start, start) <= days ? start : undefined; // the quiz offers "back to the start" only from MIN_DAYS on
    const answers = { start, end: [loop, other, undefined][Math.floor(sweep.length / 3) % 3], days, drive, pace, food, ...INTERESTS[sweep.length % 3] };
    const t0 = performance.now();
    const options = buildTrips(data, pack, answers);
    ms += performance.now() - t0;
    sweep.push({ answers, options });
  }
const name = (a) => `${a.start}${a.end ? ">" + a.end : ""} ${a.days}d ${a.drive} ${a.pace} food:${a.food}`;
const stays = new Set(data.blocks.filter((b) => b.startTown === b.endTown).map((b) => b.startTown));

const freeCap = (days) => Math.floor(days / 4);
const foodOnly = (p) => p.category.length === 1 && p.category[0] === "Food";

// A route of exactly `days` days within the drive limit, by the builder's rules: blocks within the limit,
// each at most twice and never two days running; at most freeCap(days) free days, never two in a row, each in a town that has a
// town day (a block that starts and ends there); ending at the finish, or in any start city. Depth-first, memoised dead ends,
// after a quick check that ignores the block rules: without it a finish out of reach (Queenstown to Christchurch at 2 hours a
// day) makes the depth-first search try every route.
function withinLimitRouteExists(start, days, drive, end) {
  const cap = freeCap(days), blocks = data.blocks.filter((b) => b.driveMinutes <= drive), dead = new Set();
  const done = (town) => (end ? town === end : data.starts.includes(town));
  let reach = new Set([start + "|0|0"]); // town|free days|yesterday free
  for (let d = 0; d < days; d++) {
    const next = new Set();
    for (const s of reach) {
      const [town, free, wasFree] = s.split("|");
      if (stays.has(town) && +free < cap && wasFree === "0") next.add(town + "|" + (+free + 1) + "|1");
      for (const b of blocks) if (b.startTown === town) next.add(b.endTown + "|" + free + "|0");
    }
    reach = next;
  }
  if (![...reach].some((s) => done(s.split("|")[0]))) return false;
  let calls = 0;
  const go = (town, left, free, last, uses) => {
    if (++calls > 2e6) throw new Error(`route search too big: ${start} to ${end || "any start town"}, ${days} days, ${drive} min`);
    if (!left) return done(town);
    const key = [town, left, free, last, JSON.stringify(uses)].join("|");
    if (dead.has(key)) return false;
    if (stays.has(town) && free < cap && last !== "~free" && go(town, left - 1, free + 1, "~free", uses)) return true;
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
        const b = blockOf(d);
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

test("free days: never two in a row", () => {
  for (const { answers, options } of sweep) for (const o of options)
    o.days.forEach((d, i) => assert.ok(!(d.free && i && o.days[i - 1].free), `${name(answers)} ${o.key} days ${i} and ${i + 1}`));
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
    // a favourite day may go back to a place the trip has been to (owner, 2026-11-24); it doesn't count as a second visit here
    const all = o.days.flatMap((d) => d.items.filter((it) => !favouriteStop(d, it)).map((it) => it.siteId));
    for (const d of o.days) for (const it of d.items) {
      assert.ok(data.places[it.siteId], it.siteId);
      const added = !blockOf(d).items.some((x) => x.siteId === it.siteId);
      // a hand-checked block keeps its own repeats; a stop the builder adds is never anywhere else in the trip
      if (added && !favouriteStop(d, it)) assert.equal(all.filter((id) => id === it.siteId).length, 1, `${name(answers)} ${o.key} adds ${it.siteId} twice`);
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

// The day's driving the app's way: each leg that crosses from one area to another (getLeg's drive), from the
// last stop of the nearest earlier day with stops (else the block's start town hub) through the day's stops.
function appDrive(o, i) {
  const d = o.days[i];
  if (!d.items.length) return 0;
  const prev = o.days.slice(0, i).reverse().find((x) => x.items.length);
  let from = prev ? prev.items[prev.items.length - 1].siteId : pack.hubs[blockOf(d).startTown], slots = 0;
  for (const it of d.items) {
    const leg = pack.getLeg(from, it.siteId, lookup);
    if (leg.drive) slots += leg.slots;
    from = it.siteId;
  }
  return slots * 30;
}

test("drive limit: marked from the driving the app shows for the day", () => {
  for (const { answers, options } of sweep) {
    for (const o of options) o.days.forEach((d, i) => {
      const mins = appDrive(o, i);
      assert.equal(!!d.overLimit, mins > answers.drive, `${name(answers)} ${o.key} day ${i + 1}: ${mins} min`);
      if (!d.free) assert.equal(d.driveMinutes, mins, `${name(answers)} ${o.key} day ${i + 1}`);
    });
    // the search keeps to the limit by the blocks' estimate when a route within it exists
    const built = options.find((o) => o.kind === "built");
    if (built && withinLimitRouteExists(answers.start, answers.days, answers.drive, answers.end))
      assert.ok(!built.days.some((d) => d.block && blockOf(d).driveMinutes > answers.drive), name(answers) + " has a route within the limit");
  }
});

test("a day with no stops is a free day", () => {
  // Picton 17d/2h food off: a block's second use loses every stop to the repeats dropped (day 15)
  const picton = { answers: { ...base, start: "picton", days: 17, drive: 120, food: false } };
  picton.options = buildTrips(data, pack, picton.answers);
  for (const { answers, options } of sweep.concat([picton])) for (const o of options)
    o.days.forEach((d, i) => assert.equal(!d.items.length, !!d.free, `${name(answers)} ${o.key} day ${i + 1}`));
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
    const items = blockOf(d).items;
    // in a built trip a non-Food place an earlier day had is dropped too; that isn't Easy's doing
    const gone = items.filter((x) => !d.items.some((it) => it.siteId === x.siteId) &&
      !(o.kind === "built" && !foodOnly(data.places[x.siteId]) && before.has(x.siteId)));
    d.items.forEach((it) => before.add(it.siteId));
    // a built day may also swap a sight that is neither featured nor a match for the answers for one of its towns' main
    // attractions: one such stop gone for each featured place the day gained; anything else gone is Easy's one walk
    const fit = (p) => answers.vibes.some((v) => p.vibe.includes(v)) || answers.into.some((c) => p.category.includes(c)) || answers.activities.some((x) => p.activities.includes(x));
    const weak = (x) => { const p = data.places[x.siteId]; return o.kind === "built" && !p.featured && !foodOnly(p) && !fit(p); };
    const gained = o.kind === "built" ? d.items.filter((it) => data.places[it.siteId].featured && !items.some((x) => x.siteId === it.siteId)).length : 0;
    const strong = gone.filter((x) => !weak(x));
    assert.ok(strong.length <= 1 && gone.length <= 1 + gained, `${name(answers)} ${o.key} ${d.block}`);
    for (const x of strong) {
      const p = data.places[x.siteId];
      assert.ok(items.length > 3 && !p.featured && p.category.includes("Walks"), `${name(answers)} ${p.id}`);
      assert.ok(items.filter((y) => data.places[y.siteId].category.includes("Walks")).length >= 2, `${name(answers)} only walk ${p.id}`);
    }
    }
  }
});

// Could some place in the day's end or start town, not in the trip or its blocks and not Food-only, still go in?
// Same rules as the builder: after a stop in its own area (first: the day's first stop is in its area, or it's in
// the start town; with arrive: also where the day has arrived in its end town), nothing else moves, it ends by 6 PM (8 PM if
// outdoors only), the day is a packTrip fixed point, and it is on the way (a thin day's 40 km) from the stop before it, or
// where yesterday ended, to the stop after it, or where the day leads (tomorrow's first stop that stays: food off drops a café);
// on a rest day (rest) the traveller stays based in town, so no direction.
const OUTDOORS = ["Walks", "Scenic", "Nature", "Water"];
function someCandidateFits(o, i, opts = {}) {
  const d = o.days[i], b = blockOf(d) || { id: "free", startTown: d.town, endTown: d.town, driveMinutes: 0, items: [] };
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(x.block ? blockOf(x).items.map((it) => it.siteId) : [])));
  const prev = o.days.slice(0, i).reverse().find((x) => x.items.length);
  const prevDay = { items: prev ? [prev.items[prev.items.length - 1]] : [] };
  const items = d.items.map((it) => ({ ...it }));
  const next = o.days[i + 1], nb = next && blockOf(next);
  const nf = nb && nb.items.find((it) => opts.food !== false || !foodOnly(data.places[it.siteId]));
  const ahead = nf ? data.places[nf.siteId] : townSpot(data, pack, next ? (nb ? nb.endTown : b.endTown) : o.end);
  const cands = [b.endTown, b.startTown].flatMap((t) => (data.towns[t] ? data.towns[t].placeIds : []))
    .map((id) => data.places[id]).filter((p) => !taken.has(p.id) && !foodOnly(p) && !ONE_DAY.includes(p.id)); // nor a place open one day a week
  for (const p of cands) for (let pos = 0; pos <= items.length; pos++) {
    const after = pos ? items[pos - 1] : items[0];
    const arrived = opts.arrive && p.area === b.endTown && items.slice(pos).every((it) => data.places[it.siteId].area === b.endTown);
    if (after && data.places[after.siteId].area !== p.area && !(pos === 0 && p.area === b.startTown) && !arrived) continue;
    if (!onWayT(pos ? data.places[items[pos - 1].siteId] : prev ? data.places[prev.items[prev.items.length - 1].siteId] : townSpot(data, pack, b.startTown), p, pos < items.length ? data.places[items[pos].siteId] : opts.rest ? null : ahead, 40)) continue;
    const trial = items.slice();
    trial.splice(pos, 0, { siteId: p.id, siteName: p.name, slotIndex: pos ? after.slotIndex + after.durationSlots : 0, durationSlots: p.slots });
    const out = pack.packTrip([prevDay, { items: trial }], lookup)[1].items;
    if (!out.every((it, k) => k === pos || it.slotIndex === trial[k].slotIndex)) continue;
    const end = p.category.every((c) => OUTDOORS.includes(c)) ? 24 : 20;
    if (out[pos].slotIndex + p.slots > end) continue;
    const again = pack.packTrip([prevDay, { items: out }], lookup)[1].items;
    if (again.every((it, k) => it.slotIndex === out[k].slotIndex && it.slotIndex + it.durationSlots <= 28)) return p.id;
  }
  return null;
}

test("built days have at least 2 non-Food stops unless nothing more fits", () => {
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    if (d.free) return;
    const sights = d.items.filter((it) => !foodOnly(data.places[it.siteId])).length;
    if (sights < 2) assert.equal(someCandidateFits(o, i, { food: answers.food }), null, `${name(answers)} ${o.key} day ${i + 1} has ${sights}`);
  });
});

test("built trips never repeat a place, except Food places and a town's favourites on a day with no other sight", () => {
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const day = {};
    o.days.forEach((d, i) => d.items.forEach((it) => {
      if (foodOnly(data.places[it.siteId]) || favouriteStop(d, it)) return;
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
  // its rest days are days in town (owner, 2026-11-24), never two in a row; hand-checked days at most twice, never two days running
  assert.ok(o.days.some((d) => d.block === "rest-" + d.town));
  o.days.forEach((d, i) => { if (i) assert.notEqual(d.block, o.days[i - 1].block); });
  const uses = {};
  for (const d of o.days) if (blockById[d.block]) uses[d.block] = (uses[d.block] || 0) + 1;
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

test("every returned day passes the final check, whatever removed or added its stops", () => {
  // A packTrip that pushes the last stop past 10 PM on any day with more than 3 stops: such a day can never fit,
  // so the builder must cut it, on every path (food off, Easy, repeats dropped, adds, suggested days).
  const strict = { ...pack, packTrip: (days, look) => pack.packTrip(days, look).map((d) =>
    d.items.length > 3 ? { ...d, items: d.items.map((it, k) => (k === d.items.length - 1 ? { ...it, slotIndex: 28 } : it)) } : d) };
  for (const a of [{ start: "queenstown", days: 10, food: false }, { start: "dunedin", days: 12, pace: "easy", food: false }, { start: "invercargill", days: 21, drive: 120, pace: "hikes" }]) {
    const options = buildTrips(data, strict, { ...base, ...a });
    assert.ok(options.length >= 1);
    for (const o of options) for (const d of o.days) assert.ok(d.items.length <= 3, `${o.key} ${d.block} has ${d.items.length}`);
  }
});

test("2 days from every start town: a trip with places on both days and the app's timing (owner, 2026-11-23)", () => {
  for (const start of data.starts) for (const drive of [120, 360]) for (const pace of ["easy", "hikes"]) {
    const a = { start, days: 2, drive, pace };
    const options = ask(a);
    assert.ok(options.length >= 1, name({ ...base, ...a }));
    for (const o of options) {
      assert.equal(o.days.length, 2, o.key);
      assert.ok(o.days.every((d) => d.items.length), o.key + " has an empty day");
      assert.ok(data.starts.includes(o.end), o.key);
      const out = pack.packTrip(o.days.map((d, i) => ({ id: "d" + i, items: d.items.map((it) => ({ ...it, id: it.siteId })) })), lookup);
      out.forEach((d, i) => d.items.forEach((it, k) => assert.equal(it.slotIndex, o.days[i].items[k].slotIndex, o.key)));
      if (o.kind === "built") {
        const ids = o.days.flatMap((d) => d.items.map((it) => it.siteId));
        assert.equal(new Set(ids).size, ids.length, o.key + " repeats a place");
      }
    }
  }
  // Nelson's one block out leads away, so no 2-day route comes back to a start town: two days in Nelson, from its own places
  const nelson = ask({ start: "nelson", days: 2 });
  assert.deepEqual(nelson.map((o) => o.key), ["built-nelson-2-loop"]);
  assert.ok(nelson[0].days.every((d) => d.town === "nelson" && d.items.length >= 3), JSON.stringify(nelson[0].days.map((d) => d.items.length)));
  assert.ok(nelson[0].days.every((d) => d.items.every((it) => data.towns.nelson.placeIds.includes(it.siteId))));
});

test("a chosen finish: back to the start gives loops only, another town gives one-ways there only (owner, 2026-11-23)", () => {
  for (const [start, end, days] of [["queenstown", "queenstown", 7], ["queenstown", "christchurch", 7], ["christchurch", "queenstown", 10], ["picton", "christchurch", 4], ["dunedin", "invercargill", 5], ["nelson", "nelson", 3]]) {
    const options = ask({ start, end, days });
    assert.ok(options.length >= 1, `${start} to ${end} in ${days}`);
    for (const o of options) {
      assert.equal(o.end, end, o.key);
      assert.equal(o.days.length, days, o.key);
      assert.ok(o.days.every((d) => d.items.length || d.free), o.key);
    }
  }
  // no end given: as before, a loop and a one-way when it scores as well
  assert.ok(ask({ start: "queenstown", days: 7 }).some((o) => o.end === "queenstown"));
  // a stay in town only when every day gets places: Invercargill has two days' worth
  assert.equal(ask({ start: "invercargill", end: "invercargill", days: 2 }).length, 1);
  assert.equal(ask({ start: "invercargill", end: "invercargill", days: 4 }).length, 0);
});

test("the owner's town ranking: every town once, in the owner's order; built trips sleep in the Catlins and Dunedin, not Invercargill, Timaru or Ōamaru", () => {
  assert.deepEqual([...TOWNS_RANKED].sort(), Object.keys(data.towns).sort(), "every builder town, once");
  const rank = (t) => TOWNS_RANKED.indexOf(t);
  for (const [a, b] of [["christchurch", "dunedin"], ["wanaka", "tekapo"], ["picton", "blenheim"], ["catlins", "invercargill"], ["dunedin", "timaru"], ["dunedin", "oamaru"]]) assert.ok(rank(a) < rank(b), a + " above " + b);
  const nights = {}; // nights away from the start and the finish
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.slice(0, -1).forEach((d) => {
    if (d.town !== answers.start && d.town !== o.end) nights[d.town] = (nights[d.town] || 0) + 1;
  });
  assert.ok((nights.catlins || 0) >= 3 * (nights.invercargill || 0), JSON.stringify(nights));
  assert.ok((nights.dunedin || 0) > 0 && !nights.timaru && !nights.oamaru, JSON.stringify(nights));
});

test("main attractions: built trips take in most of the featured places in the towns they sleep in (owner, 2026-11-23)", () => {
  let could = 0, have = 0;
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const inTrip = new Set(o.days.flatMap((d) => d.items.map((it) => it.siteId)));
    for (const t of new Set(o.days.slice(0, -1).map((d) => d.town))) for (const id of data.towns[t].placeIds) {
      const p = data.places[id];
      if (!p.featured || foodOnly(p) || (p.category.includes("Walks") && p.slots >= 4 && answers.pace !== "hikes")) continue;
      could++; if (inTrip.has(id)) have++;
    }
  }
  assert.ok(have / could >= 0.6, (100 * have / could).toFixed(0) + "% of " + could);
});

test("town ranking in the route's cost: a good town draws the route there once; a poor town costs every night and every free day", () => {
  assert.ok(townCost("queenstown", "|dunedin|", false) < 0, "a good town draws the route on arrival");
  assert.equal(townCost("queenstown", "|dunedin|queenstown|", false), 0, "and not again");
  assert.ok(townCost("invercargill", "|dunedin|", false) > 0, "a poor town costs");
  assert.equal(townCost("invercargill", "|dunedin|invercargill|", false), townCost("invercargill", "|dunedin|", false), "every night");
  assert.equal(townCost("queenstown", "|queenstown|", true), 0, "no pull to sit out a free day in a good town");
  assert.ok(townCost("invercargill", "|invercargill|", true) > 0, "a free day in a poor town costs");
  assert.ok(townCost("catlins", "|", false) < townCost("invercargill", "|", false) && townCost("dunedin", "|", false) < townCost("oamaru", "|", false));
});

test("main attractions: built days top up their towns' featured places to the pace's cap, and swap a weak sight for one", () => {
  assert.deepEqual(TOP_UP, { easy: 4, some: 5, hikes: 6 });
  const spread = sweep.filter((_, i) => i % 7 === 0);
  const featured = () => spread.reduce((n, { answers }) => n + buildTrips(data, pack, answers).filter((o) => o.kind === "built")
    .reduce((m, o) => m + o.days.reduce((k, d) => k + d.items.filter((it) => data.places[it.siteId].featured).length, 0), 0), 0);
  const on = featured(), keep = { ...TOP_UP };
  let off;
  try { Object.assign(TOP_UP, { easy: 0, some: 0, hikes: 0 }); off = featured(); } finally { Object.assign(TOP_UP, keep); }
  assert.ok(on > off, `featured places in built trips: ${on} with the top-up, ${off} without`);
  // a swap: a block sight that is neither featured nor a match is gone (not to a repeat, not Easy's trim) and a featured place is in
  const weak = (p, x) => !p.featured && !foodOnly(p) && !(x.vibes.some((v) => p.vibe.includes(v)) || x.into.some((c) => p.category.includes(c)) || x.activities.some((y) => p.activities.includes(y)));
  let swapped = 0;
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built" && answers.pace !== "easy") {
    const earlier = new Set();
    for (const d of o.days) {
      const inBlock = new Set(blockOf(d) ? blockOf(d).items.map((x) => x.siteId) : []);
      if (!d.free && d.items.some((it) => !inBlock.has(it.siteId) && data.places[it.siteId].featured) &&
        blockOf(d).items.some((x) => !earlier.has(x.siteId) && !d.items.some((it) => it.siteId === x.siteId) && weak(data.places[x.siteId], answers))) swapped++;
      d.items.forEach((it) => earlier.add(it.siteId));
    }
  }
  assert.ok(swapped >= 3, `swapped ${swapped}`);
});

// The direction rule written out again, as the spec the builder's onWay is held to.
const kmT = (p, q) => { const r = Math.PI / 180, x = (q.lng - p.lng) * r * Math.cos((p.lat + q.lat) * r / 2), y = (q.lat - p.lat) * r; return 6371 * Math.sqrt(x * x + y * y); };
function onWayT(p, c, q, slack) {
  if (!p || !q || !c) return true;
  const direct = kmT(p, q), pc = kmT(p, c), cq = kmT(c, q), town = direct < 15;
  if (pc + cq - direct > Math.max(town ? 40 : slack || 10, 0.15 * direct)) return false;
  return !(pc > direct + (town ? 20 : 10) || cq > direct + (town ? 20 : 10));
}
const spotT = (town) => data.places[pack.hubs[town]] || townSpot(data, pack, town);

test("one direction: a place the builder adds is on the way, not back the way the trip came (owner, 2026-11-23)", () => {
  // made-up points on one line of longitude: 0.009 degrees of latitude is 1 km
  const at = (k) => ({ lat: -43 - k * 0.009, lng: 170 });
  const cases = [
    // [a, c, b, slack, on the way?, what]
    [at(0), at(50), at(100), 0, true, "between the two"],
    [at(0), at(104), at(100), 0, true, "4 km past the far end: 8 km extra"],
    [at(0), at(108), at(100), 0, false, "8 km past: 16 km extra, over 15% of 100"],
    [at(0), at(-4), at(100), 0, true, "4 km behind the start"],
    [at(0), at(-12), at(100), 0, false, "12 km behind the start"],
    [at(0), at(-12), at(100), 40, false, "12 km behind, even filling a thin day"],
    [at(0), { lat: at(50).lat, lng: 170.22 }, at(100), 40, true, "18 km to one side, filling a thin day"],
    [at(0), { lat: at(50).lat, lng: 170.22 }, at(100), 0, true, "18 km to one side adds 6 km: fine"],
    [at(0), { lat: at(50).lat, lng: 170.5 }, at(100), 0, false, "40 km to one side: 28 km extra"],
    [at(0), { lat: at(50).lat, lng: 170.5 }, at(100), 40, true, "40 km to one side, filling a thin day"],
    [at(0), at(18), at(2), 0, true, "in one town: 18 km out and back"],
    [at(0), at(24), at(2), 0, false, "in one town: 24 km away is too far"],
    [at(0), at(18), at(2), 40, true, "in one town, thin day: the same 20 km reach"],
  ];
  for (const [p, c, q, slack, want, what] of cases) {
    assert.equal(onWay(p, c, q, slack || undefined), want, what);
    assert.equal(onWayT(p, c, q, slack || undefined), want, "spec: " + what);
  }
  assert.ok(onWay(null, at(5), at(9)) && onWay(at(0), { lat: -43 }, at(9)), "nothing to go by, or half a position: passes");
  const kaikoura = data.places["whale-watch-kaikoura"], gore = data.places["cathedral-cliffs-gore-bay"];
  assert.ok(!onWay(kaikoura, gore, kaikoura) && onWay(kaikoura, data.places["fyffe-house"], kaikoura), "Gore Bay and back from Kaikōura: no; a place in town: yes");
  // every town a block starts or ends in, and every start, has a position to go by (Wānaka's hub is not in the data)
  const towns = new Set([...data.starts, ...data.blocks.flatMap((x) => [x.startTown, x.endTown])]);
  for (const town of towns) { const s = townSpot(data, pack, town); assert.ok(s && typeof s.lat === "number" && typeof s.lng === "number", town); }
  assert.ok(!data.places[pack.hubs.wanaka] && townSpot(data, pack, "wanaka"), "Wānaka: the middle of its places");
  // the owner's trip: Picton to Christchurch in 3 days no longer opens its Kaikōura day 60 km south at Cathedral Cliffs
  for (const o of ask({ start: "picton", end: "christchurch", days: 3, pace: "easy", drive: 120 })) {
    const day2 = o.days[1].items.map((it) => it.siteId);
    assert.ok(!(day2.includes("whale-watch-kaikoura") && day2.indexOf("cathedral-cliffs-gore-bay") === 0), o.key + ": " + day2.join(" > "));
  }
  // no dead-end side trip on the way to Wānaka, and a picked activity in town still goes in
  for (const o of ask({ start: "queenstown", end: "queenstown", days: 10, drive: 120, pace: "easy", food: false }))
    assert.ok(!o.days.some((d) => d.items.some((it) => it.siteId === "the-craypot-jackson-bay")), o.key + " goes to Jackson Bay");
  // across the sweep: each stop a built trip adds, where it ends up, is on the way between its neighbours (40 km: a thin day's reach)
  let added = 0; const off = [];
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    // a rest day is based in its town, in it or out to a nearby town and back: out and back by nature (owner, 2026-11-24)
    const away = (d) => /^rest-/.test(d.block || "");
    const flat = o.days.flatMap((d, di) => d.items.map((it) => ({ it, di, own: !!blockOf(d) && blockOf(d).items.some((x) => x.siteId === it.siteId), away: away(d) })));
    flat.forEach((s, k) => {
      if (s.own || s.away) return;
      added++;
      const p = k ? data.places[flat[k - 1].it.siteId] : spotT(answers.start), q = k + 1 < flat.length ? data.places[flat[k + 1].it.siteId] : spotT(o.end);
      if (!onWayT(p, data.places[s.it.siteId], q, 40)) off.push(name(answers) + " " + o.key + " day " + (s.di + 1) + " " + s.it.siteId);
    });
  }
  assert.ok(added > 500 && off.length / added < 0.01, `${off.length} of ${added} added stops double back: ${off.slice(0, 8).join("; ")}`);
});

test("no holes: a stop taken out of a day doesn't leave its time empty (owner, 2026-11-23)", () => {
  // Christchurch's day: gardens 9-11, punting 11:30, lunch 1 PM, tram 2:30, gallery 4, river walk 5:30, a half-hour hop between each
  const C = blockById["christchurch-botanic-gardens..avon-river-walk"], copy = (b) => b.items.map((it) => ({ ...it }));
  const slots = (b, out) => { const before = copy(b); return closeUp(pack, lookup, null, before, before.filter((it) => !out.includes(it.siteId))).map((it) => it.slotIndex); };
  assert.deepEqual(C.items.map((it) => it.slotIndex), [2, 7, 10, 13, 16, 19]);
  assert.deepEqual(slots(C, []), [2, 7, 10, 13, 16, 19], "nothing out: the day as it is");
  assert.deepEqual(slots(C, ["little-high-eatery"]), [2, 7, 10, 13, 16], "lunch out: the afternoon moves up into its place");
  assert.deepEqual(slots(C, ["punting-on-the-avon"]), [2, 8, 11, 14, 17], "a sight out before lunch: lunch moves an hour at most, the rest keep their pauses");
  assert.deepEqual(slots(C, ["christchurch-botanic-gardens"]), [2, 8, 11, 14, 17], "the first stop out: the next starts when the day did");
  assert.deepEqual(slots(C, ["christchurch-tram", "christchurch-art-gallery"]), [2, 7, 10, 13], "two out in a row: one hole, closed");
  assert.deepEqual(slots(C, ["avon-river-walk"]), [2, 7, 10, 13, 16], "the last stop out: nothing moves");
  // a day that ends at night (Dark Sky at 9:30 PM) keeps its times: closing up would only lengthen the wait for dark
  const N = blockById["fairlie-bakehouse..dark-sky-project-summit-experience"];
  assert.deepEqual(N.items.map((it) => it.slotIndex), [8, 11, 27]);
  assert.deepEqual(slots(N, ["fairlie-bakehouse"]), [11, 27]);
  // nothing ever moves later, whatever goes; and two stops with nothing taken out between them keep the pause they had
  // (a meal aside: it is held to within an hour of its time), so only the hole closes
  let kept2 = 0;
  for (const b of data.blocks) for (const out of b.items) {
    const before = copy(b), kept = before.filter((it) => it.siteId !== out.siteId), was = packed(kept), now = closeUp(pack, lookup, null, before, kept);
    now.forEach((it, k) => assert.ok(it.slotIndex <= was[k].slotIndex, b.id + " without " + out.siteId + ": " + it.siteId));
    const gone = b.items.findIndex((it) => it.siteId === out.siteId);
    now.forEach((it, k) => {
      if (!k || k === gone || foodOnly(lookup(it.siteId))) return; // k === gone: the stop after the hole
      kept2++;
      assert.equal(it.slotIndex - now[k - 1].slotIndex, was[k].slotIndex - was[k - 1].slotIndex, b.id + " without " + out.siteId + ": the pause before " + it.siteId);
    });
  }
  assert.ok(kept2 > 100, "pauses checked: " + kept2);
  // some day's own pause is longer than the hop needs (so the check above is not only about hops)
  assert.ok(data.blocks.some((b) => b.items.some((it, k) => k && !foodOnly(lookup(it.siteId)) && it.slotIndex - (b.items[k - 1].slotIndex + b.items[k - 1].durationSlots) > pack.getLeg(b.items[k - 1].siteId, it.siteId, lookup).slots)));
  // across the sweep: where a stop was taken out between two of a day's own stops, the second follows the first with no
  // idle time, unless it is a meal (held to within an hour) or the day ends at night; and few long idle stretches are left
  let days = 0, long = 0; const holes = [];
  for (const { answers, options } of sweep) for (const o of options) for (const d of o.days) {
    if (!d.items.length) continue;
    days++;
    const b = blockOf(d), night = d.items.findLastIndex((it) => it.slotIndex >= 22 && !foodOnly(lookup(it.siteId)));
    d.items.forEach((c, i) => {
      if (!i || i <= night || foodOnly(lookup(c.siteId))) return;
      const a = d.items[i - 1], idle = c.slotIndex - (a.slotIndex + a.durationSlots) - pack.getLeg(a.siteId, c.siteId, lookup).slots;
      if (idle >= 4) long++;
      const ia = b ? b.items.findIndex((x) => x.siteId === a.siteId) : -1, ib = b ? b.items.findIndex((x) => x.siteId === c.siteId) : -1;
      if (idle > 0 && ia >= 0 && ib > ia + 1) holes.push(name(answers) + " " + o.key + " " + d.block + ": " + idle * 30 + " min before " + c.siteId);
    });
  }
  assert.equal(holes.length, 0, holes.length + " holes, e.g. " + holes.slice(0, 5).join("; "));
  assert.ok(days > 5000 && long / days < 0.01, long + " of " + days + " days have two idle hours or more that no meal or night stop explains");
});

test("a hole before a meal takes a nearby place when one fits (owner, 2026-11-23)", () => {
  // A meal is held near its time, so stops taken out before it can leave two idle hours or more. The rule, written again
  // here: a place in the town of the stop before the hole or in the meal's own town, not food, a long walk only for Lots of
  // walking, not in the trip or its days' blocks, on the way from that stop to the meal (a thin day's 40 km reach at most),
  // timed straight after that stop without moving any other stop, done by 6 PM (8 PM outdoors). Where such a place
  // exists, the hole must not be left.
  const longWalkT = (p) => p.category.includes("Walks") && p.slots >= 4;
  const endT = (p) => (p.category.every((c) => ["Walks", "Scenic", "Nature", "Water"].includes(c)) ? 24 : 20);
  const idleT = (a, c) => c.slotIndex - (a.slotIndex + a.durationSlots) - pack.getLeg(a.siteId, c.siteId, lookup).slots;
  let holes = 0, meals = 0; const open = [], foodFirst = [];
  for (const { answers, options } of sweep) for (const o of options) {
    const planned = new Set(o.days.flatMap((d) => (blockOf(d) ? blockOf(d).items.map((x) => x.siteId) : [])));
    const inTrip = new Set(o.days.flatMap((d) => d.items.map((it) => it.siteId)));
    let prevLast = null;
    for (const d of o.days) {
      d.items.forEach((m, i) => {
        if (!i || !foodOnly(lookup(m.siteId))) return;
        meals++;
        const a = d.items[i - 1];
        // nothing the builder adds straight before a meal is itself food
        if (foodOnly(lookup(a.siteId)) && !(blockOf(d) && blockOf(d).items.some((x) => x.siteId === a.siteId))) foodFirst.push(o.key + " " + d.block + ": " + a.siteId);
        if (idleT(a, m) < 4) return;
        holes++;
        const fit = Object.values(data.places).find((p) => {
          if ((p.area !== lookup(a.siteId).area && p.area !== lookup(m.siteId).area) || foodOnly(p) || (answers.pace !== "hikes" && longWalkT(p)) || planned.has(p.id) || inTrip.has(p.id) || ONE_DAY.includes(p.id)) return false;
          if (!onWayT(lookup(a.siteId), p, lookup(m.siteId), 40)) return false;
          const trial = d.items.map((it) => ({ siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots }));
          trial.splice(i, 0, { siteId: p.id, siteName: p.name, slotIndex: a.slotIndex + a.durationSlots, durationSlots: p.slots });
          const out = pack.packTrip([{ items: prevLast ? [prevLast] : [] }, { items: trial }], lookup)[1].items;
          return out.every((it, k) => k === i || it.slotIndex === trial[k].slotIndex) && out[i].slotIndex + p.slots <= endT(p);
        });
        if (fit) open.push(name(answers) + " " + o.key + " " + d.block + ": " + idleT(a, m) * 30 + " min before " + m.siteId + " could take " + fit.id);
      });
      if (d.items.length) prevLast = d.items[d.items.length - 1];
    }
  }
  console.log(`holes before a meal: ${holes} of ${meals} meals in the sweep`);
  assert.equal(open.length, 0, open.length + " holes a place would fit, e.g. " + open.slice(0, 4).join("; "));
  assert.ok(holes < 60, holes + " holes before a meal left (115 before the fill)");
  assert.deepEqual(foodFirst, []);
  // what may go in: a sight the builder may add by itself (not food; a long walk only for Lots of walking), and not in the trip
  const cafe = Object.values(data.places).find(foodOnly), walk = Object.values(data.places).find((p) => longWalkT(p) && !foodOnly(p)), sight = Object.values(data.places).find((p) => !foodOnly(p) && !longWalkT(p));
  for (const pace of ["easy", "some", "hikes"]) {
    assert.equal(mayAdd(cafe, { pace }), false, "food, " + pace);
    assert.equal(mayAdd(walk, { pace }), pace === "hikes", "a long walk, " + pace);
    assert.equal(mayAdd(sight, { pace }), true, "a sight, " + pace);
  }
  assert.match(bsrc, /\.filter\(function \(p\) \{ return spare\(p\) && mayAdd\(p, ans\); \}\), ans\);\n      if \(!add\(into, into\.length, undefined, g\)\) add\(into, into\.length, 40, g\);/);
  // only before a meal (the wait for dark on a stargazing day stays as it is: owner, 2026-11-23), only a hole of two hours
  assert.match(bsrc, /if \(!foodOnly\(places\[items\[g\]\.siteId\]\) \|\| idleBefore\(pack, look, items, g\) < HOLE\) continue;/);
  assert.match(bsrc, /var MEAL_EARLY = 2, NIGHT = 22, HOLE = 4;/);
  // the meal's own town counts as nearby for this fill only; every other add stays in the town of the stop before it
  assert.match(bsrc, /\|\| \(at != null && pos < items\.length && look\(items\[pos\]\.siteId\)\.area === p\.area\)\s*\|\|/);
  // the Abel Tasman day whose two walks go for Easy: the morning no longer runs empty to dinner
  for (const o of ask({ start: "christchurch", end: "picton", days: 14, pace: "easy", drive: 240, vibes: ["nature"], into: ["Scenic"] })) {
    const d = o.days.find((x) => x.block === "toad-hall-motueka..park-cafe-marahau@abel-tasman");
    if (!d) continue;
    const m = d.items.findIndex((it) => it.siteId === "park-cafe-marahau");
    if (m > 0) assert.ok(idleT(d.items[m - 1], d.items[m]) < 4 * 3, o.key + ": " + d.items.map((it) => it.siteId + "@" + it.slotIndex).join(" "));
  }
});

test("a place open one day a week is never added (owner, 2026-11-23: Motueka Sunday Market)", () => {
  // the builder doesn't know which weekday a trip day falls on, so a Sunday market would land on any day
  assert.deepEqual(ONE_DAY, ["motueka-sunday-market", "nelson-saturday-market"]);
  for (const id of ONE_DAY) {
    assert.ok(data.places[id], id + " is a place");
    assert.ok(!foodOnly(data.places[id]), id + " is not food only (a food-only place is never added anyway)");
    assert.ok(!data.blocks.some((b) => b.items.some((it) => it.siteId === id)), id + " is in no hand-checked day (a day that has it would keep it)");
  }
  // every other place with a weekday in its name is food only, or a hill
  const named = Object.values(data.places).filter((p) => /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(p.name) && !ONE_DAY.includes(p.id) && !foodOnly(p)).map((p) => p.id);
  assert.deepEqual(named, ["mt-sunday-edoras-track"]);
  let stops = 0;
  for (const { answers, options } of sweep) for (const o of options) for (const d of o.days) for (const it of d.items) {
    stops++;
    assert.ok(!ONE_DAY.includes(it.siteId), name(answers) + " " + o.key + " has " + it.siteId);
  }
  assert.ok(stops > 30000);
  // the owner's case: Nelson to Christchurch in 4 days, Easy, opened day 2 at the Sunday market
  for (const o of ask({ start: "nelson", end: "christchurch", days: 4, pace: "easy", vibes: ["nature"], into: ["Scenic"] }))
    assert.ok(!o.days.some((d) => d.items.some((it) => ONE_DAY.includes(it.siteId))), o.key);
});

// Could the rest day d (free) go out to a nearby town and back? The builder's rule written again: an earlier day has stops; a
// nearby town the trip doesn't otherwise go to; one of its places (not in the trip or its blocks, not food, a long walk only
// for Lots of walking) and then one of the home town's, each ending by 6 PM (8 PM outdoors), the day a packTrip fixed point by
// 10 PM, its driving within the limit.
function dayOutFits(o, i, answers) {
  const d = o.days[i], prev = o.days.slice(0, i).reverse().find((x) => x.items.length);
  if (!prev) return null;
  const from = prev.items[prev.items.length - 1];
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(blockOf(x) ? blockOf(x).items.map((it) => it.siteId) : [])));
  const went = new Set(o.days.flatMap((x, k) => (k === i ? [] : [...(blockOf(x) ? [blockOf(x).startTown, blockOf(x).endTown, ...blockOf(x).items.map((it) => data.places[it.siteId].area)] : []), ...x.items.map((it) => data.places[it.siteId].area)])));
  const free = (t) => data.towns[t].placeIds.map((id) => data.places[id]).filter((p) => !taken.has(p.id) && mayAdd(p, answers) && !ONE_DAY.includes(p.id));
  const endBy = (p) => (p.category.every((c) => OUTDOORS.includes(c)) ? 24 : 20);
  for (const n of nearbyTowns(data, pack, d.town)) {
    if (went.has(n)) continue;
    for (const p of free(n)) for (const e of free(d.town)) {
      const out = pack.packTrip([{ items: [from] }, { items: [{ siteId: p.id, siteName: p.name, slotIndex: 0, durationSlots: p.slots }, { siteId: e.id, siteName: e.name, slotIndex: 0, durationSlots: e.slots }] }], lookup)[1].items;
      if (out[0].slotIndex + p.slots > endBy(p) || out[1].slotIndex + e.slots > endBy(e) || out[1].slotIndex + e.slots > 28) continue;
      let at = from.siteId, mins = 0;
      for (const it of out) { const leg = pack.getLeg(at, it.siteId, lookup); if (leg.drive) mins += leg.slots * 30; at = it.siteId; }
      if (mins <= answers.drive) return n + ": " + p.id + " then " + e.id;
    }
  }
  return null;
}

test("rest days: a free day of a trip is spent in its town, or out to a nearby town and back (owner, 2026-11-24)", () => {
  // the towns a day out may go to: at most 90 minutes each way (the app's drive, hub to hub), the owner's ranking first
  assert.deepEqual(nearbyTowns(data, pack, "queenstown"), ["wanaka", "arrowtown", "glenorchy"]);
  assert.deepEqual(nearbyTowns(data, pack, "christchurch"), ["banks-peninsula", "mid-canterbury"]);
  assert.deepEqual(nearbyTowns(data, pack, "kaikoura"), []);
  const area = (it) => data.places[it.siteId].area, sightsOf = (d) => d.items.filter((it) => !foodOnly(data.places[it.siteId])).length;
  let rests = 0, free = 0, away = 0, frees = 0; const towns = {};
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    const why = name(answers) + " " + o.key + " day " + (i + 1);
    if (d.free) frees++;
    if (!/^rest-/.test(d.block || "")) return;
    rests++;
    assert.equal(d.block, "rest-" + d.town, why);
    if (d.free) {
      free++;
      // left free only when nothing of the town fits and no day out does
      assert.equal(someCandidateFits(o, i, { food: answers.food, rest: true }), null, why);
      assert.equal(dayOutFits(o, i, answers), null, why);
      return;
    }
    assert.ok(d.items.every((it) => !foodOnly(data.places[it.siteId])), why + ": the builder adds no food");
    const others = [...new Set(d.items.map(area).filter((a) => a !== d.town))];
    if (!others.length) return; // a day in town
    // a day out: the nearby town's places, then back in the home town for the evening
    away++;
    const n = others[0];
    towns[d.town + " > " + n] = (towns[d.town + " > " + n] || 0) + 1;
    assert.equal(others.length, 1, why + ": one town out");
    assert.ok(nearbyTowns(data, pack, d.town).includes(n), why + ": " + n + " is not near " + d.town);
    assert.ok(d.items.slice(0, -1).every((it) => area(it) === n) && area(d.items[d.items.length - 1]) === d.town, why + ": out, then home");
    assert.ok(!d.overLimit, why + ": within the driving");
    assert.ok(sightsOf(d) >= 2 && sightsOf(d) <= TOP_UP[answers.pace], why + ": " + sightsOf(d) + " sights");
    assert.ok(o.days.slice(0, i).some((x) => x.items.length), why + ": an earlier day has stops");
    o.days.forEach((x, k) => {
      if (k === i) return;
      const xb = blockOf(x);
      assert.ok(!(xb && (xb.startTown === n || xb.endTown === n || xb.items.some((it) => area(it) === n))) && !x.items.some((it) => area(it) === n), why + ": the trip goes to " + n + " on day " + (k + 1));
    });
  });
  console.log(`rest days: ${rests}, left free: ${free}, out to a nearby town: ${away} ${JSON.stringify(towns)}; free days in built trips: ${frees}`);
  // based in town: a rest day in Wānaka takes Rob Roy Glacier Track (50 km up the valley) whichever way the trip goes next
  let robRoy = 0;
  for (const { answers, options } of sweep) if (answers.pace === "hikes") for (const o of options) if (o.kind === "built") for (const d of o.days) if (d.block === "rest-wanaka" && d.items.some((it) => it.siteId === "rob-roy-glacier-track")) robRoy++;
  assert.ok(robRoy > 0, "no rest day in Wānaka goes to Rob Roy");
  assert.ok(rests > 300 && free / rests < 0.2 && away > 0, `${free} of ${rests} rest days left free, ${away} out`);
});

test("a day out only when the town alone gives the rest day fewer than 3 sights, and it gives more (owner, 2026-11-24)", () => {
  // the same trips with no day out (rest days are filled last, so every day before the first day out is the same)
  assert.deepEqual(DAY_OUT, { slots: 3 });
  const outs = [];
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const i = o.days.findIndex((d) => /^rest-/.test(d.block) && d.items.some((it) => data.places[it.siteId].area !== d.town));
    if (i >= 0) outs.push({ answers, o, i });
  }
  assert.ok(outs.length >= 5, outs.length + " days out");
  const sightsOf = (d) => d.items.filter((it) => !foodOnly(data.places[it.siteId])).length;
  try {
    DAY_OUT.slots = 0;
    for (const { answers, o, i } of outs) {
      const stay = buildTrips(data, pack, answers).find((x) => x.key === o.key);
      assert.deepEqual(stay.days.slice(0, i), o.days.slice(0, i), o.key + ": the days before it");
      assert.ok(sightsOf(stay.days[i]) < 3 && sightsOf(stay.days[i]) < sightsOf(o.days[i]), `${name(answers)} ${o.key} day ${i + 1}: ${sightsOf(stay.days[i])} in town, ${sightsOf(o.days[i])} out`);
    }
  } finally { DAY_OUT.slots = 3; }
  // a day out that would give the rest day no more than its town does is not taken: Christchurch and back in 5 days spends
  // its rest day at Orana Wildlife Park and Godley Head rather than out to Akaroa for as many places
  for (const pace of ["easy", "some"]) {
    const o = buildTrips(data, pack, { start: "christchurch", end: "christchurch", days: 5, drive: 360, pace, food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools", "wildlife", "kayaking"] }).find((x) => x.key === "built-christchurch-5-loop");
    const d = o.days.find((x) => x.block === "rest-christchurch");
    assert.deepEqual(d.items.map((it) => it.siteId), ["orana-wildlife-park", "awaroa-godley-head-loop"], pace);
  }
});

test("a day after a rest day is timed again from where the rest day ends, not cut (owner, 2026-11-24)", () => {
  // Queenstown to Dunedin in 14 days at 2 hours a day, food off: day 10 is a rest day in Queenstown, filled after day 11 (rest
  // days are filled last) and ending at Skippers Canyon; day 11 is timed again from there and keeps the Kepler Track to Brod Bay
  const o = buildTrips(data, pack, { start: "queenstown", end: "dunedin", days: 14, drive: 120, pace: "some", food: false, vibes: [], into: [], activities: [] }).find((x) => x.key === "built-queenstown-14-oneway");
  assert.equal(o.days[9].block, "rest-queenstown");
  assert.equal(o.days[9].items.at(-1).siteId, "skippers-canyon");
  assert.deepEqual(o.days[10].items.map((it) => it.siteId), ["te-anau-glowworm-caves", "frasers-beach-manapouri", "kepler-track-brod-bay"]);
  const out = pack.packTrip(o.days.map((d, i) => ({ id: "d" + i, items: d.items.map((it) => ({ ...it, id: it.siteId })) })), lookup);
  out.forEach((d, i) => d.items.forEach((it, k) => assert.equal(it.slotIndex, o.days[i].items[k].slotIndex, "day " + (i + 1))));
});

test("a spare day in Kaikōura: a night in Hanmer on the way to or from Christchurch, else a day in Christchurch (owner, 2026-11-24)", () => {
  // the day between Kaikōura and Christchurch through Hanmer (the owner's, both ways) is split in two for a night there
  const through = (b) => !!b && [b.startTown, b.endTown].sort().join() === "christchurch,kaikoura" && b.items.some((it) => lookup(it.siteId).area === "hanmer-springs");
  assert.deepEqual(data.blocks.filter(through).map((b) => b.id).sort(), ["conical-hill-walk..little-high-eatery", "conical-hill-walk..the-pier-hotel-kaikoura"]);
  let nights = 0, left = 0, inChch = 0;
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    const why = name(answers) + " " + o.key + " day " + (i + 1), m = /^(.+)\|hanmer-springs\|([12])$/.exec(d.block || "");
    if (m) {
      assert.ok(through(blockById[m[1]]), why);
      const other = o.days[m[2] === "1" ? i + 1 : i - 1];
      assert.equal(other && other.block, m[1] + "|hanmer-springs|" + (m[2] === "1" ? "2" : "1"), why + ": the two halves, one after the other");
      if (m[2] === "1") { nights++; assert.equal(d.town, "hanmer-springs", why); }
    }
    if (d.block === "rest-christchurch") inChch++;
    // a spare day moved never lands next to another (the route's own rule)
    assert.ok(!(i && /^rest-/.test(d.block || "") && /^rest-/.test(o.days[i - 1].block || "")), why + ": two rest days in a row");
    if (d.block !== "rest-kaikoura") return;
    // a spare day left in Kaikōura only on a trip that never goes to Christchurch (so no day through Hanmer either)
    left++;
    assert.ok(answers.start !== "christchurch" && !o.days.some((x) => x.town === "christchurch"), why);
  });
  console.log(`nights in Hanmer: ${nights}; rest days in Christchurch: ${inChch}; left in Kaikōura: ${left}`);
  assert.ok(nights >= 10 && inChch >= 10, nights + " nights in Hanmer, " + inChch + " rest days in Christchurch");
  // Christchurch to Nelson in 10 days at 4 hours a day went to Kaikōura through Hanmer (day 5) and had two spare days there
  // (days 6 and 8): the first is now the night in Hanmer, the second an extra day in Christchurch, the nearest the trip is there
  const o = buildTrips(data, pack, { start: "christchurch", end: "nelson", days: 10, drive: 240, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-10-oneway");
  assert.deepEqual(o.days.map((d) => d.block), [
    "christchurch-botanic-gardens..avon-river-walk", "christchurch-gondola..he-puna-taimoana-hot-pools",
    "fairlie-bakehouse..dark-sky-project-summit-experience", "church-of-the-good-shepherd..little-high-eatery", "rest-christchurch",
    "conical-hill-walk..the-pier-hotel-kaikoura|hanmer-springs|1", "conical-hill-walk..the-pier-hotel-kaikoura|hanmer-springs|2",
    "whale-watch-kaikoura..kaikoura-peninsula-walkway", "ohau-point-seal-colony..snout-track-picton", "edwin-fox-maritime-museum..fishy-business-on-roto",
  ]);
  assert.deepEqual(o.days[5].items.slice(0, 3).map((it) => it.siteId), ["conical-hill-walk", "pjs-pies", "hanmer-springs-thermal-pools-and-spa"]);
  assert.ok(o.days[6].items.some((it) => it.siteId === "kaikoura-lookout") && o.days[6].items.some((it) => it.siteId === "the-pier-hotel-kaikoura"));
  // the morning after is spent in Hanmer (its own places first that day), Kaikōura's left for the days there
  assert.equal(lookup(o.days[6].items[0].siteId).area, "hanmer-springs", o.days[6].items.map((it) => it.siteId).join(", "));
  // on the way out too: Dunedin to Christchurch in 21 days, Lots of walking, food off, came into Kaikōura from Picton (day 18)
  // with a spare day there before the day through Hanmer to Christchurch
  const w = buildTrips(data, pack, { start: "dunedin", end: "christchurch", days: 21, drive: 240, pace: "hikes", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-dunedin-21-oneway");
  assert.deepEqual(w.days.slice(17, 20).map((d) => d.block), ["edwin-fox-maritime-museum..the-pier-hotel-kaikoura", "conical-hill-walk..little-high-eatery|hanmer-springs|1", "conical-hill-walk..little-high-eatery|hanmer-springs|2"]);
  // at 2 hours a day the day through Hanmer drove 4 hours; each half drives 2
  const t = buildTrips(data, pack, { start: "christchurch", end: "picton", days: 7, drive: 120, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-7-oneway");
  const h = t.days.findIndex((d) => /\|hanmer-springs\|1$/.test(d.block));
  assert.ok(h > 0, t.days.map((d) => d.block).join(", "));
  assert.deepEqual([t.days[h].driveMinutes, t.days[h + 1].driveMinutes, !!t.days[h].overLimit, !!t.days[h + 1].overLimit], [120, 120, false, false]);
});

test("only a food-only day places a stop where it arrives in its end town (owner, 2026-11-24)", () => {
  // the one fill that may place a stop where the day has arrived in its end town is the food-only day's; every other add keeps
  // to the stop before it in its own town. (A swap can still leave an added stop next to another town's: the main attraction
  // went in after a stop in its own town that the swap then took out.)
  assert.match(bsrc, /\n      if \(!sights\(\)\) while \(sights\(\) < 3 && \(add\(fill, fill\.length\) \|\| add\(fill, fill\.length, 40\) \|\| add\(fill, fill\.length, undefined, undefined, true\) \|\| add\(fill, fill\.length, 40, undefined, true\)\)\) \{\}\n/);
  assert.equal((bsrc.match(/add\([^()]*, true\)/g) || []).length, 2, "arrive is passed by the food-only fill only");
  assert.match(bsrc, /townSpot\(data, pack, b\.startTown\), at, arrive \? b\.endTown : null\);/);
  assert.match(bsrc, /\|\| \(!!arrive && p\.area === arrive && items\.slice\(pos\)\.every\(function \(it\) \{ return look\(it\.siteId\)\.area === arrive; \}\)\);/);
});

test("food-only days: a day left with no sight takes its own towns' places, also where it arrives in its end town (owner, 2026-11-24)", () => {
  let n = 0, days = 0;
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    if (!d.items.length) return;
    days++;
    if (d.items.some((it) => !foodOnly(data.places[it.siteId]))) return;
    n++;
    assert.equal(someCandidateFits(o, i, { food: answers.food, arrive: true }), null, name(answers) + " " + o.key + " day " + (i + 1));
  });
  console.log(`food-only days: ${n} of ${days}`);
});

test("favourite days: a day left with no sight goes back to its town's favourites (owner, 2026-11-24)", () => {
  // Abel Tasman: Kaiteriteri Beach (a beach day); Queenstown: Queenstown Gardens, then the lakefront at Queenstown Bay Beach
  assert.deepEqual(FAVOURITES, { "abel-tasman": ["kaiteriteri-beach"], queenstown: ["queenstown-gardens", "queenstown-bay-beach"] });
  const count = {}, again = {}, seen = {};
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    if (!favs(d).length) return;
    seen[d.town] = (seen[d.town] || 0) + 1;
    const why = name(answers) + " " + o.key + " day " + (i + 1);
    // never a day there with nothing to see
    assert.ok(d.items.some((it) => !foodOnly(data.places[it.siteId])), why + ": " + d.items.map((it) => it.siteId).join(", "));
    const at = d.items.map((it, k) => (favouriteStop(d, it) ? k : -1)).filter((k) => k >= 0);
    if (!at.length) return;
    count[d.town] = (count[d.town] || 0) + 1;
    if (o.days.some((x, j) => j !== i && x.items.some((it) => favs(d).includes(it.siteId)))) again[d.town] = (again[d.town] || 0) + 1;
    // in the town's order, one after another
    assert.deepEqual(at.map((k) => d.items[k].siteId), favs(d).filter((id) => d.items.some((it) => it.siteId === id)), why);
    assert.deepEqual(at, at.map((_, j) => at[0] + j), why + ": one after another");
    // from 10 AM at the earliest when they open the day; each its own time, but the last fills the time to the next stop (less
    // the drive) or to 6 hours after the first began, done by 8 PM (an outdoor stop the builder adds)
    const first = d.items[at[0]], last = d.items[at.at(-1)], next = d.items[at.at(-1) + 1];
    if (at[0] === 0) assert.ok(first.slotIndex >= 4, why + ": opens before 10 AM");
    at.slice(0, -1).forEach((k) => assert.equal(d.items[k].durationSlots, data.places[d.items[k].siteId].slots, why));
    const to = Math.min(next ? next.slotIndex - pack.getLeg(last.siteId, next.siteId, lookup).slots : 24, first.slotIndex + 12);
    assert.equal(last.durationSlots, Math.max(data.places[last.siteId].slots, to - last.slotIndex), why);
    assert.ok(last.slotIndex + last.durationSlots <= 24, why + ": past 8 PM");
  });
  console.log(`days in towns with favourites: ${JSON.stringify(seen)}; favourite days: ${JSON.stringify(count)}, at a favourite the trip has been to: ${JSON.stringify(again)}`);
  assert.ok(count["abel-tasman"] >= 3 && again["abel-tasman"] >= 1 && count.queenstown >= 1, JSON.stringify(count));
  // Abel Tasman, the owner's case: Christchurch to Picton in 14 days, Easy, food on: day 12 was two cafés (TOAD Hall, Park Café)
  const o = buildTrips(data, pack, { start: "christchurch", end: "picton", days: 14, drive: 120, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-14-oneway");
  const d = o.days[11];
  assert.equal(d.block, "toad-hall-motueka..park-cafe-marahau@abel-tasman");
  assert.deepEqual(d.items.map((it) => it.siteId), ["toad-hall-motueka", "kaiteriteri-beach", "park-cafe-marahau"]);
  const [cafe, sand, dinner] = d.items;
  assert.equal(sand.slotIndex + sand.durationSlots, dinner.slotIndex - pack.getLeg(sand.siteId, dinner.siteId, lookup).slots, "the beach until it's time for dinner");
  assert.ok(sand.slotIndex <= cafe.slotIndex + cafe.durationSlots + pack.getLeg(cafe.siteId, sand.siteId, lookup).slots);
  // Queenstown: Queenstown to Dunedin in 14 days at 2 hours a day, food off: day 10, a rest day with nothing left in town
  const q = buildTrips(data, pack, { start: "queenstown", end: "dunedin", days: 14, drive: 120, pace: "some", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-queenstown-14-oneway");
  const qd = q.days[9];
  assert.equal(qd.block, "rest-queenstown");
  assert.deepEqual(qd.items.map((it) => [it.siteId, it.slotIndex, it.durationSlots]), [["queenstown-gardens", 4, 3], ["queenstown-bay-beach", 8, 8]], "the gardens at 10, the lakefront from noon to 4");
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
