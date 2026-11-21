// The trip builder: a trip for the visitor's answers, strung together from the hand-checked day blocks.
// Pure functions, tested in test/builder.test.js. The page calls buildTrips(data, window.KiwiPack, answers)
// with data = /plan/builder-data.json.

var MAX_SLOT = 28; // 10 PM, the end of the app's day grid
// ponytail: the data has no opening hours, so a stop the builder adds ends by 6 PM, or 8 PM when it's outdoors
// (walks, scenic, nature, water only); add hours to the export if that's too blunt
var ADD_END = 20, ADD_END_OUTDOORS = 24;
var OUTDOORS = ["Walks", "Scenic", "Nature", "Water"];
var COST = { over: 1e6, overMinute: 100, free: 60, reuse: 300, dupe: 25, dupeSight: 60, emptyDay: 200, revisit: 40, match: 3, template: 8 };
var BEAM = 6; // routes kept per town per day
var TRIES = 6; // candidate places tried per add

function foodOnly(p) { return p.category.length === 1 && p.category[0] === "Food"; }
function longWalk(p) { return p.category.indexOf("Walks") >= 0 && p.slots >= 4; }
function overlaps(a, b) { for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true; return false; }
function addEnd(p) { return p.category.every(function (c) { return OUTDOORS.indexOf(c) >= 0; }) ? ADD_END_OUTDOORS : ADD_END; }
function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

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
  ctx = { blocks: blocks, byId: ixOf, out: out, stays: stays, pairs: pairs, stopIx: stopIx, food: food, words: Math.ceil(nStops / 32) };
  if (prepared) prepared.set(data, ctx);
  return ctx;
}

// The fewest free days needed to reach a target town in exactly r more days: need[r][town] (missing = can't).
function freeNeeded(ctx, towns, targets, days, allowed, freeOk) {
  var need = [{}];
  targets.forEach(function (t) { need[0][t] = 0; });
  for (var r = 1; r <= days; r++) {
    need[r] = {};
    for (var i = 0; i < towns.length; i++) {
      var t = towns[i], best = freeOk(t) && need[r - 1][t] !== undefined ? need[r - 1][t] + 1 : Infinity;
      (ctx.out[t] || []).forEach(function (b) {
        if (allowed(b) && need[r - 1][b.endTown] !== undefined) best = Math.min(best, need[r - 1][b.endTown]);
      });
      if (best < Infinity) need[r][t] = best;
    }
  }
  return need;
}
function freeCap(days) { return Math.floor(days / 4); }

// The best route of exactly ans.days days from ans.start to one of `targets`, as a beam search over the blocks.
// mode 0: within the drive limit, at most a quarter of the days free, in towns that have a town day;
// 1: any drive; 2 (last resort): free days anywhere, no cap.
function search(ctx, ans, targets, mode, pts) {
  var limit = ans.drive, n = ans.days, start = ans.start, cap = mode === 2 ? n : freeCap(n);
  var allowed = function (b) { return mode > 0 || b.driveMinutes <= limit; };
  var freeOk = function (t) { return mode === 2 || !!ctx.stays[t]; };
  var towns = Object.keys(ctx.out).concat(targets, [start]);
  var need = freeNeeded(ctx, towns, targets, n, allowed, freeOk);
  var can = function (r, town, free) { return need[r][town] !== undefined && free + need[r][town] <= cap; };
  if (!can(n, start, 0)) return null;
  var states = [{ town: start, cost: 0, key: "", seq: [], uses: new Uint8Array(ctx.blocks.length), mask: new Uint32Array(ctx.words), seen: "|" + start + "|", last: null, prevBlock: null, home: 0, free: 0 }];
  for (var day = 0; day < n; day++) {
    var rem = n - day - 1, next = [];
    states.forEach(function (s) {
      var moves = [], fresh = false;
      (ctx.out[s.town] || []).forEach(function (b) {
        if (!allowed(b) || s.uses[b.ix] >= 2 || b === s.last || !can(rem, b.endTown, s.free)) return;
        moves.push(b);
        if (!s.uses[b.ix]) fresh = true;
      });
      if (freeOk(s.town) && can(rem, s.town, s.free + 1)) { moves.push(null); fresh = true; }
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

function step(ctx, ans, s, b, pts) {
  var t = { town: s.town, cost: s.cost, key: s.key + "|" + (b ? b.id : "~"), seq: s.seq.concat([b]), uses: s.uses, mask: s.mask, seen: s.seen, last: b, prevBlock: s.prevBlock, home: s.home, free: s.free };
  if (!b) { t.cost += COST.free; t.free++; return t; }
  t.town = b.endTown;
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

// Add the first candidate that goes in after a stop in its own area (or first thing, in the town the day starts in)
// without moving any other stop.
function tryAdd(pack, look, prevLast, items, cands, from, tries) {
  for (var c = 0; c < cands.length && c < (tries || TRIES); c++) {
    var p = cands[c];
    for (var pos = 0; pos <= items.length; pos++) {
      var after = pos ? items[pos - 1] : items[0];
      if (after && look(after.siteId).area !== p.area && !(!pos && p.area === from)) continue;
      var trial = items.slice();
      trial.splice(pos, 0, { siteId: p.id, siteName: p.name, slotIndex: pos ? after.slotIndex + after.durationSlots : 0, durationSlots: p.slots });
      var out = packDay(pack, look, prevLast, trial);
      var still = out.every(function (it, k) { return k === pos || it.slotIndex === trial[k].slotIndex; });
      if (still && out[pos].slotIndex + p.slots <= addEnd(p) && fits(pack, look, prevLast, out)) return out;
    }
  }
  return null;
}

// Best fit first: answer matches, then featured, then id.
function ranked(list, ans) {
  return list.map(function (p) { return { p: p, s: fitScore(p, ans) }; })
    .sort(function (a, b) { return b.s - a.s || (b.p.featured ? 1 : 0) - (a.p.featured ? 1 : 0) || (a.p.id < b.p.id ? -1 : 1); })
    .map(function (x) { return x.p; });
}

// Turn a route into the trip: food off, pace, picked activities and interests, each day timed by packTrip.
// A built route also drops a non-Food place an earlier day already has; a suggested trip keeps its own repeats.
function personalise(data, pack, ans, route) {
  var places = data.places, look = function (id) { return places[id]; };
  var townPlaces = function (t) { return data.towns[t] ? data.towns[t].placeIds.map(look) : []; };
  var used = {}, prevLast = null, at = ans.start, planned = {};
  route.blocks.forEach(function (b) { if (b) b.items.forEach(function (it) { planned[it.siteId] = true; }); });
  var ok = function (p) { return !used[p.id] && (ans.food || !foodOnly(p)); };
  var spare = function (p) { return ok(p) && !planned[p.id]; }; // never add a place the trip already has
  var inRoute = {};
  route.blocks.forEach(function (b) {
    if (b) b.items.forEach(function (it) { if (ok(places[it.siteId])) places[it.siteId].activities.forEach(function (a) { inRoute[a] = true; }); });
  });
  var pending = ans.activities.filter(function (a) { return !inRoute[a]; });
  var days = route.blocks.map(function (b) {
    if (!b) return { town: at, free: true, items: [] };
    at = b.endTown;
    var items = b.items.filter(function (it) {
      var p = places[it.siteId];
      return foodOnly(p) ? ans.food : !(route.kind === "built" && used[p.id]);
    }).map(function (it) {
      return { siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots };
    });
    var walks = items.filter(function (it) { return places[it.siteId].category.indexOf("Walks") >= 0; });
    if (ans.pace === "easy" && items.length > 3 && walks.length > 1) {
      // Easy: drop the day's longest walk that isn't featured (never its only walk), a walk that matches nothing first.
      walks = walks.filter(function (it) { return !places[it.siteId].featured; }).sort(function (x, y) {
        return y.durationSlots - x.durationSlots || fitScore(places[x.siteId], ans) - fitScore(places[y.siteId], ans) || (x.siteId < y.siteId ? -1 : 1);
      });
      if (walks.length) items.splice(items.indexOf(walks[0]), 1);
    }
    if (items.length) items = packDay(pack, look, prevLast, items); // stops removed: time the day again
    var areas = {};
    areas[b.endTown] = true;
    items.forEach(function (it) { areas[places[it.siteId].area] = true; });
    var near = [];
    Object.keys(areas).sort().forEach(function (a) { if (data.towns[a]) near = near.concat(data.towns[a].placeIds.map(look)); });
    near = near.filter(spare);
    var add = function (cands, tries) {
      cands = cands.filter(function (p) { return !items.some(function (it) { return it.siteId === p.id; }); });
      var out = tryAdd(pack, look, prevLast, items, cands, b.startTown, tries);
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
      while (sights() < 3 && add(fill, fill.length)) {}
    }
    // The one final check every returned day passes, whatever removed or added its stops: packTrip moves nothing
    // and nothing ends after 10 PM; otherwise drop the last stop and time the day again.
    while (items.length && !fits(pack, look, prevLast, items)) items = packDay(pack, look, prevLast, items.slice(0, -1));
    items.forEach(function (it) { used[it.siteId] = true; });
    if (items.length) prevLast = items[items.length - 1];
    var day = { town: b.endTown, block: b.id, items: items.map(function (it) {
      return { siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots, timeLabel: it.timeLabel, durationLabel: it.durationLabel };
    }) };
    if (b.driveMinutes > ans.drive) day.overLimit = true;
    return day;
  });
  var has = {};
  days.forEach(function (d) { d.items.forEach(function (it) { places[it.siteId].activities.forEach(function (a) { has[a] = true; }); }); });
  return { days: days, missing: ans.activities.filter(function (a) { return !has[a]; }) };
}

// buildTrips(data, pack, answers) -> up to three trip options, best first.
// Suggested trips with the same start and length always come first (over-limit days marked); then the best loop
// and the best one-way built from the blocks, the one-way only when it scores at least as well as the loop.
function buildTrips(data, pack, ans) {
  var ctx = prepare(data), pts = new Array(ctx.words * 32);
  Object.keys(ctx.stopIx).forEach(function (id) { pts[ctx.stopIx[id]] = fitScore(data.places[id], ans); });
  var others = data.starts.filter(function (s) { return s !== ans.start; });
  var loop = bestRoute(ctx, ans, [ans.start], pts), oneWay = bestRoute(ctx, ans, others, pts);
  var built = [];
  if (loop) built.push(loop);
  if (oneWay && (!loop || oneWay.cost <= loop.cost)) built.push(oneWay);
  built.sort(function (a, b) { return a.cost - b.cost; });
  built = built.filter(function (r, i) { return !i || r.cost < 1e9; }); // free days anywhere only when nothing else goes
  built.forEach(function (r) {
    r.kind = "built";
    r.key = "built-" + ans.start + "-" + ans.days + "-" + (r.end === ans.start ? "loop" : "oneway");
    r.label = "South Island in " + ans.days + " Days";
  });
  var suggested = data.templates.filter(function (t) { return t.start === ans.start && t.blockIds.length === ans.days; }).map(function (t) {
    var blocks = t.blockIds.map(function (id) { return ctx.byId[id]; });
    return { kind: "suggested", key: t.key, label: t.label, blocks: blocks, end: blocks[blocks.length - 1].endTown };
  });
  return suggested.concat(built).slice(0, 3).map(function (r) {
    var p = personalise(data, pack, ans, r);
    return { kind: r.kind, key: r.key, label: r.label, start: ans.start, end: r.end, days: p.days, missing: p.missing };
  });
}

if (typeof module !== "undefined") module.exports = { buildTrips: buildTrips };
