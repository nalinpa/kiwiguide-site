import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { buildTrips, TOWNS_RANKED, townCost, TOP_UP, onWay, townSpot, closeUp, mayAdd, ONE_DAY, nearbyTowns, DAY_OUT, FAVOURITES, START_MORNING, START_PUSH, ARRIVE, AFTERNOON, MOVES, moveStops, SPARE_TOWNS, MILFORD, EARLIER, moveEarlier, dayOut, lateOk } = require("../public/plan/builder.js");
// A place's opening hours as the export gives them (half-hour slots from 8 AM, null when the app has none): the first
// half-hour it is open, and its close (owner, 2026-11-25: "carry from app")
const opensT = (p) => (p.open == null ? -Infinity : Math.ceil(p.open)), closesT = (p) => (p.close == null ? Infinity : p.close);
// A rule for spare days in a town outside the owner's five (SPARE_TOWNS, 2026-11-25: spare days there if possible) is tested
// with that town added for the while: its spare days stay where they were.
const withSpare = (towns, f) => { const n = SPARE_TOWNS.length; SPARE_TOWNS.push(...towns); try { return f(); } finally { SPARE_TOWNS.length = n; } };
// A town's favourite on a day whose only sights are its favourites (Kaiteriteri in Abel Tasman; Queenstown Gardens and Bay
// Beach) may be a place the trip has been to before
const favs = (d) => FAVOURITES[d.town] || [];
const favouriteStop = (d, it) => favs(d).includes(it.siteId) && d.items.every((x) => favs(d).includes(x.siteId) || foodOnly(data.places[x.siteId]));
// a town's favourites may come again: on a day with no other sight, and in an empty afternoon (owner, 2026-11-24)
const favouriteAgain = (d, it) => favs(d).includes(it.siteId);
const bsrc = readFileSync(new URL("../public/plan/builder.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const Q = require("../public/plan/quiz.js");
const pack = require("../public/plan/pack.js");
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const lookup = (id) => data.places[id];
// The days the website had before the two West Coast days (owner, 2026-11-25), for the tests whose sample trip they moved
const COAST_DAYS = ["buller-gorge-swingbridge..cable-bay-walkway-and-beach", "point-elizabeth-walkway..star-tavern-cape-foulwind"];
const before = { ...data, blocks: data.blocks.filter((b) => !COAST_DAYS.includes(b.id)) };
// The owner's Milford day (2026-11-25), and the days without it, for the tests whose sample trip the Milford rule moved
const MILFORD_DAY = "miles-better-pies..redcliff-te-anau";
const noMilford = (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== MILFORD_DAY) });
const blockById = Object.fromEntries(data.blocks.map((b) => [b.id, b]));
// A day's block; a day spent in town (the builder's "rest-<town>", a route's rest day, or "stay-<town>", a trip with no route
// out of its start town at all: Nelson in 2 days) stands for an empty block there
const blockOf = (d) => blockById[d.block] || halfOf(d.block) || noFood(d.block) || (/^(stay|rest)-/.test(d.block || "") ? { id: d.block, startTown: d.town, endTown: d.town, driveMinutes: 0, items: [] } : undefined);
// A block without its food ("<block>|no-food": the owner's Doubtful Sound day without the pies, owner 2026-11-24)
function noFood(id) {
  const m = /^(.+)\|no-food$/.exec(id || ""), b = m && blockById[m[1]];
  return b ? { ...b, id, items: b.items.filter((it) => !foodOnly(lookup(it.siteId))) } : undefined;
}
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
const freeCap = (days) => Math.floor(days / 4);
const foodOnly = (p) => p.category.length === 1 && p.category[0] === "Food";

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
    const all = o.days.flatMap((d) => d.items.filter((it) => !favouriteAgain(d, it)).map((it) => it.siteId));
    for (const d of o.days) for (const it of d.items) {
      assert.ok(data.places[it.siteId], it.siteId);
      const added = !blockOf(d).items.some((x) => x.siteId === it.siteId);
      // a hand-checked block keeps its own repeats; a stop the builder adds is never anywhere else in the trip
      if (added && !favouriteAgain(d, it)) assert.equal(all.filter((id) => id === it.siteId).length, 1, `${name(answers)} ${o.key} adds ${it.siteId} twice`);
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
  }
});

test("long days: allowed, each minute over the visitor's limit costing the route a little (owner, 2026-11-24)", () => {
  // the owner's route for Nelson to Queenstown in 21 days at 2 hours a day: up to Golden Bay, down to Kaikōura and Christchurch,
  // across to the West Coast, then down to Wānaka, Queenstown, Te Anau and back to Queenstown, with its long days marked
  const o = buildTrips(data, pack, { start: "nelson", end: "queenstown", days: 21, drive: 120, pace: "some", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  const towns = ["nelson"];
  o.days.forEach((d) => { if (towns.at(-1) !== d.town) towns.push(d.town); });
  assert.deepEqual(towns, ["nelson", "abel-tasman", "golden-bay", "picton", "kaikoura", "christchurch", "greymouth", "hokitika", "franz-josef", "fox-glacier", "haast", "wanaka", "queenstown", "te-anau", "queenstown"]);
  assert.ok(o.days.some((d) => d.overLimit));
  assert.match(bsrc, /var COST = \{ overMinute: 1, /);
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
    const before = new Set(), own = o.kind === "suggested" ? moveStops(o.key, o.days.map((d) => blockOf(d)), pack, lookup) : null;
    for (const [i, d] of o.days.entries()) {
    if (d.free) continue;
    const items = own ? own[i].items : blockOf(d).items; // a suggested trip's days as moved on the website (MOVES)
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
// the start town; with arrive: also where the day has arrived in its end town), nothing else moves, it starts once its place
// is open and ends by 6 PM (8 PM if it may run late) and by its close,
// the day is a packTrip fixed point, and it is on the way (a thin day's 40 km) from the stop before it, or
// where yesterday ended (before day 1: the start town's hub), to the stop after it, or where the day leads (tomorrow's first
// stop that stays: food off drops a café); on a rest day (rest) the traveller stays based in town, so no direction.
// What may run past 6 PM (owner, 2026-11-25: "doing bridle path at 6 makes no sense"; "only things that could go after 6 are
// restaurants, lookouts and west coast beaches"): somewhere to eat, a half-hour stop named a lookout, a West Coast beach
// that isn't a walk.
const WEST_COAST_T = ["westport", "punakaiki", "greymouth", "hokitika", "franz-josef", "fox-glacier", "haast"];
const lateOkT = (p) => p.category.includes("Food") || (/lookout/i.test(p.name) && p.slots <= 1) || (WEST_COAST_T.includes(p.area) && /\b(beach|bay)\b/i.test(p.name) && !p.category.includes("Walks"));
// (Lots of walking keeps the old end for now, any outdoor stop to 8 PM: "leave out lots of walking for now", owner 2026-11-25)
const OUTDOORS_T = ["Walks", "Scenic", "Nature", "Water"];
const addEndT = (p, pace) => ((pace === "hikes" ? p.category.every((c) => OUTDOORS_T.includes(c)) : lateOkT(p)) ? 24 : 20);
const endByT = (p, pace) => Math.min(addEndT(p, pace), closesT(p));
// Where the traveller is before day i: the last stop of the nearest earlier day with stops, else the start town's hub (owner,
// 2026-11-24: day 1 is timed from where the trip starts)
const fromBefore = (o, i) => o.days.slice(0, i).reverse().find((x) => x.items.length)?.items.at(-1) || { siteId: pack.hubs[o.start], slotIndex: 0, durationSlots: 1 };
function someCandidateFits(o, i, opts = {}) {
  const d = o.days[i], b = blockOf(d) || { id: "free", startTown: d.town, endTown: d.town, driveMinutes: 0, items: [] };
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(x.block ? blockOf(x).items.map((it) => it.siteId) : [])));
  const prevDay = { items: [fromBefore(o, i)] };
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
    if (!onWayT(pos ? data.places[items[pos - 1].siteId] : data.places[prevDay.items[0].siteId], p, pos < items.length ? data.places[items[pos].siteId] : opts.rest ? null : ahead, 40)) continue;
    const trial = items.slice();
    trial.splice(pos, 0, { siteId: p.id, siteName: p.name, slotIndex: Math.max(pos ? after.slotIndex + after.durationSlots : 0, opensT(p)), durationSlots: p.slots });
    const out = pack.packTrip([prevDay, { items: trial }], lookup)[1].items;
    if (!out.every((it, k) => k === pos || it.slotIndex === trial[k].slotIndex)) continue;
    if (out[pos].slotIndex + p.slots > endByT(p, opts.pace)) continue;
    const again = pack.packTrip([prevDay, { items: out }], lookup)[1].items;
    if (again.every((it, k) => it.slotIndex === out[k].slotIndex && it.slotIndex + it.durationSlots <= 28)) return p.id;
  }
  return null;
}

test("built days have at least 2 non-Food stops unless nothing more fits", () => {
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    if (d.free) return;
    const sights = d.items.filter((it) => !foodOnly(data.places[it.siteId])).length;
    if (sights < 2) assert.equal(someCandidateFits(o, i, { food: answers.food, pace: answers.pace }), null, `${name(answers)} ${o.key} day ${i + 1} has ${sights}`);
  });
});

test("built trips never repeat a place, except Food places and a town's favourites (a day with no other sight, an empty afternoon)", () => {
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const day = {};
    o.days.forEach((d, i) => d.items.forEach((it) => {
      if (foodOnly(data.places[it.siteId]) || favouriteAgain(d, it)) return;
      assert.ok(day[it.siteId] === undefined, `${name(answers)} ${o.key} ${it.siteId} on days ${day[it.siteId] + 1} and ${i + 1}`);
      day[it.siteId] = i;
    }));
  }
});

test("hand-checked days stay as they are when nothing is added or removed", () => {
  const slim = (items) => items.map((it) => [it.siteId, it.slotIndex, it.durationSlots]);
  for (const start of ["queenstown", "christchurch", "picton"]) for (const days of [3, 7, 10, 14, 21]) {
    for (const o of ask({ start, days, drive: 360 })) if (o.kind === "suggested") {
      const own = moveEarlier(moveStops(o.key, o.days.map((d) => blockById[d.block]), pack, lookup), pack, lookup); // as moved on the website (MOVES, EARLIER)
      o.days.forEach((d, i) => assert.deepEqual(slim(d.items), slim(own[i].items), `${o.key} day ${i + 1}`));
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
  // any rest day is a day in its town (owner, 2026-11-24), never two in a row; hand-checked days at most twice, never two days running
  o.days.forEach((d, i) => { if (/^rest-/.test(d.block)) assert.ok(d.block === "rest-" + d.town && !/^rest-/.test(o.days[i - 1].block), "day " + (i + 1)); });
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
        // a café may come again (Catlins Cafe in Owaka is lunch both ways round the Catlins from Dunedin, owner 2026-11-24)
        const ids = o.days.flatMap((d) => d.items.filter((it) => !foodOnly(data.places[it.siteId])).map((it) => it.siteId));
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
  // Invercargill and back goes out to Fiordland by the website-only day to Te Anau (owner, 2026-11-24): to Te Anau and back in
  // 2 days, by Queenstown in 4 (it was a stay in Invercargill in 2, and nothing in 4)
  const towns = (days) => ask({ start: "invercargill", end: "invercargill", days }).map((o) => o.days.map((d) => d.town));
  assert.deepEqual(towns(2), [["te-anau", "invercargill"]]);
  assert.deepEqual(towns(4), [["te-anau", "queenstown", "te-anau", "invercargill"]]);
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
    // (a stop moved in from the next day, EARLIER, is the trip's own; one added where the day has arrived in its town, with only
    // stops there after it, heads for the town's middle, not for tomorrow: the night is there whichever way the trip goes on)
    const flat = o.days.flatMap((d, di) => d.items.map((it, j) => ({ it, di, own: (!!blockOf(d) && blockOf(d).items.some((x) => x.siteId === it.siteId)) || EARLIER.some((m) => m.siteId === it.siteId),
      away: away(d), arrived: d.items.slice(j).every((x) => data.places[x.siteId].area === d.town) ? d.town : null })));
    flat.forEach((s, k) => {
      if (s.own || s.away) return;
      added++;
      const last = k + 1 >= flat.length || flat[k + 1].di !== s.di;
      const p = k ? data.places[flat[k - 1].it.siteId] : spotT(answers.start), q = s.arrived && last ? spotT(s.arrived) : k + 1 < flat.length ? data.places[flat[k + 1].it.siteId] : spotT(o.end);
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
  // a night stop (Dark Sky at 9:30 PM) keeps its time; the stops before it close up like any day's (owner, 2026-11-24: "tekapo
  // springs could be earlier"; it was: everything before a night stop kept its time)
  const N = blockById["fairlie-bakehouse..dark-sky-project-summit-experience"];
  assert.deepEqual(N.items.map((it) => it.slotIndex), [8, 11, 27]);
  assert.deepEqual(slots(N, ["fairlie-bakehouse"]), [8, 27]);
  const M = blockById["hooker-valley-track..dark-sky-project-summit-experience"];
  assert.deepEqual(M.items.map((it) => it.slotIndex), [0, 11, 15, 27]);
  assert.deepEqual(slots(M, ["mt-john-summit-astro-cafe"]), [0, 6 + pack.getLeg("hooker-valley-track", "tekapo-springs", lookup).slots, 27], "Tekapo Springs right after Hooker Valley and the drive");
  // nothing ever moves later, whatever goes; and two stops with nothing taken out between them keep the pause they had
  // (a meal aside: it is held to within an hour of its time), so only the hole closes
  let kept2 = 0;
  for (const b of data.blocks) for (const out of b.items) {
    const before = copy(b), kept = before.filter((it) => it.siteId !== out.siteId), was = packed(kept), now = closeUp(pack, lookup, null, before, kept);
    now.forEach((it, k) => assert.ok(it.slotIndex <= was[k].slotIndex, b.id + " without " + out.siteId + ": " + it.siteId));
    const gone = b.items.findIndex((it) => it.siteId === out.siteId);
    now.forEach((it, k) => {
      // k === gone: the stop after the hole; a night stop keeps its own time, so the wait before it may grow
      if (!k || k === gone || foodOnly(lookup(it.siteId)) || it.slotIndex >= 22) return;
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
  // timed straight after that stop (or from when it opens) without moving any other stop, done by 6 PM and by its close.
  // Where such a place exists, the hole must not be left.
  const longWalkT = (p) => p.category.includes("Walks") && p.slots >= 4;
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
          trial.splice(i, 0, { siteId: p.id, siteName: p.name, slotIndex: Math.max(a.slotIndex + a.durationSlots, opensT(p)), durationSlots: p.slots });
          const out = pack.packTrip([{ items: prevLast ? [prevLast] : [] }, { items: trial }], lookup)[1].items;
          return out.every((it, k) => k === i || it.slotIndex === trial[k].slotIndex) && out[i].slotIndex + p.slots <= endByT(p, answers.pace);
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
// for Lots of walking) and then one of the home town's, each from when it opens and ending by 6 PM and its close, the day a
// packTrip fixed point by 10 PM, its driving within the limit.
function dayOutFits(o, i, answers) {
  const d = o.days[i], prev = o.days.slice(0, i).reverse().find((x) => x.items.length);
  if (!prev) return null;
  const from = prev.items[prev.items.length - 1];
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(blockOf(x) ? blockOf(x).items.map((it) => it.siteId) : [])));
  const went = new Set(o.days.flatMap((x, k) => (k === i ? [] : [...(blockOf(x) ? [blockOf(x).startTown, blockOf(x).endTown, ...blockOf(x).items.map((it) => data.places[it.siteId].area)] : []), ...x.items.map((it) => data.places[it.siteId].area)])));
  const free = (t) => data.towns[t].placeIds.map((id) => data.places[id]).filter((p) => !taken.has(p.id) && mayAdd(p, answers) && !ONE_DAY.includes(p.id));
  for (const n of nearbyTowns(data, pack, d.town)) {
    if (went.has(n)) continue;
    for (const p of free(n)) for (const e of free(d.town)) {
      const out = pack.packTrip([{ items: [from] }, { items: [{ siteId: p.id, siteName: p.name, slotIndex: Math.max(0, opensT(p)), durationSlots: p.slots }, { siteId: e.id, siteName: e.name, slotIndex: Math.max(0, opensT(e)), durationSlots: e.slots }] }], lookup)[1].items;
      if (out[0].slotIndex + p.slots > endByT(p, answers.pace) || out[1].slotIndex + e.slots > endByT(e, answers.pace) || out[1].slotIndex + e.slots > 28) continue;
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
      assert.equal(someCandidateFits(o, i, { food: answers.food, rest: true, pace: answers.pace }), null, why);
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
    // (home early, the empty afternoon may then take more of the home town: Arrowtown in the morning, then the Frankton Track,
    // the gardens and the lakefront, since stops end by 6 PM, 2026-11-25)
    const back = d.items.findIndex((it) => area(it) === d.town);
    assert.ok(back >= 1 && d.items.slice(0, back).every((it) => area(it) === n) && d.items.slice(back).every((it) => area(it) === d.town), why + ": out, then home");
    // within 90 minutes each way of the town (over the visitor's driving limit too, as any day may be: owner, 2026-11-24)
    const hub = data.places[pack.hubs[d.town]] && pack.hubs[d.town];
    if (hub) assert.ok(d.items.slice(0, back).every((it) => { const l = pack.getLeg(hub, it.siteId, lookup); return !l.drive || l.slots <= DAY_OUT.slots; }), why + ": within reach");
    assert.ok(back + 1 >= 2 && back + 1 <= TOP_UP[answers.pace], why + ": " + (back + 1) + " sights out and back");
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
  // (fewer rest days since long days are allowed: routes use the days to travel, owner 2026-11-24)
  assert.ok(rests > 50 && free / rests < 0.2 && away > 0, `${free} of ${rests} rest days left free, ${away} out`);
});

test("a day out only when the town alone gives the rest day fewer than 3 sights, and it gives more (owner, 2026-11-24)", () => {
  // the same trips with no day out (rest days are filled last, so every day before the first day out is the same)
  assert.deepEqual(DAY_OUT, { slots: 3, roads: { "te-anau": ["milford-sound"] } });
  const outs = [];
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const i = o.days.findIndex((d) => /^rest-/.test(d.block) && d.items.some((it) => data.places[it.siteId].area !== d.town));
    if (i >= 0) outs.push({ answers, o, i });
  }
  // and one from outside the sweep: Christchurch and back in 14 days at 2 hours a day, Easy, food on, spends its rest day in
  // Wānaka (day 7) out in Queenstown, the owner's first town (an hour each way: over the limit, as any day may be since
  // 2026-11-24), back for the evening at the Cardrona Hotel, 6:30 to 7:30 (somewhere to eat may run past 6 PM, 2026-11-25)
  const more = { start: "christchurch", end: "christchurch", days: 14, drive: 120, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] };
  const m = buildTrips(data, pack, more).find((x) => x.key === "built-christchurch-14-loop");
  assert.deepEqual([m.days[6].block, m.days[6].items.map((it) => data.places[it.siteId].area)], ["rest-wanaka", ["queenstown", "queenstown", "queenstown", "wanaka"]]);
  assert.deepEqual([m.days[6].items.at(-1).siteId, m.days[6].items.at(-1).slotIndex], ["cardrona-hotel", 21]);
  outs.push({ answers: more, o: m, i: 6 });
  assert.ok(outs.length >= 2, outs.length + " days out");
  const sightsOf = (d) => d.items.filter((it) => !foodOnly(data.places[it.siteId])).length;
  try {
    DAY_OUT.slots = 0;
    for (const { answers, o, i } of outs) {
      const stay = buildTrips(data, pack, answers).find((x) => x.key === o.key);
      assert.deepEqual(stay.days.slice(0, i), o.days.slice(0, i), o.key + ": the days before it");
      // (the day out is chosen before the empty-afternoon places, when the town alone gave fewer; a stay has those places too,
      // so here it may come level, never ahead)
      assert.ok(sightsOf(stay.days[i]) <= sightsOf(o.days[i]), `${name(answers)} ${o.key} day ${i + 1}: ${sightsOf(stay.days[i])} in town, ${sightsOf(o.days[i])} out`);
    }
  } finally { DAY_OUT.slots = 3; }
  // a day out that would give the rest day no more than its town does is not taken, and the next nearby town is tried:
  // Christchurch and back in 14 days at 2 hours a day, Lots of walking, food on, spends rest day 7 in Wānaka out in Arrowtown
  // (three places) and back for Roys Peak, not out in Queenstown for one (the Queenstown Hill walk), no more than Wānaka gives.
  // (It was Picton to Nelson in 10 days, until the Westport to Nelson day, 2026-11-25; before that Christchurch to Queenstown
  // in 21 days, until opening hours.)
  const q = buildTrips(data, pack, { start: "christchurch", end: "christchurch", days: 14, drive: 120, pace: "hikes", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-14-loop");
  assert.equal(q.days[6].block, "rest-wanaka");
  assert.deepEqual(q.days[6].items.map((it) => it.siteId), ["arrowtown-chinese-settlement", "crown-range-summit-lookout", "lakes-district-museum-and-gold-panning", "roys-peak-track"]);
});

test("a day after a rest day is timed again from where the rest day ends, not cut (owner, 2026-11-24)", () => {
  // Picton and back in 4 days at 2 hours a day, Easy, food off, adventure: day 3 is a rest day in Kaikōura, filled after day 4
  // (rest days are filled last) and ending at Cathedral Cliffs, Gore Bay; day 4 is timed again from there and keeps its two
  // stops (the wine tour by bike it also had, hired 10 to 4, has no time left before it shuts: opening hours, 2026-11-25;
  // nor has the 5-hour Motuara cruise before 6 PM)
  const o = buildTrips(data, pack, { start: "picton", end: "picton", days: 4, drive: 120, pace: "easy", food: false, vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] }).find((x) => x.key === "built-picton-4-loop");
  assert.equal(o.days[2].block, "rest-kaikoura");
  assert.equal(o.days[2].items.at(-1).siteId, "cathedral-cliffs-gore-bay");
  assert.deepEqual(o.days[3].items.map((it) => it.siteId), ["monkey-bay-walk-rarangi", "omaka-aviation-heritage-centre"]);
  const out = pack.packTrip(o.days.map((d, i) => ({ id: "d" + i, items: d.items.map((it) => ({ ...it, id: it.siteId })) })), lookup);
  out.forEach((d, i) => d.items.forEach((it, k) => assert.equal(it.slotIndex, o.days[i].items[k].slotIndex, "day " + (i + 1))));
});

test("a spare day in Kaikōura: a night in Hanmer on the way to or from Christchurch, else a day in one of the owner's spare-day towns (2026-11-24/25)", () => {
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
  // Christchurch to Nelson in 10 days at 4 hours a day went to Kaikōura through Hanmer (day 5) and had two spare days there
  // (days 6 and 8): the first is now the night in Hanmer, the second an extra day in Nelson at the end, the nearest of the
  // owner's spare-day towns (2026-11-25; it was Christchurch, day 5, one further). On the days before the West Coast ones: with
  // them it goes down the West Coast and back up through the Buller Gorge, with no spare day.
  const o = buildTrips(before, pack, { start: "christchurch", end: "nelson", days: 10, drive: 240, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-10-oneway");
  assert.deepEqual(o.days.map((d) => d.block), [
    "christchurch-botanic-gardens..avon-river-walk", "christchurch-gondola..he-puna-taimoana-hot-pools",
    "fairlie-bakehouse..dark-sky-project-summit-experience", "church-of-the-good-shepherd..little-high-eatery",
    "conical-hill-walk..the-pier-hotel-kaikoura|hanmer-springs|1", "conical-hill-walk..the-pier-hotel-kaikoura|hanmer-springs|2",
    "whale-watch-kaikoura..kaikoura-peninsula-walkway", "ohau-point-seal-colony..snout-track-picton", "edwin-fox-maritime-museum..fishy-business-on-roto", "rest-nelson",
  ]);
  assert.deepEqual(o.days[4].items.slice(0, 3).map((it) => it.siteId), ["conical-hill-walk", "pjs-pies", "hanmer-springs-thermal-pools-and-spa"]);
  assert.ok(o.days[5].items.some((it) => it.siteId === "kaikoura-lookout") && o.days[5].items.some((it) => it.siteId === "the-pier-hotel-kaikoura"));
  // the morning after is spent in Hanmer (its own places first that day), Kaikōura's left for the days there
  assert.equal(lookup(o.days[5].items[0].siteId).area, "hanmer-springs", o.days[5].items.map((it) => it.siteId).join(", "));
  // (on the way out of Kaikōura too, by the same rule; no sample trip has a spare day there since long days are allowed)
  // at 2 hours a day the day through Hanmer drove 4 hours; each half drives 2: Christchurch to Nelson in 7 days
  const t = buildTrips(data, pack, { start: "christchurch", end: "nelson", days: 7, drive: 120, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "built-christchurch-7-oneway");
  const h = t.days.findIndex((d) => /\|hanmer-springs\|1$/.test(d.block));
  assert.ok(h > 0, t.days.map((d) => d.block).join(", "));
  assert.deepEqual([t.days[h].driveMinutes, t.days[h + 1].driveMinutes, !!t.days[h].overLimit, !!t.days[h + 1].overLimit], [120, 120, false, false]);
});

test("a day its town can't fill moves to the nearest point of the trip whose town fills it (owner, 2026-11-24)", () => {
  // the owner's rule for Kaikōura ("an extra day in Christchurch not Kaikōura") for any town: a spare day left with nothing,
  // or a day in town left with nothing by repeats, is a rest day somewhere the trip can use it
  const built = (a, I = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }) => buildTrips(data, pack, { ...I, ...a }).find((x) => x.kind === "built");
  const none = { vibes: [], into: [], activities: [] };
  const restAt = (o) => o.days.map((d, j) => (/^rest-/.test(d.block) ? j + 1 + ":" + d.town : "")).filter(Boolean);
  // (a spare day in a town outside the owner's five moves before this, 2026-11-25: the next test)
  // a day in town left with nothing by repeats, to the best town of the trip first (the owner's ranking), the nearest point
  // there: Invercargill and back in 21 days at 6 hours a day, Easy, food off, had a fifth day in Te Anau (day 20) with every
  // sight seen; it is a spare day in Queenstown (day 14), not one in Invercargill (nearer, last in the ranking), and Te Anau
  // keeps four days, none empty
  const iv = built({ start: "invercargill", end: "invercargill", days: 21, drive: 360, pace: "easy", food: false }, none);
  assert.deepEqual([restAt(iv), iv.days.filter((d) => d.town === "te-anau").length, iv.days.filter((d) => d.free).length], [["14:queenstown", "16:queenstown"], 4, 0]);
  let empty = 0, trips = 0;
  for (const { options } of sweep) for (const o of options) if (o.kind === "built") { trips++; empty += o.days.filter((d) => d.free).length; }
  console.log(`empty days left in ${trips} built trips: ${empty}`);
});

test("the Doubtful Sound cruise once in a trip that stays in Te Anau: a spare day goes there for it, without the pies (owner, 2026-11-24)", () => {
  const CRUISE = "doubtful-sound-wilderness-cruise", DAY = "miles-better-pies..doubtful-sound-wilderness-cruise|no-food";
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const why = name(answers) + " " + o.key, cruises = o.days.filter((d) => d.items.some((it) => it.siteId === CRUISE));
    assert.ok(cruises.length <= 1, why + ": the cruise twice");
    // a trip here that stays in Te Anau and still has a spare day has the cruise (the move is refused only where it would mean
    // more driving over the limit)
    if (o.days.some((d) => d.town === "te-anau") && o.days.some((d) => /^rest-/.test(d.block || ""))) assert.equal(cruises.length, 1, why);
  }
  // Queenstown to Invercargill in 21 days at 6 hours a day, Easy, food on, is in Te Anau on day 14 and again on day 20: its spare
  // days are the Milford day after the first night there (day 15) and then the Doubtful Sound day (day 16, not after day 20),
  // the cruise 10:30 to 5:30, no pies, and no spare day left
  const nature = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] };
  const o = buildTrips(data, pack, { start: "queenstown", end: "invercargill", days: 21, drive: 360, pace: "easy", food: true, ...nature }).find((x) => x.key === "built-queenstown-21-oneway");
  assert.deepEqual([o.days[13].town, o.days[14].block, o.days[15].block, o.days[19].town], ["te-anau", MILFORD_DAY, DAY, "te-anau"]);
  assert.ok(!o.days.some((d) => /^rest-/.test(d.block)));
  const c = o.days[15].items.find((it) => it.siteId === CRUISE);
  assert.deepEqual([c.slotIndex, c.durationSlots], [5, 14]);
  assert.ok(!o.days[15].items.some((it) => it.siteId === "miles-better-pies"), "no pies");
  // the spare days nearest Te Anau first: Dunedin to Queenstown in 21 days at 2 hours a day, Easy, food on, reaches Te Anau on
  // day 2 (the website-only day); the nearest spare days are the Milford day (day 3) and the Doubtful Sound day (day 4), and
  // the one in Queenstown at the end stays
  const id = buildTrips(data, pack, { start: "dunedin", end: "queenstown", days: 21, drive: 120, pace: "easy", food: true, ...nature }).find((x) => x.key === "built-dunedin-21-oneway");
  assert.deepEqual([id.days[1].town, id.days[2].block, id.days[3].block, id.days.map((d, i) => (/^rest-/.test(d.block) ? i + 1 + ":" + d.town : "")).filter(Boolean)], ["te-anau", MILFORD_DAY, DAY, ["21:queenstown"]]);
});

test("the Milford day first in Te Anau, then Doubtful Sound (owner, 2026-11-25)", () => {
  const MIL = "cruise-milford-small-boat-cruise", DBT = "doubtful-sound-wilderness-cruise";
  assert.deepEqual(MILFORD, { day: MILFORD_DAY, cruise: MIL, pullDays: 7 });
  const dayOf = (o, id) => o.days.findIndex((d) => d.items.some((it) => it.siteId === id));
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") {
    const why = name(answers) + " " + o.key, m = dayOf(o, MIL), d = dayOf(o, DBT);
    assert.ok(o.days.filter((x) => x.items.some((it) => it.siteId === MIL)).length <= 1, why + ": Milford twice");
    if (m >= 0 && d >= 0) assert.ok(m < d, why + ": Doubtful Sound before Milford");
    // a trip that stays in Te Anau (two days there in a row) has the Milford cruise
    if (o.days.some((x, i) => i && x.town === "te-anau" && o.days[i - 1].town === "te-anau")) assert.ok(m >= 0, why + ": no Milford");
  }
  // Invercargill and back in 4 days at 2 hours a day, Easy, food off: day 2 is the Milford day and day 3 Doubtful Sound (day 3
  // was a spare day with the Kepler walk alone); in 3 days, day 2 is the Milford day (it was Doubtful Sound)
  const nature = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] };
  const iv = (days) => buildTrips(data, pack, { start: "invercargill", end: "invercargill", days, drive: 120, pace: "easy", food: false, ...nature }).find((x) => x.kind === "built");
  assert.deepEqual(iv(4).days.map((x) => x.block), ["howells-point-reserve..redcliff-te-anau", MILFORD_DAY, "miles-better-pies..doubtful-sound-wilderness-cruise", "clifden-suspension-bridge..balibu-invercargill"]);
  assert.deepEqual([iv(3).days[1].block, dayOf(iv(3), DBT)], [MILFORD_DAY, -1]);
  // a trip of 7 days or more that only passes through takes a spare day from elsewhere: Queenstown to Invercargill in 21 days
  // (the Doubtful Sound test above, day 15). Under 7 days no trip passes through Te Anau with a spare day to take (2026-11-25).
});

test("only a food-only day and a day that ends before its town place a stop where it arrives in its end town (owner, 2026-11-24)", () => {
  // the fills that may place a stop where the day has arrived in its end town are the food-only day's and the arrival's (a day
  // whose stops left end before its town, ARRIVE); every other add keeps to the stop before it in its own town. (A swap can
  // still leave an added stop next to another town's: the main attraction went in after a stop in its own town that the swap
  // then took out.)
  assert.match(bsrc, /\n      if \(!sights\(\)\) while \(sights\(\) < 3 && \(add\(fill, fill\.length\) \|\| add\(fill, fill\.length, 40\) \|\| add\(fill, fill\.length, undefined, undefined, true\) \|\| add\(fill, fill\.length, 40, undefined, true\)\)\) \{\}\n/);
  assert.match(bsrc, /\n      while \(\(endsShort\(\) \|\| sights\(\) < 3\) && add\(central, central\.length, undefined, items\.length, true, mid\)\) \{\}\n/);
  assert.equal((bsrc.match(/add\([^()]*, true(, mid)?\)/g) || []).length, 3, "arrive is passed by the food-only fill and the arrival only");
  assert.match(bsrc, /townSpot\(data, pack, b\.startTown\), at, arrive \? b\.endTown : null, ans\.pace\);/);
  assert.match(bsrc, /\|\| \(!!arrive && p\.area === arrive && items\.slice\(pos\)\.every\(function \(it\) \{ return look\(it\.siteId\)\.area === arrive; \}\)\);/);
});

test("food-only days: a day left with no sight takes its own towns' places, also where it arrives in its end town (owner, 2026-11-24)", () => {
  let n = 0, days = 0;
  for (const { answers, options } of sweep) for (const o of options) if (o.kind === "built") o.days.forEach((d, i) => {
    if (!d.items.length) return;
    days++;
    if (d.items.some((it) => !foodOnly(data.places[it.siteId]))) return;
    n++;
    assert.equal(someCandidateFits(o, i, { food: answers.food, arrive: true, pace: answers.pace }), null, name(answers) + " " + o.key + " day " + (i + 1));
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
    // the drive) or to 6 hours after the first began, done by 6 PM (as most stops the builder adds, owner 2026-11-25; 8 PM for
    // Lots of walking, left as it was for now)
    const lim = answers.pace === "hikes" ? 24 : 20;
    const first = d.items[at[0]], last = d.items[at.at(-1)], next = d.items[at.at(-1) + 1];
    if (at[0] === 0) assert.ok(first.slotIndex >= 4, why + ": opens before 10 AM");
    at.slice(0, -1).forEach((k) => assert.equal(d.items[k].durationSlots, data.places[d.items[k].siteId].slots, why));
    const to = Math.min(next ? next.slotIndex - pack.getLeg(last.siteId, next.siteId, lookup).slots : lim, first.slotIndex + 12);
    assert.equal(last.durationSlots, Math.max(data.places[last.siteId].slots, to - last.slotIndex), why);
    assert.ok(last.slotIndex + last.durationSlots <= lim, why + ": past " + (lim === 24 ? 8 : 6) + " PM");
  });
  console.log(`days in towns with favourites: ${JSON.stringify(seen)}; favourite days: ${JSON.stringify(count)}, at a favourite the trip has been to: ${JSON.stringify(again)}`);
  // (Queenstown's: no trip here leaves a Queenstown day with no sight since the website-only days, 2026-11-24; Abel Tasman's
  // neither since its spare days go to the owner's five towns, 2026-11-25)
  // Abel Tasman: Picton to Nelson in 21 days at 4 hours a day, Easy, food on: day 18, a rest day with nothing left there, is a
  // beach day at Kaiteriteri (where day 2 went), from 10 AM for 6 hours (its spare days in Abel Tasman as they were), on the
  // days before the West Coast ones (with them no trip has a rest day in Abel Tasman with nothing left)
  const o = withSpare(["abel-tasman"], () => buildTrips(before, pack, { start: "picton", end: "nelson", days: 21, drive: 240, pace: "easy", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] })).find((x) => x.key === "built-picton-21-oneway");
  const d = o.days[17];
  assert.equal(d.block, "rest-abel-tasman");
  assert.deepEqual(d.items.map((it) => [it.siteId, it.slotIndex, it.durationSlots]), [["kaiteriteri-beach", 4, 12]]);
  assert.ok(o.days.slice(0, 17).some((x) => x.items.some((it) => it.siteId === "kaiteriteri-beach")), "been there before");
  // (Queenstown's two, the gardens then the lakefront, had Christchurch to Queenstown in 21 days; that trip no longer ends on a
  // spare day in Queenstown since the website-only days, 2026-11-24. The owner's Wānaka to Queenstown afternoon will use them.)
});

test("the owner's 3 days from Christchurch, food off: the gardens and the river walk, then Tekapo; the church, then central Christchurch (owner, 2026-11-24)", () => {
  // "day 1 starts with botanic gardens and river walk, then drive to tekapo - tekapo springs then summit mt st john and dark
  // sky; day 2 starts w church then back to chch riverside market, art gallery or other central chch things; then day 3 is
  // fine as is" (it was: Mt John at 8 AM with no drive from Christchurch, the church alone, the night in Tekapo)
  const o = buildTrips(data, pack, { start: "christchurch", end: "christchurch", days: 3, drive: 120, pace: "easy", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  const ids = (d) => d.items.map((it) => it.siteId);
  // (Mt John before the springs, not after: its road shuts at 4 PM, and the day reaches Tekapo at 2:30; owner, 2026-11-25)
  assert.deepEqual(ids(o.days[0]), ["christchurch-botanic-gardens", "avon-river-walk", "mt-john-summit-astro-cafe", "tekapo-springs", "dark-sky-project-summit-experience"]);
  const mj = o.days[0].items[2];
  assert.ok(mj.slotIndex >= lookup(mj.siteId).open && mj.slotIndex + mj.durationSlots <= lookup(mj.siteId).close, "Mt John inside its hours");
  // the church, the drive back, then Riverside Markets (DXWpQTSPRQQKPt7SIcVi) and punting on the Avon, both within ARRIVE.km
  // (it was the Art Gallery, which shuts at 5: opening hours, 2026-11-25)
  assert.deepEqual(ids(o.days[1]), ["church-of-the-good-shepherd", "DXWpQTSPRQQKPt7SIcVi", "punting-on-the-avon"]);
  for (const id of ids(o.days[1]).slice(1)) assert.ok(data.places[id].area === "christchurch" && kmT(townSpot(data, pack, "christchurch"), data.places[id]) <= ARRIVE.km, id);
  // the owner's three (Bridle Path, the town day's place that fits the answers, would run 5:30 to 7:30: "doing bridle path
  // at 6 makes no sense", 2026-11-25)
  assert.deepEqual(ids(o.days[2]), ["christchurch-gondola", "taylors-mistake-track", "he-puna-taimoana-hot-pools"]);
  // every night in the day's town; day 1's drive out after the morning in Christchurch
  o.days.forEach((d, i) => assert.equal(data.places[d.items.at(-1).siteId].area, d.town, "day " + (i + 1)));
  assert.ok(o.days[0].items[2].slotIndex >= o.days[0].items[1].slotIndex + o.days[0].items[1].durationSlots + pack.getLeg("avon-river-walk", "mt-john-summit-astro-cafe", lookup).slots);
});

test("day 1 is timed from the start town: no stop before the drive there from it (owner, 2026-11-24)", () => {
  let drives = 0;
  for (const { answers, options } of sweep) for (const o of options) {
    const d = o.days.find((x) => x.items.length);
    if (!d) continue;
    const first = d.items[0], leg = pack.getLeg(pack.hubs[answers.start], first.siteId, lookup);
    if (leg.drive) drives++;
    assert.ok(!leg.drive || leg.slots <= first.slotIndex, `${name(answers)} ${o.key}: ${first.siteId} at slot ${first.slotIndex}, ${leg.slots} half-hours from ${answers.start}`);
  }
  console.log(`trips whose first day opens with the drive from the start town: ${drives}`);
  // (a rest day as the trip's first day never goes out to a nearby town, the owner's rule: Invercargill to Dunedin in 7 days had
  // one, until the website-only day to Te Anau gave it a route out on day 1; no trip here now starts with one that could)
});

test("a trip from Christchurch that drives out on day 1 begins it with the Botanic Gardens and the Avon River walk when they fit (owner, 2026-11-24)", () => {
  assert.deepEqual(START_MORNING, { christchurch: ["christchurch-botanic-gardens", "avon-river-walk"] });
  assert.equal(START_PUSH, 2, "the day's own stops an hour later at most");
  let n = 0, out = 0;
  for (const { answers, options } of sweep) for (const o of options) {
    const d = o.days[0], b = blockOf(d);
    if (answers.start !== "christchurch" || !b || b.endTown === "christchurch" || !d.items.length) continue;
    const lead = d.items.findIndex((it) => data.places[it.siteId].area !== "christchurch");
    const morning = d.items.slice(0, lead < 0 ? d.items.length : lead).map((it) => it.siteId).filter((id) => START_MORNING.christchurch.includes(id) && !b.items.some((x) => x.siteId === id));
    if (morning.length) n++; else out++;
    // first thing, in the owner's order, before the drive out
    assert.deepEqual(morning, START_MORNING.christchurch.filter((id) => morning.includes(id)), name(answers) + " " + o.key);
    assert.deepEqual(d.items.slice(0, morning.length).map((it) => it.siteId), morning, name(answers) + " " + o.key);
  }
  console.log(`day 1 out of Christchurch: with the morning there ${n}, without ${out}`);
  assert.ok(n && out, "some fit, some don't");
  // Christchurch to Picton in 3 days at 2 hours a day, food on: day 1 goes by Hanmer to Kaikōura from 10 AM; the gardens' two
  // hours would push it more than an hour, the river walk's one doesn't: the walk, then the drive
  const p = buildTrips(data, pack, { start: "christchurch", end: "picton", days: 3, drive: 120, pace: "some", food: true, vibes: [], into: [], activities: [] }).find((x) => x.kind === "built");
  assert.deepEqual(p.days[0].items.slice(0, 2).map((it) => it.siteId), ["avon-river-walk", "conical-hill-walk"]);
  // day 1's only: in 4 days the trip spends day 1 in Christchurch, and day 2 drives out by Hanmer with no morning there
  const p4 = buildTrips(data, pack, { start: "christchurch", end: "picton", days: 4, drive: 120, pace: "easy", food: true, vibes: ["nature", "relax"], into: ["Scenic", "Walks"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  assert.deepEqual([p4.days[0].town, p4.days[1].items[0].siteId], ["christchurch", "conical-hill-walk"]);
});

test("the website-only days: Dunedin round the Catlins, Invercargill up to Te Anau, Dunedin to Te Anau from 5 days (owner, 2026-11-24)", () => {
  const TA = "dunedin-railway-station..redcliff-te-anau", te = blockById[TA];
  assert.deepEqual([te.startTown, te.endTown, te.minTripDays], ["dunedin", "te-anau", 5]);
  for (const { answers, options } of sweep) if (answers.days < 5) for (const o of options) assert.ok(!o.days.some((d) => d.block === TA), name(answers) + " " + o.key);
  // Dunedin to Queenstown in 4 days at 4 hours a day goes by Mount Cook and Wānaka; without the 5 days it would be Te Anau on
  // day 1 and three days in Queenstown
  const towns = (a) => buildTrips(data, pack, { ...a, vibes: [], into: [], activities: [] }).find((x) => x.kind === "built").days.map((d) => d.town);
  assert.deepEqual(towns({ start: "dunedin", end: "queenstown", days: 4, drive: 240, pace: "easy", food: true }), ["dunedin", "aoraki-mount-cook", "wanaka", "queenstown"]);
  // from 5 days it goes: Dunedin and back in 5 days at 2 hours a day, Easy, food off, is a Southland loop
  assert.deepEqual(towns({ start: "dunedin", end: "dunedin", days: 5, drive: 120, pace: "easy", food: false }), ["dunedin", "te-anau", "te-anau", "catlins", "dunedin"]);
  // and Dunedin and back in 3 days goes round the Catlins (it was three days in Dunedin)
  assert.deepEqual(towns({ start: "dunedin", end: "dunedin", days: 3, drive: 120, pace: "easy", food: true }), ["catlins", "dunedin", "dunedin"]);
});

test("an empty afternoon takes more in the day's town: Queenstown's gardens then the lakefront first (owner, 2026-11-24)", () => {
  // "add some wanaka places", "day 1 just add beach front and gardens", "add more in qt", "add another stop in each"
  assert.deepEqual(AFTERNOON, { before: 16, until: 18 });
  const none = { vibes: [], into: [], activities: [] }, ids = (d) => d.items.map((it) => it.siteId);
  const ends = (d) => d.items.at(-1).slotIndex + d.items.at(-1).durationSlots;
  // Queenstown and Wānaka in Four Days, food off, Easy: day 4 (Wānaka to Queenstown, done by 1 PM) ends with the gardens and
  // the lakefront; day 3 in Wānaka (Diamond Lake and Paddle Wānaka, done by 2:30) gets more Wānaka places
  const qw = buildTrips(data, pack, { start: "queenstown", end: "queenstown", days: 4, drive: 120, pace: "easy", food: false, ...none }).find((x) => x.label === "Queenstown and Wānaka in Four Days");
  const k = ids(qw.days[3]).indexOf("kawarau-bridge-bungy");
  assert.deepEqual(ids(qw.days[3]).slice(k + 1, k + 3), ["queenstown-gardens", "queenstown-bay-beach"], "the gardens (day 1 had them too) then the lakefront");
  assert.ok(ends(qw.days[3]) >= AFTERNOON.until);
  assert.ok(ids(qw.days[2]).length > 2 && ids(qw.days[2]).slice(2).every((id) => data.places[id].area === "wanaka") && ends(qw.days[2]) >= AFTERNOON.before, ids(qw.days[2]).join(", "));
  // Queenstown in Three Days, food off, Easy: day 1 (the gardens, the Earnslaw, Skyline, done by 3:30) adds the lakefront
  const q3 = buildTrips(data, pack, { start: "queenstown", end: "queenstown", days: 3, drive: 120, pace: "easy", food: false, ...none }).find((x) => x.label === "Queenstown in Three Days");
  assert.equal(ids(q3.days[0]).at(-1), "queenstown-bay-beach");
  // Queenstown to Christchurch via Mount Cook and Tekapo, food off, Easy: day 3's Tekapo Springs right after Hooker Valley and
  // the drive (it was 3:30), Dark Sky still at 9:30
  const qc = buildTrips(data, pack, { start: "queenstown", end: "christchurch", days: 4, drive: 120, pace: "easy", food: false, vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] }).find((x) => x.label === "Queenstown to Christchurch via Mount Cook and Tekapo");
  const d3 = qc.days[2], hv = d3.items.find((it) => it.siteId === "hooker-valley-track"), sp = d3.items.find((it) => it.siteId === "tekapo-springs");
  assert.equal(sp.slotIndex, hv.slotIndex + hv.durationSlots + pack.getLeg("hooker-valley-track", "tekapo-springs", lookup).slots);
  assert.equal(d3.items.at(-1).slotIndex, 27);
});

// Same rules as the builder's afternoon (AFTERNOON): after a day's last stop, in its town, one of the town's favourites (not
// in the day, nor the day before) or a place not in the trip that the builder may add, on the way to the town's middle,
// nothing else moving, ending by 6 PM and inside its hours, the day a packTrip fixed point.
function afternoonFits(o, i, answers) {
  const d = o.days[i], last = d.items.at(-1), prevDay = { items: [fromBefore(o, i)] };
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(x.block ? (blockOf(x) || { items: [] }).items.map((it) => it.siteId) : [])));
  const had = new Set(d.items.concat(i ? o.days[i - 1].items : []).map((it) => it.siteId)), mid = townSpot(data, pack, d.town);
  const cands = (FAVOURITES[d.town] || []).filter((id) => !had.has(id)).concat((data.towns[d.town] || { placeIds: [] }).placeIds.filter((id) => !taken.has(id) && !ONE_DAY.includes(id)));
  for (const id of cands) {
    const p = data.places[id];
    if (!mayAdd(p, answers) || !onWayT(data.places[last.siteId], p, mid)) continue;
    const trial = d.items.concat([{ siteId: id, siteName: p.name, slotIndex: Math.max(last.slotIndex + last.durationSlots, opensT(p)), durationSlots: p.slots }]);
    const out = pack.packTrip([prevDay, { items: trial }], lookup)[1].items;
    if (!out.every((it, k) => k === trial.length - 1 || it.slotIndex === trial[k].slotIndex)) continue;
    if (out.at(-1).slotIndex + p.slots > endByT(p, answers.pace)) continue; // by 6 PM (8 PM if it may run late), and inside its hours
    const again = pack.packTrip([prevDay, { items: out }], lookup)[1].items;
    if (again.every((it, k) => it.slotIndex === out[k].slotIndex && it.slotIndex + it.durationSlots <= 28)) return id;
  }
  return null;
}

test("an empty afternoon, across the sweep: a day that ends in its town before 4 PM has no place left there that fits (owner, 2026-11-24)", () => {
  let early = 0, days = 0;
  for (const { answers, options } of sweep) for (const o of options) o.days.forEach((d, i) => {
    if (!d.items.length) return;
    days++;
    const last = d.items.at(-1);
    if (data.places[last.siteId].area !== d.town || last.slotIndex + last.durationSlots >= AFTERNOON.before) return;
    early++;
    assert.equal(afternoonFits(o, i, answers), null, `${name(answers)} ${o.key} day ${i + 1} ends at ${last.siteId}`);
  });
  console.log(`days that end in their town before 4 PM with nothing more that fits: ${early} of ${days}`);
});

test("the owner's answers, 2026-11-24: Riverside Markets late, Ōhau Point on day 2, the Milford road, one long walk, Picton reached", () => {
  const none = { vibes: [], into: [], activities: [] }, ids = (d) => d.items.map((it) => it.siteId), RM = "DXWpQTSPRQQKPt7SIcVi";
  // a day that reaches Christchurch after its central places close ends at Riverside Markets, until 9 PM ("an option always
  // cos its more than just food"): Picton to Christchurch in 3 days at 2 hours a day, Lots of walking, food off: day 3 comes
  // over from Hanmer and ends there, 8 to 9 PM
  assert.deepEqual(ARRIVE, { km: 3, evening: { christchurch: RM }, until: 26 });
  const pc = buildTrips(data, pack, { start: "picton", end: "christchurch", days: 3, drive: 120, pace: "hikes", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  const rm = pc.days[2].items.at(-1);
  assert.deepEqual([rm.siteId, rm.slotIndex, rm.durationSlots], [RM, 24, 2]);
  // Picton to Christchurch via Kaikōura: Ōhau Point is day 2's, after the Peninsula Walkway, not day 1's (website only)
  assert.deepEqual(MOVES, { "picton-to-christchurch-via-kaikoura": [{ siteId: "ohau-point-seal-colony", to: 1 }] });
  for (const food of [true, false]) {
    const pk = buildTrips(data, pack, { start: "picton", end: "christchurch", days: 3, drive: 240, pace: "some", food, ...none }).find((x) => x.key === "picton-to-christchurch-via-kaikoura");
    assert.ok(!ids(pk.days[0]).includes("ohau-point-seal-colony"), "food " + food);
    assert.deepEqual(ids(pk.days[1]).slice(-1), ["ohau-point-seal-colony"], "food " + food + ": " + ids(pk.days[1]).join(", "));
    // day 1 closes up where the seals were: Nin's Bin an hour earlier, 3:30 (it was 4:30, after Ōhau Point at 3:30)
    if (food) assert.equal(pk.days[0].items.find((it) => it.siteId === "nins-bin").slotIndex, 15);
  }
  // a rest day in Te Anau its town can't fill goes up the Milford road (within 90 minutes each way), over the driving limit if
  // need be: Invercargill and back in 4 days at 2 hours a day, Easy, food off: day 3 is Mirror Lakes and Lake Gunn, then back
  // for the Glowworm Caves. (With no interests picked the day stays in town since stops end by 6 PM, 2026-11-25: day 2 then
  // takes the bird sanctuary, not the Kepler walk at 4:30, and no Te Anau place is left to come back to.) On the days without
  // the Milford day: with it, the Milford rule makes day 2 the Milford day and day 3 Doubtful Sound (2026-11-25).
  const iv = buildTrips(noMilford(data), pack, { start: "invercargill", end: "invercargill", days: 4, drive: 120, pace: "easy", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  assert.equal(iv.days[2].block, "rest-te-anau");
  assert.ok(ids(iv.days[2]).filter((id) => data.places[id].area === "milford-sound").length >= 2, ids(iv.days[2]).join(", "));
  assert.equal(data.places[iv.days[2].items.at(-1).siteId].area, "te-anau");
  // an empty afternoon on Easy may take one long walk when nothing shorter fits: South Island in 7 Days from Christchurch to
  // Queenstown, food off: the day at Fox Glacier (Easy took its South Side walk out) ends with one
  const cq = buildTrips(data, pack, { start: "christchurch", end: "queenstown", days: 7, drive: 120, pace: "easy", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.key === "south-island-in-7-days-from-christchurch");
  const fox = cq.days.find((d) => d.town === "fox-glacier"), lw = data.places[fox.items.at(-1).siteId];
  assert.ok(lw.category.includes("Walks") && lw.slots >= 4 && lw.area === "fox-glacier", fox.items.map((it) => it.siteId).join(", "));
  assert.equal(fox.items.filter((it) => { const p = data.places[it.siteId]; return p.category.includes("Walks") && p.slots >= 4; }).length, 1, "one");
  // Picton and back in 4 days at 4 hours a day, Lots of walking: the last day (Golden Bay to Picton by the Sounds road, its
  // Cullen Point lookout had on day 1) still reaches Picton: the Snout Track after the drive over. (With Easy or Some walking
  // it was Edwin Fox, free once day 1 took Rabbit Island to 7:30 PM in its place; stops end by 6 PM now, 2026-11-25, so day 1
  // keeps Edwin Fox, no Picton place is left, and the last day ends in Nelson with the drive in: 24 of 292 such trips reached
  // Picton before, none now.)
  const pp = buildTrips(data, pack, { start: "picton", end: "picton", days: 4, drive: 240, pace: "hikes", food: false, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }).find((x) => x.kind === "built");
  assert.deepEqual([data.places[pp.days[3].items.at(-1).siteId].area, pp.days[3].items.at(-1).siteId], ["picton", "snout-track-picton"], ids(pp.days[3]).join(", "));
});

test("spare days in Dunedin, Christchurch, Nelson, Queenstown or Wānaka if possible (owner, 2026-11-25)", () => {
  assert.deepEqual(SPARE_TOWNS, ["dunedin", "christchurch", "nelson", "queenstown", "wanaka"]);
  let rest = 0, inFive = 0;
  for (const { options } of sweep) for (const o of options) if (o.kind === "built") for (const d of o.days) if (/^rest-/.test(d.block)) { rest++; if (SPARE_TOWNS.includes(d.town)) inFive++; }
  console.log(`rest days in built trips: ${rest}, in the five towns: ${inFive}`);
  assert.ok(rest > 50 && inFive / rest >= 0.9, `${inFive} of ${rest}`);
  const nature = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }, adv = { vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] };
  const restAt = (o) => o.days.map((d, i) => (/^rest-/.test(d.block) ? i + 1 + ":" + d.town : "")).filter(Boolean);
  // the route as it was, a spare day elsewhere moved to the nearest point of the trip in one of them, never next to another:
  // Christchurch to Dunedin in 21 days at 2 hours a day, Easy, food on: its spare day in Te Anau (day 15) is one in Queenstown
  // (day 12), not one in Christchurch at the start
  const cd = buildTrips(data, pack, { start: "christchurch", end: "dunedin", days: 21, drive: 120, pace: "easy", food: true, ...nature }).find((x) => x.key === "built-christchurch-21-oneway");
  assert.deepEqual(restAt(cd), ["12:queenstown", "19:dunedin", "21:dunedin"]);
  // even where the day after drives further over the limit (days over it are OK, owner 2026-11-24): Christchurch and back in 7
  // days at 2 hours a day, Easy, adventure: its spare day in Tekapo is one in Christchurch (day 4), and Tekapo's arrival a day
  // later drives 3½ hours where it drove 3
  const cc = buildTrips(data, pack, { start: "christchurch", end: "christchurch", days: 7, drive: 120, pace: "easy", food: true, ...adv }).find((x) => x.kind === "built");
  assert.deepEqual([restAt(cc), cc.days.filter((d) => d.free).length, cc.days[4].town, cc.days[4].driveMinutes], [["2:christchurch", "4:christchurch", "7:christchurch"], 0, "tekapo", 210]);
  // a spare day in Nelson, which has no town day: Queenstown to Nelson in 21 days at 6 hours a day, Easy, food on, adventure,
  // ends with one there rather than going on to Kaikōura from Picton and back (on the days before the West Coast ones: with
  // them it loops home from Picton through Abel Tasman, Westport and the Buller Gorge), and without the Milford day (with it the
  // Nelson spare day is the Milford day, day 3)
  const qn = buildTrips(noMilford(before), pack, { start: "queenstown", end: "nelson", days: 21, drive: 360, pace: "easy", food: true, ...adv }).find((x) => x.key === "built-queenstown-21-oneway");
  assert.deepEqual([restAt(qn), qn.days.some((d) => d.town === "kaikoura")], [["21:nelson"], false]);
});

test("a main attraction's swap never takes out a travel day's only stop in the town it ends in: the night stays there (2026-11-24)", () => {
  // Invercargill to Dunedin in 7 days at 2 hours a day, Easy, food off, no interests: day 1 (the website-only day to Te Anau)
  // keeps Frasers Beach, its one Te Anau stop, though Clifden Caves (a main attraction) would fit in its place; the night is in
  // Te Anau, not Tuatapere, and day 2 doesn't start with a 4-hour drive
  const o = buildTrips(data, pack, { start: "invercargill", end: "dunedin", days: 7, drive: 120, pace: "easy", food: false, vibes: [], into: [], activities: [] }).find((x) => x.kind === "built");
  assert.equal(o.days[0].block, "howells-point-reserve..redcliff-te-anau");
  assert.deepEqual([data.places[o.days[0].items.at(-1).siteId].area, o.days[0].items.at(-1).siteId], ["te-anau", "frasers-beach-manapouri"]);
});

// Same rules as the builder's arrival (ARRIVE): a place in the day's end town within ARRIVE.km of its middle, not in the
// trip, that the builder may add, after the day's last stop, on the way from it to the town's middle (the night is there
// whichever way the trip goes on), nothing else moving, ending by 6 PM and inside its hours, the day a packTrip fixed point.
function arrivalFits(o, i, answers) {
  const d = o.days[i], b = blockOf(d), last = d.items.at(-1) || fromBefore(o, i), prevDay = { items: [fromBefore(o, i)] };
  const taken = new Set(o.days.flatMap((x) => x.items.map((it) => it.siteId).concat(x.block ? blockOf(x).items.map((it) => it.siteId) : [])));
  const mid = townSpot(data, pack, b.endTown);
  for (const id of data.towns[b.endTown].placeIds) {
    const p = data.places[id];
    if (taken.has(id) || !mayAdd(p, answers) || ONE_DAY.includes(id) || kmT(mid, p) > ARRIVE.km) continue;
    if (!onWayT(data.places[last.siteId], p, mid)) continue;
    const trial = d.items.concat([{ siteId: id, siteName: p.name, slotIndex: Math.max(d.items.length ? last.slotIndex + last.durationSlots : 0, opensT(p)), durationSlots: p.slots }]);
    const out = pack.packTrip([prevDay, { items: trial }], lookup)[1].items;
    if (!out.every((it, k) => k === trial.length - 1 || it.slotIndex === trial[k].slotIndex)) continue;
    if (out.at(-1).slotIndex + p.slots > endByT(p, answers.pace)) continue; // by 6 PM (8 PM if it may run late), and inside its hours
    const again = pack.packTrip([prevDay, { items: out }], lookup)[1].items;
    if (again.every((it, k) => it.slotIndex === out[k].slotIndex && it.slotIndex + it.durationSlots <= 28)) return id;
  }
  return null;
}

test("a day whose own stops end in its town, but whose stops left end before it, arrives there: the town's central places after the drive in (owner, 2026-11-24)", () => {
  // "day 2 starts w church then back to chch riverside market, art gallery or other central chch things"
  assert.deepEqual(ARRIVE.km, 3);
  let short = 0, mended = 0;
  for (const { answers, options } of sweep) for (const o of options) o.days.forEach((d, i) => {
    const b = blockOf(d);
    if (!b || !b.items.length || data.places[b.items.at(-1).siteId].area !== b.endTown) return;
    const own = new Set(b.items.map((it) => it.siteId)), last = d.items.at(-1);
    if (last && data.places[last.siteId].area === b.endTown) { if (!own.has(last.siteId)) mended++; return; }
    short++;
    assert.equal(arrivalFits(o, i, answers), null, `${name(answers)} ${o.key} day ${i + 1} ends at ${last && last.siteId}, short of ${b.endTown}`);
  });
  console.log(`days whose own stops end in their town: ending there with a place added ${mended}, still short (nothing fits) ${short}`);
  assert.ok(mended > 0);
  // best fit first: the owner's 3 days from Christchurch for an adventure-minded visitor come back to kayaks at the Antigua
  // Boatsheds and Waka on Avon, not the markets and the gallery (then, the afternoon still empty, surfing at New Brighton)
  const o = buildTrips(data, pack, { start: "christchurch", end: "christchurch", days: 3, drive: 120, pace: "easy", food: false, vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] }).find((x) => x.kind === "built");
  assert.deepEqual(o.days[1].items.map((it) => it.siteId).slice(0, 3), ["church-of-the-good-shepherd", "antigua-boatsheds-kayak-canoe-hire", "waka-on-avon"]);
});

test("opening hours from the app: a stop the builder adds is inside them, and no stop moves up to before its place opens (owner, 2026-11-25)", () => {
  // "carry from app if possible"; "8 AM Onsen Hot Pools, cut this ... i suspect the place is closed at that time"
  const P = data.places;
  assert.deepEqual([[P["onsen-hot-pools"].open, P["onsen-hot-pools"].close], [P["fyffe-house"].open, P["fyffe-house"].close], [P["fat-pipi-pizza"].open, P["fat-pipi-pizza"].close],
    [P["mt-john-summit-astro-cafe"].open, P["mt-john-summit-astro-cafe"].close], [P["dunedin-railway-station"].open, P["dunedin-railway-station"].close]], [[2, 30], [4, 18], [18, 24], [2, 16], [null, null]]);
  assert.ok(Object.values(P).every((p) => "open" in p && "close" in p) && Object.values(P).filter((p) => p.open != null).length > 150);
  // closing a day up never takes a stop to before it opens: the Otago Museum, alone after the station goes, starts at 10 (it
  // opens then), not 9; Fat Pipi Pizza, dinner only, stays at 5 PM (a meal may otherwise move an hour up)
  const at = (siteId, slotIndex, durationSlots) => ({ siteId, siteName: P[siteId].name, slotIndex, durationSlots });
  const dn = [at("dunedin-railway-station", 2, 2), at("tuhura-otago-museum", 6, 4)], hk = [at("hokitika-beach-driftwood-sign", 15, 2), at("fat-pipi-pizza", 18, 2)];
  assert.deepEqual(closeUp(pack, lookup, null, dn, [dn[1]]).map((it) => it.slotIndex), [4]);
  assert.deepEqual(closeUp(pack, lookup, null, hk, [hk[1]]).map((it) => it.slotIndex), [18]);
  // a day out too. From Queenstown, half an hour to Arrowtown: the Lakes District Museum from 9, when it opens, not 8:30
  assert.deepEqual(dayOut(pack, lookup, at("queenstown-bay-beach", 16, 2), { pace: "some" }, [P["lakes-district-museum-and-gold-panning"]], [P["queenstown-gardens"]]).map((it) => [it.siteId, it.slotIndex]),
    [["lakes-district-museum-and-gold-panning", 2], ["queenstown-gardens", 6]]);
  // and each stop of a day out done by its close: a spare day in Wānaka out in Queenstown, Easy, after That Wānaka Tree: the
  // bike hire, the bungy, then the Frankton Track at 4, not the Shotover Jet (4 to 5:30; it shuts at 5), and back for the
  // evening at the Cardrona Hotel (Picton to Nelson in 21 days had this day until the Westport to Nelson day, 2026-11-25)
  const qt = ["around-the-basin-bike-hire", "kawarau-bridge-bungy", "shotover-jet", "frankton-track-and-frankton-beach"].map((id) => P[id]);
  assert.deepEqual(dayOut(pack, lookup, at("that-wanaka-tree", 18, 2), { pace: "easy" }, qt, [P["cardrona-hotel"]]).map((it) => [it.siteId, it.slotIndex]),
    [["around-the-basin-bike-hire", 3], ["kawarau-bridge-bungy", 12], ["frankton-track-and-frankton-beach", 16], ["cardrona-hotel", 22]]);
  assert.equal(P["shotover-jet"].close, 18);
  // across the sweep
  const RM = ARRIVE.evening.christchurch; // "assume that riverside market is an option always": not held to its hours
  // and nothing the builder adds runs past 6 PM, a walk as much as a museum (owner, 2026-11-25: "doing bridle path at 6
  // makes no sense"; "empty time in the evenings is ok"), but what may: "only things that could go after 6 are restaurants,
  // lookouts and west coast beaches", to 8 PM, and the markets
  const lateSights = Object.values(P).filter((p) => lateOk(p) && !p.category.includes("Food")).map((p) => p.name).sort();
  assert.deepEqual(lateSights, ["Akaroa Harbour Lookout", "Bluff Hill Lookout (Motupōhue)", "Bruce Bay", "Crown Range Summit Lookout", "Devil's Staircase Lookout", "Florence Hill Lookout", "Hawkes Lookout",
    "Hokitika Beach", "Kaikōura Lookout", "Knights Point Lookout", "Lindis Pass Summit Lookout", "Otira Viaduct Lookout", "Peters Lookout", "Signal Hill Lookout", "Tauranga Bay Beach", "The Neck Lookout"]);
  assert.deepEqual(["cardrona-hotel", "bridle-path", "kaiteriteri-beach", "gillespies-beach", "lake-hauroko-lookout-track", "queen-charlotte-drive-cullen-point", "tekapo-springs"].map((id) => lateOk(P[id])), [true, false, false, false, false, false, false]);
  for (const p of Object.values(P)) assert.equal(lateOk(p), lateOkT(p), p.id);
  let added = 0, timed = 0, fyffe = 0, onsen = 0, pipi = 0, all = 0, after6 = 0; const early = [], late = [], movedUp = [], evening = [];
  for (const { answers, options } of sweep) for (const o of options) o.days.forEach((d, i) => {
    const own = new Map((blockOf(d) || { items: [] }).items.map((it) => [it.siteId, it.slotIndex])), why = `${name(answers)} ${o.key} day ${i + 1} `;
    d.items.forEach((it, k) => {
      const p = P[it.siteId];
      if (it.siteId === "fyffe-house") fyffe++;
      if (it.siteId === "onsen-hot-pools") onsen++;
      if (it.siteId === "fat-pipi-pizza") { pipi++; assert.ok(k > 0 && it.slotIndex >= 18, why + "Fat Pipi Pizza first, or before 5 PM"); }
      if (!own.has(it.siteId) && it.siteId !== RM && answers.pace !== "hikes") { // (Lots of walking: left as it was for now)
        all++;
        if (answers.pace !== "hikes" && it.slotIndex + it.durationSlots > 20) after6++;
        if (it.slotIndex + it.durationSlots > addEndT(p, answers.pace)) evening.push(why + it.siteId + " to " + pack.slotIndexToTimeLabel(it.slotIndex + it.durationSlots));
      }
      if (p.open == null) return;
      timed++;
      if (!own.has(it.siteId)) {
        added++;
        if (it.siteId === RM) return;
        if (it.slotIndex < opensT(p)) early.push(why + it.siteId);
        if (it.slotIndex + it.durationSlots > closesT(p)) late.push(why + it.siteId);
      } else if (it.slotIndex < opensT(p) && it.slotIndex < own.get(it.siteId)) movedUp.push(why + it.siteId); // (its own time may be earlier: the trip's times stand)
    });
  });
  console.log(`stops with opening hours in the sweep: ${timed}, added by the builder ${added}; Fyffe House ${fyffe}, Onsen ${onsen}, Fat Pipi Pizza ${pipi}`);
  assert.ok(added > 500 && fyffe > 0 && onsen > 0 && pipi > 0);
  assert.deepEqual([early.slice(0, 5), late.slice(0, 5), movedUp.slice(0, 5)], [[], [], []], `${early.length} before opening, ${late.length} past closing, ${movedUp.length} moved up to before opening`);
  console.log(`stops the builder adds in the sweep: ${all}, ending after 6 PM (lookouts, West Coast beaches, somewhere to eat) ${after6}`);
  assert.deepEqual(evening.slice(0, 8), [], `${evening.length} of ${all} stops the builder adds run past 6 PM (8 PM for those that may)`);
  assert.ok(after6 > 0, "none runs late at all");
  // a stop the builder added that a later re-timing pushes past its end goes too: Picton and back in 10 days at 2 hours a
  // day, Easy, food off: day 7 (Hokitika to Westport) had the Kawatiri Coastal Trail from 2 to 6; timed again once the spare
  // day before it was filled, the trail would run to 6:30, so the day ends at Cape Foulwind
  const nature = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }, adv = { vibes: ["adventure"], into: ["Adventure", "Water"], activities: ["stargazing", "wildlife"] };
  // (on the days before the West Coast ones: with them that trip comes up the coast from Greymouth to Westport)
  const pl = buildTrips(before, pack, { start: "picton", end: "picton", days: 10, drive: 120, pace: "easy", food: false, ...nature }).find((x) => x.key === "built-picton-10-loop");
  assert.deepEqual([pl.days[6].block, pl.days[6].items.map((it) => it.siteId)], ["hokitika-beach-driftwood-sign..star-tavern-cape-foulwind", ["pororari-river-track", "cape-foulwind-walkway-seal-colony"]]);
  // a day out comes home to a place that may run late, if the town has one to spare: Picton to Nelson in 10 days at 2 hours a
  // day, Easy, food on, spends day 2, a spare day in Nelson, at Nelson Lakes (three stops) and is back at Māpua Wharf, 3 to
  // 5; coming home to Rabbit Island (4 hours, done by 6) would leave time for two
  // (on the days before the West Coast ones: with them that trip goes round by Christchurch and the coast)
  const nl = buildTrips(before, pack, { start: "picton", end: "nelson", days: 10, drive: 120, pace: "easy", food: true, ...adv }).find((x) => x.key === "built-picton-10-oneway");
  assert.deepEqual([nl.days[1].block, nl.days[1].items.map((it) => it.siteId)], ["rest-nelson", ["lake-rotoiti-jetty-kerr-bay", "kawatiri-historic-railway-walk", "kerr-bay-short-walks", "mapua-wharf"]]);
  assert.deepEqual([lateOk(P["mapua-wharf"]), lateOk(P["moturoa-rabbit-island"])], [true, false]);
});

test("Mt John before the Dark Sky night, ahead of Tekapo Springs, and the next day leaves earlier (owner, 2026-11-25)", () => {
  // "is it possible to move mt john to before the dark sky and then bring the next day down so travel happens earlier?"
  assert.deepEqual(EARLIER, [{ siteId: "mt-john-summit-astro-cafe", before: "dark-sky-project-summit-experience" }]);
  const MJ = EARLIER[0].siteId, DS = EARLIER[0].before, none = { vibes: [], into: [], activities: [] }, ids = (d) => d.items.map((it) => it.siteId);
  const inHours = (it) => it.slotIndex >= lookup(MJ).open && it.slotIndex + it.durationSlots <= lookup(MJ).close;
  // the app's own trip, on the website: Christchurch to Queenstown via Tekapo and Mount Cook, food on: day 1 has it after the
  // bakehouse, 1:30 to 3, the springs then 3:30 to 6 (they were 1:30 to 4) and Dark Sky still 9:30; day 2 no longer has it,
  // and reaches Peters Lookout at 10:30, not 12:30. The app's days are as they were.
  const cq = buildTrips(data, pack, { start: "christchurch", end: "queenstown", days: 4, drive: 360, pace: "some", food: true, ...none }).find((x) => x.label === "Christchurch to Queenstown via Tekapo and Mount Cook");
  assert.deepEqual(cq.days[0].items.map((it) => [it.siteId, it.slotIndex, it.durationSlots]), [["fairlie-bakehouse", 8, 1], [MJ, 11, 3], ["tekapo-springs", 15, 5], [DS, 27, 1]]);
  assert.deepEqual(ids(cq.days[1]).slice(0, 2), ["church-of-the-good-shepherd", "peters-lookout"]);
  assert.deepEqual([cq.days[1].items[0].slotIndex, cq.days[1].items[1].slotIndex, blockById[cq.days[1].block].items.find((it) => it.siteId === "peters-lookout").slotIndex], [2, 5, 9]);
  assert.ok(!ids(cq.days[1]).includes(MJ) && blockById[cq.days[1].block].items.some((it) => it.siteId === MJ) && !blockById[cq.days[0].block].items.some((it) => it.siteId === MJ));
  // a built trip takes it there too, though the day after has it (it used to lose it to a main attraction there): Picton to
  // Queenstown in 7 days at 2 hours a day, Easy, food off: noon to 1:30, then the springs
  const pq = buildTrips(data, pack, { start: "picton", end: "queenstown", days: 7, drive: 120, pace: "easy", food: false, ...none }).find((x) => x.kind === "built");
  const tk = pq.days.find((d) => ids(d).includes(DS));
  assert.deepEqual(tk.items.map((it) => [it.siteId, it.slotIndex]), [[MJ, 8], ["tekapo-springs", 12], [DS, 27]]);
  // only where it ends by its close with Dark Sky still at its time: a made-up day that reaches the springs at 3 PM (Mt John
  // would run 3 to 4:30) keeps its days as they are; at 2:30 PM (2:30 to 4) it moves
  const stop = (siteId, slotIndex) => ({ siteId, siteName: lookup(siteId).name, slotIndex, durationSlots: lookup(siteId).slots });
  const nextDay = { id: "b", startTown: "tekapo", endTown: "aoraki-mount-cook", items: [stop("church-of-the-good-shepherd", 2), stop(MJ, 4), stop("peters-lookout", 9)] };
  const lateDay = (at) => ({ id: "a", startTown: "christchurch", endTown: "tekapo", items: [stop("tekapo-springs", at), { ...stop(DS, 27), durationSlots: 1 }] }); // (9:30 to 10 PM, as the app's days have it)
  const late = [lateDay(14), nextDay], justInTime = [lateDay(13), nextDay];
  assert.deepEqual(moveEarlier(late, pack, lookup).map((b) => b.items.map((it) => it.siteId)), late.map((b) => b.items.map((it) => it.siteId)));
  assert.deepEqual(moveEarlier(justInTime, pack, lookup).map((b) => b.items.map((it) => [it.siteId, it.slotIndex])), [[[MJ, 13], ["tekapo-springs", 17], [DS, 27]], [["church-of-the-good-shepherd", 2], ["peters-lookout", 5]]]);
  // across the sweep: on a Dark Sky day it comes before the springs, inside its hours (the road shuts at 4 PM). The only Dark
  // Sky days without it are Easy ones from Mount Cook (Easy takes it out as the day's second walk, after Hooker Valley), and
  // then it doesn't come back the morning after on the way out of Tekapo
  let nights = 0, withIt = 0; const after = [];
  for (const { answers, options } of sweep) for (const o of options) o.days.forEach((d, i) => {
    if (!ids(d).includes(DS)) return;
    nights++;
    const why = `${name(answers)} ${o.key} day ${i + 1}`, mj = d.items.find((it) => it.siteId === MJ), next = o.days[i + 1];
    if (mj) {
      withIt++;
      assert.ok(inHours(mj), why + ": Mt John outside its hours");
      const sp = d.items.find((it) => it.siteId === "tekapo-springs");
      if (blockOf(d).id.startsWith("fairlie-bakehouse")) assert.ok(sp && mj.slotIndex < sp.slotIndex, why + ": Mt John after the springs");
    } else {
      assert.ok(answers.pace === "easy" && blockOf(d).id.startsWith("hooker-valley-track"), why + ": no Mt John");
      if (next && next.town !== d.town && ids(next).includes(MJ)) after.push(why);
    }
  });
  console.log(`Dark Sky days in the sweep: ${nights}, with Mt John that day ${withIt}`);
  assert.ok(nights > 100 && withIt / nights > 0.8, `${withIt} of ${nights}`);
  assert.deepEqual(after, []);
});

test("Westport to Nelson through the Buller Gorge, and Greymouth up the coast to Westport (owner, 2026-11-25)", () => {
  const byId = Object.fromEntries(data.blocks.map((b) => [b.id, b]));
  assert.deepEqual(COAST_DAYS.map((id) => [byId[id].startTown, byId[id].endTown]), [["westport", "nelson"], ["greymouth", "westport"]]);
  // Picton to Nelson in 7 days spent four nights in Kaikōura (day 4 with Fyffe House alone) and drove back to Picton; now it
  // goes on to Christchurch through Hanmer, over Arthur's Pass and up the coast, and home through the Buller Gorge
  const nature = { vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] };
  for (const q of [{ drive: 120, pace: "easy", food: true }, { drive: 240, pace: "some", food: false }]) {
    const o = buildTrips(data, pack, { start: "picton", end: "nelson", days: 7, ...q, ...nature }).find((x) => x.key === "built-picton-7-oneway");
    assert.deepEqual(o.days.map((d) => d.town), ["kaikoura", "kaikoura", "christchurch", "christchurch", "greymouth", "westport", "nelson"], JSON.stringify(q));
    assert.deepEqual(o.days.slice(5).map((d) => d.block), COAST_DAYS.slice().reverse(), JSON.stringify(q));
    const b = buildTrips(before, pack, { start: "picton", end: "nelson", days: 7, ...q, ...nature }).find((x) => x.key === "built-picton-7-oneway");
    assert.equal(b.days.filter((d) => d.town === "kaikoura").length, 4, JSON.stringify(q));
  }
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
