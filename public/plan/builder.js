// The trip builder: a trip for the visitor's answers, strung together from the hand-checked day blocks.
// Pure functions, tested in test/builder.test.js. The page calls buildTrips(data, window.KiwiPack, answers)
// with data = /plan/builder-data.json.

var MAX_SLOT = 28; // 10 PM, the end of the app's day grid
// ponytail: the data has no opening hours, so a stop the builder adds ends by 6 PM, or 8 PM when it's outdoors
// (walks, scenic, nature, water only); add hours to the export if that's too blunt
var ADD_END = 20, ADD_END_OUTDOORS = 24;
var OUTDOORS = ["Walks", "Scenic", "Nature", "Water"];
var COST = { over: 1e6, overMinute: 100, free: 60, reuse: 300, dupe: 25, dupeSight: 60, emptyDay: 200, revisit: 40, match: 3, template: 8, town: 30 };
var BEAM = 6; // routes kept per town per day
var TRIES = 6; // candidate places tried per add
// A built day's main attractions (featured places) go in while its sights are fewer than this, by pace
var TOP_UP = { easy: 4, some: 5, hikes: 6 };

// The owner's town ranking (2026-11-23), most to least preferred: a night in a town near the top counts for a route and one
// near the bottom against it (the Catlins over Invercargill, Dunedin over Timaru and Ōamaru), and among equal places the
// one in the better town goes in first. Every builder-data town, once (test/builder.test.js).
var TOWNS_RANKED = [
  "queenstown", "milford-sound", "aoraki-mount-cook", "wanaka", "tekapo", "franz-josef", "abel-tasman", "kaikoura", "te-anau",
  "christchurch", "dunedin", "catlins", "fox-glacier", "punakaiki", "arrowtown", "glenorchy", "hokitika", "marlborough-sounds", "hanmer-springs", "haast",
  "arthurs-pass", "banks-peninsula", "nelson", "golden-bay", "twizel", "picton", "blenheim", "central-otago", "nelson-lakes",
  "oamaru", "westport", "greymouth", "waitaki-valley", "mid-canterbury", "murchison", "reefton",
  "timaru", "tuatapere", "riverton", "invercargill",
];
// +1 for the top town down to -1 for the bottom; a town not in the list counts as the middle
function townPref(t) { var i = TOWNS_RANKED.indexOf(t); return i < 0 ? 0 : 1 - 2 * i / (TOWNS_RANKED.length - 1); }

function foodOnly(p) { return p.category.length === 1 && p.category[0] === "Food"; }
function longWalk(p) { return p.category.indexOf("Walks") >= 0 && p.slots >= 4; }
// A sight the builder may put in by itself: not food (food tips come with the day blocks), a long walk only for Lots of walking.
function mayAdd(p, ans) { return !foodOnly(p) && (ans.pace === "hikes" || !longWalk(p)); }
function overlaps(a, b) { for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true; return false; }
function addEnd(p) { return p.category.every(function (c) { return OUTDOORS.indexOf(c) >= 0; }) ? ADD_END_OUTDOORS : ADD_END; }
function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

// Open one day a week: the builder doesn't know which weekday a trip day falls on, so it never adds these by itself
// (owner, 2026-11-23: Motueka Sunday Market). None is in a hand-checked day; one that was would stay there.
var ONE_DAY = ["motueka-sunday-market", "nelson-saturday-market"];

// One point each for a picked vibe, a picked category, a picked activity, and a long walk for big hikers.
function fitScore(p, ans) {
  if (!ans.food && foodOnly(p)) return 0;
  return (overlaps(ans.vibes, p.vibe) ? 1 : 0) + (overlaps(ans.into, p.category) ? 1 : 0) +
    (overlaps(ans.activities, p.activities) ? 1 : 0) + (ans.pace === "hikes" && longWalk(p) ? 1 : 0);
}

// What doesn't depend on the answers, worked out once per data object.
var prepared = typeof WeakMap !== "undefined" ? new WeakMap() : null;
function prepare(data) {
  var ctx = prepared && prepared.get(data);
  if (ctx) return ctx;
  var blocks = data.blocks.slice().sort(byId), food = [], stopIx = {}, nStops = 0, out = {}, stays = {}, pairs = {};
  blocks.forEach(function (b, i) {
    b = blocks[i] = { id: b.id, ix: i, startTown: b.startTown, endTown: b.endTown, driveMinutes: b.driveMinutes, items: b.items, stops: [] };
    b.items.forEach(function (it) {
      if (!(it.siteId in stopIx)) { food[nStops] = foodOnly(data.places[it.siteId]); stopIx[it.siteId] = nStops++; }
      b.stops.push(stopIx[it.siteId]);
    });
    (out[b.startTown] = out[b.startTown] || []).push(b);
    if (b.startTown === b.endTown) stays[b.startTown] = true;
  });
  var ixOf = {};
  blocks.forEach(function (b) { ixOf[b.id] = b; });
  data.templates.forEach(function (t) {
    t.blockIds.forEach(function (id, i) { pairs[(i ? t.blockIds[i - 1] : "^" + t.start) + ">" + id] = true; });
  });
  ctx = { blocks: blocks, byId: ixOf, out: out, stays: stays, pairs: pairs, stopIx: stopIx, food: food, words: Math.ceil(nStops / 32), near: {} };
  if (prepared) prepared.set(data, ctx);
  return ctx;
}

// The fewest free days needed to reach a target town in exactly r more days (missing = can't), never two free days
// in a row: need.any[r][town] when today may be free, need.after[r][town] when yesterday was free (so today can't be).
function freeNeeded(ctx, towns, targets, days, allowed, freeOk) {
  var any = [{}], after = [{}];
  targets.forEach(function (t) { any[0][t] = after[0][t] = 0; });
  for (var r = 1; r <= days; r++) {
    any[r] = {}; after[r] = {};
    for (var i = 0; i < towns.length; i++) {
      var t = towns[i], drive = Infinity;
      (ctx.out[t] || []).forEach(function (b) {
        if (allowed(b) && any[r - 1][b.endTown] !== undefined) drive = Math.min(drive, any[r - 1][b.endTown]);
      });
      var best = freeOk(t) && after[r - 1][t] !== undefined ? Math.min(drive, after[r - 1][t] + 1) : drive;
      if (drive < Infinity) after[r][t] = drive;
      if (best < Infinity) any[r][t] = best;
    }
  }
  return { any: any, after: after };
}
function freeCap(days) { return Math.floor(days / 4); }

// The best route of exactly ans.days days from ans.start to one of `targets`, as a beam search over the blocks.
// mode 0: within the drive limit, at most a quarter of the days free and never two in a row, in towns that have a town day;
// 1: any drive; 2 (last resort): free days anywhere, no cap.
function search(ctx, ans, targets, mode, pts) {
  var limit = ans.drive, n = ans.days, start = ans.start, cap = mode === 2 ? n : freeCap(n);
  var allowed = function (b) { return mode > 0 || b.driveMinutes <= limit; };
  var freeOk = function (t) { return mode === 2 || !!ctx.stays[t]; };
  var towns = Object.keys(ctx.out).concat(targets, [start]);
  var need = freeNeeded(ctx, towns, targets, n, allowed, freeOk);
  var can = function (r, town, free, wasFree) {
    var t = (wasFree ? need.after : need.any)[r];
    return t[town] !== undefined && free + t[town] <= cap;
  };
  if (!can(n, start, 0, false)) return null;
  var states = [{ town: start, cost: 0, key: "", seq: [], uses: new Uint8Array(ctx.blocks.length), mask: new Uint32Array(ctx.words), seen: "|" + start + "|", last: null, prevBlock: null, home: 0, free: 0, wasFree: false }];
  for (var day = 0; day < n; day++) {
    var rem = n - day - 1, next = [];
    states.forEach(function (s) {
      var moves = [], fresh = false;
      (ctx.out[s.town] || []).forEach(function (b) {
        if (!allowed(b) || s.uses[b.ix] >= 2 || b === s.last || !can(rem, b.endTown, s.free, false)) return;
        moves.push(b);
        if (!s.uses[b.ix]) fresh = true;
      });
      if (freeOk(s.town) && !s.wasFree && can(rem, s.town, s.free + 1, true)) { moves.push(null); fresh = true; } // never two free days in a row
      moves.forEach(function (b) {
        if (b && fresh && s.uses[b.ix]) return; // a block again only when nothing else is left
        next.push(step(ctx, ans, s, b, pts));
      });
    });
    var perTown = {};
    next.sort(cheaper);
    states = next.filter(function (s) { perTown[s.town] = (perTown[s.town] || 0) + 1; return perTown[s.town] <= BEAM; });
  }
  var loop = targets.length === 1 && targets[0] === start;
  states.forEach(function (s) { if (loop && s.home) s.cost -= COST.revisit; });
  states.sort(cheaper);
  var best = states[0];
  if (!best) return null;
  return { cost: best.cost, over: best.seq.filter(function (b) { return b && b.driveMinutes > limit; }).length, blocks: best.seq, end: best.town };
}

function cheaper(a, b) { return a.cost - b.cost || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); }

// A night's town in the route's cost (the owner's ranking): a good town draws the route there once, on arrival, so a trip
// doesn't circle its best towns; a night in a poor one always counts against it, and so does a free day there.
// seen: the towns the route has been to, "|a|b|".
function townCost(town, seen, free) {
  var pref = townPref(town);
  if (free) return COST.town * Math.max(0, -pref);
  return pref < 0 || seen.indexOf("|" + town + "|") < 0 ? -COST.town * pref : 0;
}

function step(ctx, ans, s, b, pts) {
  var t = { town: s.town, cost: s.cost, key: s.key + "|" + (b ? b.id : "~"), seq: s.seq.concat([b]), uses: s.uses, mask: s.mask, seen: s.seen, last: b, prevBlock: s.prevBlock, home: s.home, free: s.free, wasFree: !b };
  if (!b) { t.cost += COST.free + townCost(s.town, s.seen, true); t.free++; return t; }
  t.town = b.endTown;
  t.cost += townCost(b.endTown, s.seen, false);
  t.uses = s.uses.slice(); t.uses[b.ix]++;
  if (s.uses[b.ix]) t.cost += COST.reuse;
  if (b.driveMinutes > ans.drive) t.cost += COST.over + (b.driveMinutes - ans.drive) * COST.overMinute;
  if (b.endTown !== b.startTown && s.seen.indexOf("|" + b.endTown + "|") >= 0) {
    t.cost += COST.revisit;
    if (b.endTown === ans.start) t.home++;
  }
  t.seen = s.seen.indexOf("|" + b.endTown + "|") >= 0 ? s.seen : s.seen + b.endTown + "|";
  t.mask = s.mask.slice();
  var fresh = 0;
  b.stops.forEach(function (i) {
    var w = i >> 5, bit = 1 << (i & 31);
    if (t.mask[w] & bit) t.cost += ctx.food[i] ? COST.dupe : COST.dupeSight; // a repeated sight costs a free day
    else { fresh++; t.cost -= COST.match * pts[i]; t.mask[w] |= bit; }
  });
  if (!fresh) t.cost += COST.emptyDay; // every stop already done: a day of driving only
  if (ctx.pairs[(s.prevBlock ? s.prevBlock.id : "^" + ans.start) + ">" + b.id]) t.cost -= COST.template;
  t.prevBlock = b;
  return t;
}

function bestRoute(ctx, ans, targets, pts) {
  for (var mode = 0; mode < 3; mode++) {
    var r = search(ctx, ans, targets, mode, pts);
    if (r && mode === 2) r.cost += 1e9; // free days in a town with no town day: worse than any long drive
    if (r) return r;
  }
  return null;
}

// Time one day after the previous day's last stop, as the app would.
function packDay(pack, look, prevLast, items) {
  return pack.packTrip([{ items: prevLast ? [prevLast] : [] }, { items: items }], look)[1].items;
}
// Fits: packTrip moves nothing and nothing ends after 10 PM.
function fits(pack, look, prevLast, items) {
  var out = packDay(pack, look, prevLast, items);
  return out.every(function (it, k) { return it.slotIndex === items[k].slotIndex && it.slotIndex + it.durationSlots <= MAX_SLOT; });
}

// Stops taken out of a day leave holes: the app's packer only ever pushes a stop later, so the stops after a hole kept
// their old times (owner, 2026-11-23: "big gaps"). Close each hole: the stop after it moves up behind the stop before it
// (plus the hop between them), and the rest of the day follows, every pause the day had kept as it was. `before` is the
// day with the stops still in, `kept` the stops that stay (the same objects, in order). Nothing moves later, and nothing
// moves where nothing was taken out. Held: a meal moves at most an hour earlier; a night stop (7 PM or later: the stars
// need the dark) keeps its time, and so does everything before it, so the wait for dark is never longer than the day's
// own. When the day's first stops go, the next one starts when the day did (a sight no earlier than 9 AM).
var MEAL_EARLY = 2, NIGHT = 22, HOLE = 4; // a hole: two idle hours or more
function closeUp(pack, look, prevLast, before, kept) {
  if (kept.length === before.length || !kept.length) return packDay(pack, look, prevLast, kept);
  var held = -1, out = [];
  kept.forEach(function (it, i) { if (it.slotIndex >= NIGHT && !foodOnly(look(it.siteId))) held = i; });
  kept.forEach(function (it, i) {
    var p = look(it.siteId), prev = kept[i - 1], at = before.indexOf(it), was = it.slotIndex, to = was;
    var hole = prev ? at - before.indexOf(prev) > 1 : at > 0; // a stop went from just before this one
    if (i > held) {
      if (!prev) to = hole ? Math.min(was, Math.max(before[0].slotIndex, foodOnly(p) ? 0 : 2)) : was;
      else if (hole) to = Math.min(was, out[i - 1].slotIndex + prev.durationSlots + pack.getLeg(prev.siteId, it.siteId, look).slots);
      else to = was - (prev.slotIndex - out[i - 1].slotIndex); // the pause after the stop before, as the day has it
      if (foodOnly(p)) to = Math.max(to, was - MEAL_EARLY);
    }
    out.push({ siteId: it.siteId, siteName: it.siteName, slotIndex: to, durationSlots: it.durationSlots });
  });
  return packDay(pack, look, prevLast, out);
}

// The idle half-hours before a day's stop i: what is left between the stop before it and it, after the hop.
function idleBefore(pack, look, items, i) {
  var a = items[i - 1];
  return items[i].slotIndex - (a.slotIndex + a.durationSlots) - pack.getLeg(a.siteId, items[i].siteId, look).slots;
}

// A day's driving as the app shows it: the legs from `from` through the stops that cross from one area to another.
// (A block's driveMinutes is only the search's estimate: it counts from the start town's hub, before stops change.)
function driveOf(pack, look, from, items) {
  var slots = 0;
  items.forEach(function (it) { var leg = pack.getLeg(from, it.siteId, look); if (leg.drive) slots += leg.slots; from = it.siteId; });
  return slots * 30;
}

// Add the first candidate that goes in after a stop in its own area (or first thing, in the town the day starts in)
// without moving any other stop.
// Straight-line km between two places (near enough over the island).
function km(a, b) {
  var r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r;
  return 6371 * Math.sqrt(x * x + y * y);
}
// Is place c on the way from a to b? The trip keeps heading one way (owner, 2026-11-23).
// - Going by c may add 10 km, or 15% of the straight run (slack km instead of 10 when a thin day is being filled).
// - c may not lie behind a or beyond b by more than 10 km, whatever the slack: no nipping back to the town just left.
// - A hop inside one town (a to b under 15 km) is out and back by nature: 40 km of extra run, c within 20 km of both.
// A place without a position, or no a or b to go by, passes.
function onWay(a, c, b, slack) {
  if (!a || !b || !c) return true;
  var direct = km(a, b), ac = km(a, c), cb = km(c, b), town = direct < 15;
  if (ac + cb - direct > Math.max(town ? 40 : slack || 10, 0.15 * direct)) return false;
  return !(ac > direct + (town ? 20 : 10) || cb > direct + (town ? 20 : 10)); // a missing lat or lng (NaN) passes
}
// Where a town is, for the rule: its hub place, or the middle of its places when the hub isn't in the data (Wānaka's).
function townSpot(data, pack, town) {
  var hub = data.places[pack.hubs[town]];
  if (hub && hub.lat != null && hub.lng != null) return hub;
  var ps = ((data.towns[town] || {}).placeIds || []).map(function (id) { return data.places[id]; }).filter(function (p) { return p && p.lat != null && p.lng != null; });
  if (!ps.length) return null;
  return { lat: ps.reduce(function (n, p) { return n + p.lat; }, 0) / ps.length, lng: ps.reduce(function (n, p) { return n + p.lng; }, 0) / ps.length };
}

// ahead: where the day leads on to (tomorrow's first stop, or a town); fromSpot: where the day's start town is;
// at: the one position to try (before the stop now there; the place may then be in that stop's town too), else every position;
// arrive: the day's end town, whose places may also go where the day has arrived there (after the drive in).
function tryAdd(pack, look, prevLast, items, cands, from, tries, ahead, slack, fromSpot, at, arrive) {
  for (var c = 0; c < cands.length && c < (tries || TRIES); c++) {
    var p = cands[c];
    for (var pos = at == null ? 0 : at; pos <= (at == null ? items.length : at); pos++) {
      var after = pos ? items[pos - 1] : items[0];
      var here = !after || look(after.siteId).area === p.area || (!pos && p.area === from)
        || (at != null && pos < items.length && look(items[pos].siteId).area === p.area)
        || (!!arrive && p.area === arrive && items.slice(pos).every(function (it) { return look(it.siteId).area === arrive; }));
      if (!here) continue;
      // on the way from the stop before (or where yesterday ended, or the day's start town) to the stop after (or ahead)
      if (!onWay(pos ? look(items[pos - 1].siteId) : prevLast ? look(prevLast.siteId) : fromSpot, p, pos < items.length ? look(items[pos].siteId) : ahead, slack)) continue;
      var trial = items.slice();
      trial.splice(pos, 0, { siteId: p.id, siteName: p.name, slotIndex: pos ? after.slotIndex + after.durationSlots : 0, durationSlots: p.slots });
      var out = packDay(pack, look, prevLast, trial);
      var still = out.every(function (it, k) { return k === pos || it.slotIndex === trial[k].slotIndex; });
      if (still && out[pos].slotIndex + p.slots <= addEnd(p) && fits(pack, look, prevLast, out)) return out;
    }
  }
  return null;
}

// The towns a rest day may go out to and back (owner, 2026-11-24: Banks Peninsula from Christchurch, Wānaka from
// Queenstown): at most 90 minutes each way by the app's drive between the two towns' hubs, the owner's ranking first, then
// the nearer. A town's hub is its hub place, or (Wānaka's isn't in the data) its place nearest the middle of its places.
var DAY_OUT = { slots: 3 }; // half-hours each way, at most
function townHub(data, pack, town) {
  if (data.places[pack.hubs[town]]) return pack.hubs[town];
  var spot = townSpot(data, pack, town);
  return ((data.towns[town] || {}).placeIds || []).filter(function (id) { return data.places[id].lat != null && data.places[id].lng != null; })
    .sort(function (a, b) { return km(spot, data.places[a]) - km(spot, data.places[b]) || (a < b ? -1 : 1); })[0];
}
function nearbyTowns(data, pack, town) {
  var ctx = prepare(data), look = function (id) { return data.places[id]; }, key = town + ">" + DAY_OUT.slots;
  if (ctx.near[key]) return ctx.near[key];
  var from = townHub(data, pack, town);
  return (ctx.near[key] = Object.keys(data.towns).filter(function (t) { return t !== town; }).map(function (t) {
    var to = townHub(data, pack, t), leg = from && to ? pack.getLeg(from, to, look) : { drive: null };
    return { town: t, slots: leg.drive ? leg.slots : 0 };
  }).filter(function (x) { return x.slots && x.slots <= DAY_OUT.slots; }).sort(function (a, b) {
    return townPref(b.town) - townPref(a.town) || a.slots - b.slots || (a.town < b.town ? -1 : 1);
  }).map(function (x) { return x.town; }));
}

// A rest day out to a nearby town and back, the way the owner's own Glenorchy and Milford days go: the nearby town's places
// (cands, best first) while the day has room, then one of the home town's (ends: the first that works) for the evening, so
// the next day starts there. The builder adds no food, so that last place is a sight; an outdoor one may end as late as
// 8 PM. At most the pace's top-up of sights; null unless the day is within the visitor's driving.
function dayOut(pack, look, prevLast, ans, cands, ends) {
  for (var e = 0; e < ends.length; e++) {
    var end = { siteId: ends[e].id, siteName: ends[e].name, slotIndex: 0, durationSlots: ends[e].slots }, trip = [];
    for (var c = 0; c < cands.length && trip.length + 1 < TOP_UP[ans.pace]; c++) {
      var p = cands[c], last = trip[trip.length - 1];
      var out = packDay(pack, look, prevLast, trip.concat([{ siteId: p.id, siteName: p.name, slotIndex: last ? last.slotIndex + last.durationSlots : 0, durationSlots: p.slots }, end]));
      var k = trip.length;
      if (out[k].slotIndex + p.slots <= addEnd(p) && out[k + 1].slotIndex + end.durationSlots <= addEnd(ends[e]) && fits(pack, look, prevLast, out) &&
        trip.every(function (it, i) { return out[i].slotIndex === it.slotIndex; })) trip = out.slice(0, k + 1);
    }
    if (!trip.length) continue;
    var day = packDay(pack, look, prevLast, trip.concat([end]));
    if (driveOf(pack, look, prevLast.siteId, day) <= ans.drive) return day;
  }
  return null;
}

// Best fit first: answer matches, then featured, then the better town, then id.
function ranked(list, ans) {
  return list.map(function (p) { return { p: p, s: fitScore(p, ans) }; })
    .sort(function (a, b) { return b.s - a.s || (b.p.featured ? 1 : 0) - (a.p.featured ? 1 : 0) || townPref(b.p.area) - townPref(a.p.area) || (a.p.id < b.p.id ? -1 : 1); })
    .map(function (x) { return x.p; });
}

// Turn a route into the trip: food off, pace, picked activities and interests, each day timed by packTrip.
// A built route also drops a non-Food place an earlier day already has; a suggested trip keeps its own repeats.
function personalise(data, pack, ans, route) {
  var places = data.places, look = function (id) { return places[id]; };
  var townPlaces = function (t) { return data.towns[t] ? data.towns[t].placeIds.map(look) : []; };
  var used = {}, planned = {}, days = [];
  // the last stop of the nearest earlier day with stops: where the traveller is before day bi
  var lastBefore = function (bi) {
    for (var k = bi - 1; k >= 0; k--) if (days[k] && days[k].items.length) return days[k].items[days[k].items.length - 1];
    return null;
  };
  route.blocks.forEach(function (b) { if (b) b.items.forEach(function (it) { planned[it.siteId] = true; }); });
  var ok = function (p) { return !used[p.id] && (ans.food || !foodOnly(p)); };
  var spare = function (p) { return ok(p) && !planned[p.id] && ONE_DAY.indexOf(p.id) < 0; }; // never add a place the trip already has, or a one-day one
  var inRoute = {};
  route.blocks.forEach(function (b) {
    if (b) b.items.forEach(function (it) { if (ok(places[it.siteId])) places[it.siteId].activities.forEach(function (a) { inRoute[a] = true; }); });
  });
  var pending = ans.activities.filter(function (a) { return !inRoute[a]; });
  // the towns the route goes to: a rest day doesn't go out to one of them
  var visited = {};
  route.blocks.forEach(function (b) {
    if (b && b.items.length) { visited[b.startTown] = visited[b.endTown] = true; b.items.forEach(function (it) { visited[places[it.siteId].area] = true; }); }
  });
  var dayOf = function (b, bi) {
    var prevLast = lastBefore(bi);
    // where this day leads on to: tomorrow's first stop (the first that stays when food is off), else tomorrow's town, else the
    // finish; none on a rest day, which is based in its town, not travelling, so the direction rule doesn't hold it (owner, 2026-11-24)
    var nb = route.blocks[bi + 1], nf = nb && nb.items.filter(function (it) { return ans.food || !foodOnly(places[it.siteId]); })[0];
    var ahead = b.rest ? null : nf ? look(nf.siteId) : townSpot(data, pack, nb ? nb.endTown : route.end);
    var whole = b.items.map(function (it) {
      return { siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots };
    });
    var items = whole.filter(function (it) {
      var p = places[it.siteId];
      return foodOnly(p) ? ans.food : !(route.kind === "built" && used[p.id]);
    });
    var walks = items.filter(function (it) { return places[it.siteId].category.indexOf("Walks") >= 0; });
    if (ans.pace === "easy" && items.length > 3 && walks.length > 1) {
      // Easy: drop the day's longest walk that isn't featured (never its only walk), a walk that matches nothing first.
      walks = walks.filter(function (it) { return !places[it.siteId].featured; }).sort(function (x, y) {
        return y.durationSlots - x.durationSlots || fitScore(places[x.siteId], ans) - fitScore(places[y.siteId], ans) || (x.siteId < y.siteId ? -1 : 1);
      });
      if (walks.length) items.splice(items.indexOf(walks[0]), 1);
    }
    if (items.length) items = closeUp(pack, look, prevLast, whole, items); // stops removed: time the day again, their holes closed
    var areas = {};
    areas[b.endTown] = true;
    items.forEach(function (it) { areas[places[it.siteId].area] = true; });
    var near = [];
    Object.keys(areas).sort().forEach(function (a) { if (data.towns[a]) near = near.concat(data.towns[a].placeIds.map(look)); });
    near = near.filter(spare);
    var add = function (cands, tries, slack, at, arrive) {
      cands = cands.filter(function (p) { return !items.some(function (it) { return it.siteId === p.id; }); });
      var out = tryAdd(pack, look, prevLast, items, cands, b.startTown, tries, ahead, slack, townSpot(data, pack, b.startTown), at, arrive ? b.endTown : null);
      if (out) items = out;
      return !!out;
    };
    pending = pending.filter(function (a) {
      return !add(ranked(near.filter(function (p) { return p.activities.indexOf(a) >= 0; }), ans));
    });
    if (ans.pace === "hikes" && !items.some(function (it) { return longWalk(places[it.siteId]); }))
      add(ranked(near.filter(longWalk), ans));
    // A town day with room, or a drive day left with no stops, gets a place in town that fits the answers.
    if ((b.startTown === b.endTown && (ans.pace !== "easy" || items.length <= 3)) || !items.length) {
      add(ranked(townPlaces(b.endTown).filter(function (p) {
        return spare(p) && !foodOnly(p) && fitScore(p, ans) > 0; // food tips come with the day blocks
      }), ans));
    }
    // A built day left with fewer than 3 sights is topped up from its end town, then its start town.
    var sights = function () { return items.filter(function (it) { return !foodOnly(places[it.siteId]); }).length; };
    if (route.kind === "built") {
      var fill = ranked(townPlaces(b.endTown).filter(spare), ans).concat(b.startTown === b.endTown ? [] : ranked(townPlaces(b.startTown).filter(spare), ans))
        .filter(function (p) { return !foodOnly(p); });
      // a thin day may reach a little further off the way (40 km), never a long double back
      while (sights() < 3 && (add(fill, fill.length) || add(fill, fill.length, 40))) {}
      // A day left with no sight (every one it had was seen on an earlier day) takes its own towns' places (owner, 2026-11-24),
      // also one where the day has arrived in its end town, after the drive in.
      if (!sights()) while (sights() < 3 && (add(fill, fill.length) || add(fill, fill.length, 40) || add(fill, fill.length, undefined, undefined, true) || add(fill, fill.length, 40, undefined, true))) {}
      // The day's own towns' main attractions (featured; not food; a long walk only for Lots of walking) while the day has
      // room, best first (owner, 2026-11-23); then each one still out takes the place of a sight that is neither featured nor
      // a match for the answers, if it fits there.
      var feats = ranked(near.filter(function (p) { return p.featured && mayAdd(p, ans); }), ans);
      while (sights() < TOP_UP[ans.pace] && add(feats, feats.length)) {}
      feats.forEach(function (f) {
        if (items.some(function (it) { return it.siteId === f.id; })) return;
        var weak = items.filter(function (it) { var p = places[it.siteId]; return !p.featured && !foodOnly(p) && fitScore(p, ans) === 0; });
        for (var w = 0; w < weak.length; w++) {
          var keep = items;
          items = closeUp(pack, look, prevLast, items, items.filter(function (it) { return it !== weak[w]; }));
          if (add([f], 1)) return;
          items = keep;
        }
      });
    }
    // A meal is held near its time, so stops taken out before it can still leave two idle hours or more. A nearby place goes
    // in there if one fits (owner, 2026-11-23): from the town of the stop before the hole or the meal's own town, best fit
    // first, not food, a long walk only for Lots of walking, on the way to the meal (a thin day's 40 km reach if nothing closer
    // fits); no other stop moves. Then the same hole again if it is still one.
    for (var g = 1; g < items.length; g++) {
      if (!foodOnly(places[items[g].siteId]) || idleBefore(pack, look, items, g) < HOLE) continue;
      var t1 = places[items[g - 1].siteId].area, t2 = places[items[g].siteId].area;
      var into = ranked(townPlaces(t1).concat(t2 === t1 ? [] : townPlaces(t2)).filter(function (p) { return spare(p) && mayAdd(p, ans); }), ans);
      if (!add(into, into.length, undefined, g)) add(into, into.length, 40, g);
    }
    // A rest day its town can't fill (fewer than 3 sights) goes out to a nearby town and back instead if that makes a fuller
    // day (owner, 2026-11-24): a town the trip doesn't otherwise go to, the owner's ranking first; never the trip's first day.
    if (b.rest && prevLast && sights() < 3) {
      var stayed = sights(), spareSight = function (t) { return townPlaces(t).filter(function (p) { return spare(p) && mayAdd(p, ans); }); };
      var ends = ranked(spareSight(b.endTown), ans).sort(function (x, y) { return addEnd(y) - addEnd(x); }); // outdoor ones first: they keep later
      nearbyTowns(data, pack, b.endTown).some(function (n) {
        var trip = !visited[n] && dayOut(pack, look, prevLast, ans, ranked(spareSight(n), ans), ends);
        if (!trip || trip.length <= stayed) return false; // every stop of a day out is a sight
        items = trip; visited[n] = true;
        return true;
      });
    }
    // The one final check every returned day passes, whatever removed or added its stops: packTrip moves nothing
    // and nothing ends after 10 PM; otherwise drop the last stop and time the day again.
    while (items.length && !fits(pack, look, prevLast, items)) items = packDay(pack, look, prevLast, items.slice(0, -1));
    // Nothing left: the traveller stays put, as the app takes an empty day.
    if (!items.length) return { town: b.endTown, block: b.id, free: true, items: [] };
    items.forEach(function (it) { used[it.siteId] = true; });
    return { town: b.endTown, block: b.id, items: items.map(function (it) {
      return { siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots, timeLabel: it.timeLabel, durationLabel: it.durationLabel };
    }) };
  };
  // A rest day takes what the trip's other days leave (owner, 2026-11-24): every other day first, in order (a rest day still
  // empty then), then the rest days.
  route.blocks.forEach(function (b, bi) { if (!b.rest) days[bi] = dayOf(b, bi); });
  route.blocks.forEach(function (b, bi) { if (b.rest) days[bi] = dayOf(b, bi); });
  // Each day timed and its driving counted from where the traveller really was before it, which a rest day filled after the
  // day that follows it can change: the final check again, then the day's drive against the limit.
  days.forEach(function (d, bi) {
    if (d.free) return;
    var from = lastBefore(bi), items = d.items;
    if (!fits(pack, look, from, items)) items = packDay(pack, look, from, items); // timed again from there
    while (items.length && !fits(pack, look, from, items)) items = packDay(pack, look, from, items.slice(0, -1));
    if (!items.length) { days[bi] = { town: d.town, block: d.block, free: true, items: [] }; return; }
    d.items = items;
    d.driveMinutes = driveOf(pack, look, from ? from.siteId : pack.hubs[route.blocks[bi].startTown], items);
    if (d.driveMinutes > ans.drive) d.overLimit = true;
  });
  var has = {};
  days.forEach(function (d) { d.items.forEach(function (it) { places[it.siteId].activities.forEach(function (a) { has[a] = true; }); }); });
  return { days: days, missing: ans.activities.filter(function (a) { return !has[a]; }) };
}

// buildTrips(data, pack, answers) -> up to three trip options, best first.
// Suggested trips with the same start and length always come first (over-limit days marked); then the best loop
// and the best one-way built from the blocks, the one-way only when it scores at least as well as the loop.
// answers.end, when given, is where the trip finishes: the start for a loop only, another start town for a one-way there only.
function buildTrips(data, pack, ans) {
  var ctx = prepare(data), pts = new Array(ctx.words * 32);
  Object.keys(ctx.stopIx).forEach(function (id) { pts[ctx.stopIx[id]] = fitScore(data.places[id], ans); });
  var loopOk = !ans.end || ans.end === ans.start;
  var ends = !ans.end ? data.starts.filter(function (s) { return s !== ans.start; }) : loopOk ? [] : [ans.end];
  var loop = loopOk ? bestRoute(ctx, ans, [ans.start], pts) : null, oneWay = ends.length ? bestRoute(ctx, ans, ends, pts) : null;
  var built = [];
  if (loop) built.push(loop);
  if (oneWay && (!loop || oneWay.cost <= loop.cost)) built.push(oneWay);
  built.sort(function (a, b) { return a.cost - b.cost; });
  built = built.filter(function (r, i) { return !i || r.cost < 1e9; }); // free days anywhere only when nothing else goes
  // No loop of this length at all (Nelson in 2 days: its one block out leads away): every day in the start town, which
  // personalise fills from the town's own places as it tops up any town day; kept only if every day gets places.
  if (!built.length && loopOk) {
    var stay = { id: "stay-" + ans.start, startTown: ans.start, endTown: ans.start, driveMinutes: 0, items: [] };
    built.push({ cost: 0, over: 0, end: ans.start, blocks: new Array(ans.days).fill(stay), stay: true });
  }
  // Every free day of a built route (a last-resort route's too: Dunedin and back in 3 days, review 2026-11-23) is a rest day
  // ("rest-<town>", owner 2026-11-24), spent in the town it is in and filled from the town's places like any town day, or
  // out to a nearby town and back.
  built.forEach(function (r) {
    var at = ans.start;
    r.blocks = r.blocks.map(function (b) {
      if (b) { at = b.endTown; return b; }
      return { id: "rest-" + at, startTown: at, endTown: at, driveMinutes: 0, items: [], rest: true };
    });
  });
  built.forEach(function (r) {
    r.kind = "built";
    r.key = "built-" + ans.start + "-" + ans.days + "-" + (r.end === ans.start ? "loop" : "oneway");
    r.label = "South Island in " + ans.days + " Days";
  });
  var suggested = data.templates.filter(function (t) { return t.start === ans.start && t.blockIds.length === ans.days; }).map(function (t) {
    var blocks = t.blockIds.map(function (id) { return ctx.byId[id]; });
    return { kind: "suggested", key: t.key, label: t.label, blocks: blocks, end: blocks[blocks.length - 1].endTown };
  }).filter(function (r) { return !ans.end || r.end === ans.end; });
  return suggested.concat(built).slice(0, 3).map(function (r) {
    var p = personalise(data, pack, ans, r);
    if (r.stay && p.days.some(function (d) { return d.free; })) return null; // the town ran out of places
    return { kind: r.kind, key: r.key, label: r.label, start: ans.start, end: r.end, days: p.days, missing: p.missing };
  }).filter(Boolean);
}

if (typeof module !== "undefined") module.exports = { buildTrips: buildTrips, TOWNS_RANKED: TOWNS_RANKED, townCost: townCost, TOP_UP: TOP_UP, onWay: onWay, townSpot: townSpot, closeUp: closeUp, mayAdd: mayAdd, ONE_DAY: ONE_DAY, nearbyTowns: nearbyTowns, DAY_OUT: DAY_OUT };
