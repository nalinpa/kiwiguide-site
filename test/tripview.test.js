import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const TV = require("../public/plan/tripview.js");
const { buildTrips } = require("../public/plan/builder.js");
const { tripBody } = require("../public/plan/account.js");
const { stopPhoto } = require("../public/plan/quiz.js");
const pack = require("../public/plan/pack.js");
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const read = (p) => readFileSync(new URL("../public/" + p, import.meta.url), "utf8");
const lookup = (id) => data.places[id];
const base = { pace: "some", drive: 240, vibes: ["nature", "relax"], into: ["Scenic", "Walks"], food: true, activities: ["hot-pools"] };
// As the quiz shows it: each stop with its place's photo, the days dated as the saved trip (tripBody) dates them.
const dated = (o, start) => ({ ...o, days: o.days.map((d, i) => ({ ...d, date: tripBody(o, start, String).days[i].date, items: d.items.map((it) => ({ ...it, thumb: lookup(it.siteId).thumb, fallback: lookup(it.siteId).fallback })) })) });
const dunedin = dated(buildTrips(data, pack, { ...base, start: "dunedin", days: 12 })[0], "2027-01-01");
const inv = dated(buildTrips(data, pack, { ...base, start: "invercargill", days: 21 })[0], "2027-01-01");
// A trip with a day left empty, as the app takes one. The builder no longer leaves one (a day its town can't fill moves,
// owner 2026-11-24), but a trip can still have one, so the fixture puts one in: Christchurch to Queenstown in 18 days at 2
// hours a day, food off, an empty day where the traveller is, before the first day that opens with a drive of over half an
// hour to another town (the day view names both towns on one that long).
const rest = (() => {
  const o = buildTrips(data, pack, { ...base, start: "christchurch", days: 18, drive: 120, food: false })[0];
  const area = (it) => lookup(it.siteId).area;
  const j = o.days.findIndex((d, i) => i > 1 && d.items.length && o.days[i - 1].items.length && area(d.items[0]) !== area(o.days[i - 1].items.at(-1)) &&
    pack.getLeg(o.days[i - 1].items.at(-1).siteId, d.items[0].siteId, lookup).slots > 1);
  const at = area(o.days[j - 1].items.at(-1));
  return dated({ ...o, days: [...o.days.slice(0, j), { town: at, block: "rest-" + at, free: true, items: [] }, ...o.days.slice(j)] }, "2027-01-01");
})();
// The app's days as TripOverview gets them: an id on every day and item.
const appDays = (o) => o.days.map((d, i) => ({ id: "day_" + (i + 1), date: d.date, items: d.items.map((it, k) => ({ ...it, id: i + "_" + k })) }));
// Where the trip starts, as a day before day 1 with one stop at the start town's hub: the app's own functions then give
// day 1 its opening drive from there (owner, 2026-11-24: day 1 is timed from the start town; the app's days don't know it).
const lead = (o) => ({ id: "start", items: [{ id: "start", siteId: pack.hubs[o.start], slotIndex: 0, durationSlots: 1 }] });
const summary = (o) => pack.tripSummary([lead(o)].concat(appDays(o)), lookup).slice(1);
// The app's dayStartSiteId: the last stop of the last earlier day that has one (before day 1, the start town's hub).
const startFrom = (o, n) => o.days.slice(0, n).filter((d) => d.items.length).pop()?.items.at(-1).siteId ?? pack.hubs[o.start];
// TripOverview's own row words (components/itinerary/TripOverview.tsx).
const appMeta = (s) => s.placeCount === 0 ? "Nothing planned yet"
  : `${s.placeCount} ${s.placeCount === 1 ? "place" : "places"}` + (s.driveSlots > 0 ? ` · ${pack.slotsToDurationLabel(s.driveSlots).toLowerCase()} driving` : "");

test("rows match the app: date, route, places and driving, photo", () => {
  const rows = TV.tripRows(dunedin, pack, lookup), sum = summary(dunedin);
  assert.equal(rows.length, 12);
  rows.forEach((r, i) => {
    assert.equal(r.day, i + 1);
    assert.equal(r.dateLabel, `Day ${i + 1} · ${pack.dateParts(dunedin.days[i].date, "short")}`);
    assert.equal(r.route, pack.routeLine(sum[i].areas.map(pack.areaName)));
    assert.equal(r.meta, appMeta(sum[i]));
    assert.equal(r.overflows, sum[i].overflows);
    assert.equal(r.photo, (dunedin.days[i].items.find((it) => it.thumb) || {}).thumb || dunedin.days[i].items.map(stopPhoto).filter(Boolean)[0] || "");
  });
  // the first stop with its own photo, before a type default (the app's row never shows one)
  for (const o of [dunedin, inv]) TV.tripRows(o, pack, lookup).forEach((r, i) => {
    if (o.days[i].items.some((it) => it.thumb)) assert.ok(!r.photo.startsWith("/img/places/"), `day ${i + 1}: ${r.photo}`);
  });
  assert.equal(rows[0].dateLabel, "Day 1 · Fri 1 Jan");
  assert.match(rows[1].meta, /^\d+ places · [\d.]+ hours? driving$/);
  assert.ok(rows.some((r) => r.route.includes("→")), "a day between towns reads A → B");
  assert.match(TV.renderTrip(rows), /Day 2 · /);
});

test("opening drive: 'Starts with the drive from <town>' exactly when tripSummary has one", () => {
  for (const o of [dunedin, inv]) {
    const rows = TV.tripRows(o, pack, lookup), sum = summary(o);
    rows.forEach((r, i) => {
      const od = sum[i].openingDrive;
      assert.equal(r.opening, od ? "Starts with the drive from " + pack.areaName(od.fromArea) : null, "day " + (i + 1));
    });
  }
  const rows = TV.tripRows(dunedin, pack, lookup);
  assert.ok(rows.some((r) => r.opening), "some day opens with a drive");
  assert.match(TV.renderTrip(rows), /Starts with the drive from /);
});

test("free day: a row and a day view in the app's empty-day form", () => {
  const n = rest.days.findIndex((d) => d.free);
  assert.ok(n > 0 && n < rest.days.length - 1, "Christchurch to Queenstown in 18 days has an empty day");
  const row = TV.tripRows(rest, pack, lookup)[n];
  assert.equal(row.meta, "Nothing planned yet");
  assert.equal(row.route, pack.routeLine([pack.areaName(rest.days[n].town)]), "the town the traveller is in");
  assert.equal(row.photo, "");
  assert.match(TV.renderTrip([row]), /Nothing planned yet/);
  assert.ok(TV.renderTrip([row]).includes(TV.nopic), "a photo that fails is swapped for this same pin (quiz.js)");
  let tl;
  assert.doesNotThrow(() => { tl = TV.dayView(rest, n, pack, lookup); });
  assert.equal(tl.filter((x) => x.kind === "stop").length, 0);
  assert.equal(tl.filter((x) => x.kind === "hour").length, 15);
  assert.match(TV.renderDay(tl), /Nothing here yet/);
  // the day after it still opens with the drive from where the traveller last was (dayStartSiteId skips the free day)
  const sum = summary(rest), first = rest.days[n + 1].items[0].slotIndex;
  const opening = TV.dayView(rest, n + 1, pack, lookup).filter((x) => x.kind === "drive" && x.title.startsWith("Drive to") && x.slot + x.slots <= first);
  assert.equal(opening.length, sum[n + 1].openingDrive ? 1 : 0);
  assert.ok(sum[n + 1].openingDrive, "the day after opens with a drive");
  assert.ok(opening[0].via.startsWith(pack.areaName(sum[n + 1].openingDrive.fromArea) + " to "), opening[0].via);
});

test("timeline: stops at their slots with the app's time range, a drive item per leg, hour lines 8 AM to 10 PM", () => {
  assert.equal(TV.slotRangeLabel(15, 1, pack), "3:30 – 4:00 PM");
  assert.equal(TV.slotRangeLabel(7, 2, pack), "11:30 AM – 12:30 PM");
  assert.equal(TV.slotRangeLabel(0, 2, pack), "8:00 – 9:00 AM");
  for (const o of [dunedin, inv]) {
    const days = appDays(o);
    for (let n = 0; n < days.length; n++) {
      const prev = o.days.slice(0, n).filter((d) => d.items.length).pop() || lead(o);
      const tl = TV.dayTimeline(o.days[n], prev, pack, lookup);
      assert.deepEqual(tl, TV.dayView(o, n, pack, lookup));
      const stops = tl.filter((x) => x.kind === "stop");
      assert.deepEqual(stops.map((s) => [s.name, s.slot, s.slots, s.time, s.icon]),
        o.days[n].items.map((it) => [it.siteName, it.slotIndex, it.durationSlots, TV.slotRangeLabel(it.slotIndex, it.durationSlots, pack), TV.iconFor(lookup(it.siteId).category)]));
      const legs = pack.dayLegs(days[n].items, lookup, startFrom(o, n));
      const drives = tl.filter((x) => x.kind === "drive");
      assert.equal(drives.length, legs.length, "day " + (n + 1));
      drives.forEach((d, k) => {
        const l = legs[k];
        assert.deepEqual([d.slot, d.slots], [l.startSlot, l.slots]);
        if (l.drive) {
          // DriveBlock: "Drive to <town>", "<from> to <to>" when over half an hour, "<time> · About <length>"
          assert.equal(d.title, "Drive to " + pack.areaName(l.drive.toArea));
          assert.equal(d.via, l.slots > 1 ? pack.areaName(l.drive.fromArea) + " to " + pack.areaName(l.drive.toArea) : "");
          assert.equal(d.detail, pack.slotIndexToTimeLabel(l.startSlot) + " · About " + pack.slotsToDurationLabel(l.slots).toLowerCase());
        } else assert.equal(d.title, l.slots * 30 + " min drive"); // the TransitBlock's words in town
      });
      // in the order of the day, as the app reads it
      const at = tl.filter((x) => x.kind !== "hour").map((x) => x.slot);
      assert.deepEqual(at, at.slice().sort((a, b) => a - b));
    }
  }
  const hours = TV.dayView(dunedin, 0, pack, lookup).filter((x) => x.kind === "hour");
  assert.deepEqual(hours.map((h) => h.label), ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM"]);
  assert.deepEqual(hours.map((h) => h.slot), hours.map((_, i) => i * 2));
  // the category icon from the app's mapping (SiteMarker's CATEGORY_CONFIG, first category), a pin for anything else
  assert.equal(TV.iconFor(["Walks", "Food"]), "footprints");
  assert.equal(TV.iconFor(["Water"]), "waves");
  assert.equal(TV.iconFor([]), "map-pin");
  assert.equal(TV.iconFor(undefined), "map-pin");
  const html = TV.renderDay(TV.dayView(dunedin, 1, pack, lookup));
  assert.match(html, /data-slot="0" data-slots="1"><span>8 AM<\/span>/);
  // the hour labels are only a scale (every stop and drive says its own time): a screen reader skips them
  assert.deepEqual(html.match(/class="tv-hour"[^>]*/g).map((h) => h.includes('aria-hidden="true"')), Array(15).fill(true));
  // the sprite by its content's version: /img/* is cached for 7 days without a check, so a changed sprite needs a new URL
  const v = createHash("sha1").update(read("img/icons.svg").replace(/\r\n/g, "\n")).digest("hex").slice(0, 8);
  assert.ok(html.includes(`<use href="/img/icons.svg?v=${v}#car"/>`), "icons.svg?v=" + v);
});

test("day 1 opens with the drive from the start town when its first stop is in another (owner, 2026-11-24)", () => {
  // Dunedin to Christchurch in 3 days: day 1 goes up the coast from Kātiki Point
  const o = dated(buildTrips(data, pack, { ...base, start: "dunedin", end: "christchurch", days: 3 })[0], "2027-01-01");
  const first = o.days[0].items[0], to = pack.areaName(lookup(first.siteId).area);
  assert.notEqual(lookup(first.siteId).area, "dunedin", "day 1 starts out of town");
  const row = TV.tripRows(o, pack, lookup)[0], sum = summary(o)[0];
  assert.ok(sum.openingDrive && sum.driveSlots > 0, "the app's summary from the start town's hub has the drive");
  assert.equal(row.opening, "Starts with the drive from Dunedin");
  assert.equal(row.meta, appMeta(sum));
  const opening = TV.dayView(o, 0, pack, lookup).filter((x) => x.kind === "drive" && x.slot + x.slots <= first.slotIndex);
  assert.equal(opening.length, 1);
  assert.equal(opening[0].title, "Drive to " + to);
  assert.equal(opening[0].via, "Dunedin to " + to);
  // a trip that starts where its first stop is: nothing before it (Dunedin's day 1 is in Dunedin)
  assert.equal(TV.tripRows(dunedin, pack, lookup)[0].opening, null);
});

test("option switch: the open day is kept when it exists, else the last day", () => {
  assert.equal(TV.clampDay(6, dunedin), 6);
  assert.equal(TV.clampDay(6, { days: dunedin.days.slice(0, 5) }), 4);
  assert.equal(TV.clampDay(-1, dunedin), 0);
  assert.equal(TV.clampDay(NaN, dunedin), 0);
});

test("no editing: the Days view has no drag handle or control", () => {
  for (const o of [dunedin, inv]) for (let n = 0; n < o.days.length; n++) {
    const html = TV.renderDay(TV.dayView(o, n, pack, lookup));
    assert.ok(!/grip|draggable|contenteditable|<input|<button|<select|<textarea|<a /i.test(html), "day " + (n + 1));
    assert.ok(!/style=/.test(html), "no inline style (the CSP has no unsafe-inline)");
  }
  assert.ok(!/style=/.test(TV.renderTrip(TV.tripRows(inv, pack, lookup))));
});

test("long drive: the row says so", () => {
  // (Christchurch to Queenstown in 18 days at 2 hours a day has long days; Dunedin in 12 at 4 hours no longer does)
  const rows = TV.tripRows(rest, pack, lookup), n = rest.days.findIndex((d) => d.overLimit);
  assert.equal(rows[n].overLimit, rest.days[n].driveMinutes);
  assert.equal(rows.filter((r) => r.overLimit).length, rest.days.filter((d) => d.overLimit).length);
  assert.match(TV.renderTrip([{ ...rows[n], warn: "About 5 h of driving." }]), /<b>Long drive\.<\/b> About 5 h of driving\./);
  assert.doesNotMatch(TV.renderTrip([{ ...rows[n], warn: "" }]), /Long drive/);
});

test("colours: the app's tokens, light and dark, as CSS custom properties", () => {
  const css = read("styles.css");
  const used = [...new Set(css.match(/var\(--tv-[a-zA-Z0-9]+\)/g).map((v) => v.slice(9, -1)))];
  assert.ok(used.length > 5);
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const darkAt = css.search(/@media \(prefers-color-scheme: dark\) \{\r?\n  :root \{/);
  const dark = css.slice(darkAt, css.indexOf("}", darkAt));
  for (const k of used) {
    assert.ok(pack.tokens[k], k + " is an app token");
    assert.ok(root.includes(`--tv-${k}: ${pack.tokens[k].light};`), k + " light");
    assert.ok(dark.includes(`--tv-${k}: ${pack.tokens[k].dark};`), k + " dark");
  }
});

// A small cascade over styles.css, enough for the reveal's rows: rules by media, selectors of types, classes and
// attributes with the descendant and child combinators (anything with a pseudo-class never matches), specificity then
// order, colour inherited, backgrounds composited down to the page.
const cssRules = (src, media = "") => {
  const out = [];
  for (let i = 0, open; (open = src.indexOf("{", i)) >= 0; ) {
    let d = 1, j = open + 1;
    while (d && j < src.length) d += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0, j++;
    if (d) throw new Error("unbalanced { in styles.css");
    const pre = src.slice(i, open).trim(), body = src.slice(open + 1, j - 1);
    if (pre.startsWith("@media")) out.push(...cssRules(body, pre));
    else if (!pre.startsWith("@")) out.push({ media, sels: pre.split(","), body });
    i = j;
  }
  return out;
};
const applies = (media, scheme, w) => [...media.matchAll(/\(([\w-]+):\s*([\w-]+)\)/g)].every(([, k, v]) =>
  k === "min-width" ? w >= parseInt(v) : k === "max-width" ? w <= parseInt(v) : k === "prefers-color-scheme" && v === scheme);
const domOf = (html) => {
  const root = { tag: "", attrs: {}, kids: [] };
  let cur = root;
  for (const [, close, tag, attrs, self, text] of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*?)(\/?)>|([^<]+)/gi)) {
    if (text !== undefined) { if (text.trim()) cur.kids.push({ text }); }
    else if (close) cur = cur.parent;
    else {
      const el = { tag, attrs: Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ""])), kids: [], parent: cur };
      cur.kids.push(el);
      if (!self && tag !== "img") cur = el;
    }
  }
  return root;
};
const compound = (el, c) => {
  const m = c.match(/^([a-z][\w-]*)?((?:\.[\w-]+|#[\w-]+|\[[^\]]*\])*)$/i);
  if (!m || !el.tag || (m[1] && m[1] !== el.tag)) return false;
  return (m[2].match(/\.[\w-]+|#[\w-]+|\[[^\]]*\]/g) || []).every((p) => p[0] === "." ? (el.attrs.class || "").split(" ").includes(p.slice(1))
    : p[0] === "#" ? el.attrs.id === p.slice(1)
    : (([, k, v]) => k in el.attrs && (v === undefined || el.attrs[k] === v))(p.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/)));
};
const matches = (el, sel) => {
  const parts = sel.trim().replace(/\s*>\s*/g, " > ").split(/\s+/);
  const at = (e, i) => {
    if (!e || !compound(e, parts[i])) return false;
    if (i === 0) return true;
    if (parts[i - 1] === ">") return at(e.parent, i - 2);
    for (let a = e.parent; a; a = a.parent) if (at(a, i - 1)) return true;
    return false;
  };
  return at(el, parts.length - 1);
};
const specificity = (sel) => { const s = sel.replace(/\[[^\]]*\]/g, ".a"); return 1e4 * (s.match(/#/g) || []).length + 100 * (s.match(/\./g) || []).length + (s.match(/(^|[\s>])[a-z]/gi) || []).length; };
const rgba = (v) => {
  if (v[0] === "#") { const h = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join("") : v.slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  const p = v.match(/[\d.]+/g).map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const over = (top, under) => [0, 1, 2].map((i) => top[3] * top[i] + (1 - top[3]) * under[i]).concat(1);
const lum = (c) => c.slice(0, 3).map((x) => (x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
function styleOf(css, scheme, w) {
  const rules = cssRules(css.replace(/\/\*[\s\S]*?\*\//g, "")).filter((r) => applies(r.media, scheme, w));
  const vars = Object.fromEntries(rules.filter((r) => r.sels.some((s) => s.trim() === ":root")).flatMap((r) => [...r.body.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()])));
  const value = (v) => v.replace(/var\((--[\w-]+)\)/g, (_, k) => value(vars[k]));
  const declared = (el, prop) => {
    let best;
    for (const r of rules) {
      const v = r.body.match(new RegExp("(?:^|;)\\s*" + prop + ":\\s*([^;]+)"));
      if (v) for (const s of r.sels) if (matches(el, s) && (!best || specificity(s) >= best.k)) best = { k: specificity(s), v: value(v[1].trim()) };
    }
    return best && best.v;
  };
  const colour = (el) => { const v = declared(el, "color"); return !v || v === "inherit" ? colour(el.parent) : rgba(v); };
  const bg = (el) => {
    if (!el.tag) return [255, 255, 255, 1]; // the canvas, under the body's own paper
    const v = declared(el, "background(?:-color)?"), under = bg(el.parent);
    return !v || v === "none" || v === "transparent" ? under : over(rgba(v), under);
  };
  return { colour, bg };
}

test("cascade: an unbalanced { fails the run instead of hanging it", () => {
  assert.throws(() => cssRules("a { b"), /unbalanced/);
});

test("open row: every word on it keeps 4.5:1 on the row's fill, light and dark (as the app's detailSelected)", () => {
  const css = read("styles.css");
  // every line a row can show: the long-drive day with an opening drive and "Runs past 10 PM" forced on, and a free day
  const rows = TV.tripRows(rest, pack, lookup), n = rest.days.findIndex((d, i) => d.overLimit && rows[i].opening);
  const all = { ...rows[n], overflows: true, warn: "About 5 h of driving. Over your 4 h limit." };
  const free = TV.tripRows(rest, pack, lookup)[rest.days.findIndex((d) => d.free)];
  assert.ok(all.opening && all.route && free.meta === "Nothing planned yet");
  const seen = new Set(), low = [];
  for (const scheme of ["light", "dark"]) for (const w of [375, 1024]) for (const open of [0, 1]) {
    const S = styleOf(css, scheme, w);
    const page = domOf('<html><body class="quiz"><main id="q" class="q-main"><div id="tv" class="q-days tv tv-on-trip"><div class="tv-trip">' + TV.renderTrip([all, free], open) + "</div></div></main></body></html>");
    const els = [];
    const walk = (e) => { els.push(e); e.kids.forEach((k) => k.kids && walk(k)); };
    walk(page);
    const row = els.find((e) => e.attrs["aria-current"] === "true");
    // side by side, the open row is on selFill over the page (the test reads the real fill, not a copy of it)
    if (w >= 1024) assert.deepEqual(S.bg(row).map(Math.round), over(rgba(pack.tokens.selFill[scheme]), S.bg(row.parent)).map(Math.round), "the open row's fill");
    // its "Runs past 10 PM" keeps the app's warning colour in dark (4.73:1 there); light takes the text colour
    if (w >= 1024 && open === 0) assert.deepEqual(S.colour(els.find((e) => e.attrs.class === "tv-over")), rgba(pack.tokens[scheme === "dark" ? "warning" : "text"][scheme]), scheme + " Runs past 10 PM");
    for (const el of els.filter((e) => e !== page && e.kids.some((k) => k.text) && (() => { for (let a = e; a; a = a.parent) if (a === row) return true; })())) {
      const name = el.attrs.class || el.tag, b = S.bg(el), r = contrast(over(S.colour(el), b), b);
      seen.add(name);
      if (r < 4.5) low.push(`${scheme} ${w}px ${name} "${el.kids.filter((k) => k.text).map((k) => k.text).join("").trim()}" ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual([...seen].sort(), ["b", "q-warn", "tv-date", "tv-meta", "tv-open", "tv-over", "tv-route"], "every kind of text a row shows was checked");
  assert.deepEqual(low, [], "text under 4.5:1 on the open row");
});

test("icons: a self-hosted Lucide sprite with its licence, every icon the view uses", () => {
  const svg = read("img/icons.svg");
  assert.match(svg, /Lucide[\s\S]*ISC License/);
  // the licences' own conditions: their permission notices ship with the icons (ISC, and MIT for the Feather-derived chevron-right)
  const lic = read("img/icons-LICENSE.txt");
  assert.match(lic, /Permission to use, copy, modify, and\/or distribute/);
  assert.match(lic, /Cole Bemis/);
  assert.match(svg, /<!--[^>]*\/img\/icons-LICENSE\.txt[^>]*-->/, "the sprite names the licence file");
  for (const c of svg.match(/<!--[\s\S]*?-->/g)) assert.ok(!c.slice(4, -3).includes("--"), "no -- inside a comment, or the sprite stops parsing");
  const cats = ["Food", "Attractions", "Culture", "Walks", "Water", "Scenic", "Nature", "Adventure", "Stay", "other"];
  for (const id of [...cats.map((c) => TV.iconFor([c])), "car", "chevron-right"])
    assert.match(svg, new RegExp(`<symbol id="${id}" viewBox="0 0 24 24"`), id);
  assert.ok(!/https?:\/\/(?!www\.w3\.org|lucide\.dev)/.test(svg), "nothing loaded from elsewhere");
});

test("wired in: script tag before quiz.js, the reveal uses the view, no inline script", () => {
  const html = read("plan/index.html"), src = read("plan/quiz.js");
  assert.ok(html.indexOf('src="/plan/tripview.js"') > 0 && html.indexOf('src="/plan/tripview.js"') < html.indexOf('src="/plan/quiz.js"'));
  assert.match(src, /TripView\.tripRows\(/);
  assert.match(src, /TripView\.dayView\(/);
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), "no inline script");
  const shown = [dunedin, inv].map((o) => TV.renderTrip(TV.tripRows(o, pack, lookup)) + o.days.map((_, n) => TV.renderDay(TV.dayView(o, n, pack, lookup))).join("")).join("");
  assert.ok(!/itinerar|\bplans\b|\blocations?\b/i.test(shown), "Trip and place words only");
  // and the reveal's own words, which quiz.js writes (the switch, the tabs, the heading, the notes, any later line)
  assert.deepEqual(src.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g).filter((s) => /itinerar|\bplans\b|\blocations?\b/i.test(s)), [], "Trip and place words in quiz.js");
  // the trip view first on a phone's first screen; each activity's line after it
  assert.match(src, /<div id="tv" class="q-days tv"><\/div>' \+ notes/);
  // the open day is a named, focusable region, so a keyboard can scroll it side by side
  assert.match(src, /class="tv-days" tabindex="0" role="region" aria-label="/);
  // a day picked from another day's evening opens at its morning, under the strip
  assert.match(src, /if \(act === "tv-tab"\) \{ var dv = root\.querySelector\("\.tv-days"\); if \(dv\.getBoundingClientRect\(\)\.top < root\.getBoundingClientRect\(\)\.top\) dv\.scrollIntoView\(\); \}/);
  // a phone row tap leaves focus on the open day's tab, not the top of the page
  assert.match(src, /scrollIntoView\(\); root\.querySelector\('\.tv-tab\[aria-pressed="true"\]'\)\.focus\(\{ preventScroll: true \}\);/);
  // if the view can't paint (tripview.js lost on the way), the reveal says so and still finishes
  assert.match(src, /if \(name === "reveal"\) try \{ paintTrip\(\); \} catch/);
  // the layout repaints when it crosses the breakpoint (an iPad turned), with the same query as styles.css
  const q = src.match(/var WIDE = matchMedia\("([^"]+)"\);/);
  assert.ok(q && read("styles.css").includes("@media " + q[1] + " {"), "the breakpoint styles.css uses");
  assert.match(src, /WIDE\.addEventListener\("change", /);
  // Start again opens the next reveal on Trip
  assert.match(src, /act === "again"\) \{ tv = \{ pick: null, view: "trip", day: 0 \};/);
  // a row photo that fails becomes the free day's pin (no inline onerror: the CSP)
  assert.match(src, /root\.addEventListener\("error", function \(e\) \{[^\n]*tv-pic[^\n]*TripView\.nopic[^\n]*\}, true\);/);
});

test("budget: everything the quiz loads is under 300 KB gzipped", () => {
  const files = ["plan/index.html", "styles.css", "plan/measure.js", "plan/account.js", "plan/builder.js", "plan/tripview.js", "plan/quiz.js", "plan/pack.js", "plan/builder-data.json", "plan/trips.json", "img/icons.svg"];
  const total = files.reduce((s, f) => s + gzipSync(read(f)).length, 0);
  assert.ok(total < 300 * 1024, total + " bytes");
});
