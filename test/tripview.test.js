import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
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
// The app's days as TripOverview gets them: an id on every day and item.
const appDays = (o) => o.days.map((d, i) => ({ id: "day_" + (i + 1), date: d.date, items: d.items.map((it, k) => ({ ...it, id: i + "_" + k })) }));
// The app's dayStartSiteId: the last stop of the last earlier day that has one.
const startFrom = (o, n) => o.days.slice(0, n).filter((d) => d.items.length).pop()?.items.at(-1).siteId;
// TripOverview's own row words (components/itinerary/TripOverview.tsx).
const appMeta = (s) => s.placeCount === 0 ? "Nothing planned yet"
  : `${s.placeCount} ${s.placeCount === 1 ? "place" : "places"}` + (s.driveSlots > 0 ? ` · ${pack.slotsToDurationLabel(s.driveSlots).toLowerCase()} driving` : "");

test("rows match the app: date, route, places and driving, photo", () => {
  const rows = TV.tripRows(dunedin, pack, lookup), sum = pack.tripSummary(appDays(dunedin), lookup);
  assert.equal(rows.length, 12);
  rows.forEach((r, i) => {
    assert.equal(r.day, i + 1);
    assert.equal(r.dateLabel, `Day ${i + 1} · ${pack.dateParts(dunedin.days[i].date, "short")}`);
    assert.equal(r.route, pack.routeLine(sum[i].areas.map(pack.areaName)));
    assert.equal(r.meta, appMeta(sum[i]));
    assert.equal(r.overflows, sum[i].overflows);
    assert.equal(r.photo, dunedin.days[i].items.map(stopPhoto).filter(Boolean)[0] || "");
  });
  assert.equal(rows[0].dateLabel, "Day 1 · Fri 1 Jan");
  assert.match(rows[1].meta, /^\d+ places · [\d.]+ hours? driving$/);
  assert.ok(rows.some((r) => r.route.includes("→")), "a day between towns reads A → B");
  assert.match(TV.renderTrip(rows), /Day 2 · /);
});

test("opening drive: 'Starts with the drive from <town>' exactly when tripSummary has one", () => {
  for (const o of [dunedin, inv]) {
    const rows = TV.tripRows(o, pack, lookup), sum = pack.tripSummary(appDays(o), lookup);
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
  const n = inv.days.findIndex((d) => d.free);
  assert.ok(n > 0, "Invercargill 21 days has a free day");
  const row = TV.tripRows(inv, pack, lookup)[n];
  assert.equal(row.meta, "Nothing planned yet");
  assert.equal(row.route, pack.routeLine([pack.areaName(inv.days[n].town)]), "the town the traveller is in");
  assert.equal(row.photo, "");
  assert.match(TV.renderTrip([row]), /Nothing planned yet/);
  let tl;
  assert.doesNotThrow(() => { tl = TV.dayView(inv, n, pack, lookup); });
  assert.equal(tl.filter((x) => x.kind === "stop").length, 0);
  assert.equal(tl.filter((x) => x.kind === "hour").length, 15);
  assert.match(TV.renderDay(tl), /Nothing here yet/);
  // the day after it still opens with the drive from where the traveller last was (dayStartSiteId skips the free day)
  const sum = pack.tripSummary(appDays(inv), lookup);
  const opening = TV.dayView(inv, n + 1, pack, lookup).filter((x) => x.kind === "drive" && x.title.startsWith("Drive to") && x.slot === 0);
  assert.equal(opening.length, sum[n + 1].openingDrive ? 1 : 0);
});

test("timeline: stops at their slots with the app's time range, a drive item per leg, hour lines 8 AM to 10 PM", () => {
  assert.equal(TV.slotRangeLabel(15, 1, pack), "3:30 – 4:00 PM");
  assert.equal(TV.slotRangeLabel(7, 2, pack), "11:30 AM – 12:30 PM");
  assert.equal(TV.slotRangeLabel(0, 2, pack), "8:00 – 9:00 AM");
  for (const o of [dunedin, inv]) {
    const days = appDays(o);
    for (let n = 0; n < days.length; n++) {
      const prev = o.days.slice(0, n).filter((d) => d.items.length).pop();
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
  assert.match(html, /<use href="\/img\/icons\.svg#car"\/>/);
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
  const rows = TV.tripRows(dunedin, pack, lookup), n = dunedin.days.findIndex((d) => d.overLimit);
  assert.equal(rows[n].overLimit, dunedin.days[n].driveMinutes);
  assert.equal(rows.filter((r) => r.overLimit).length, dunedin.days.filter((d) => d.overLimit).length);
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

test("icons: a self-hosted Lucide sprite with its licence, every icon the view uses", () => {
  const svg = read("img/icons.svg");
  assert.match(svg, /Lucide[\s\S]*ISC License/);
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
  assert.ok(!/<script>/.test(html), "no inline script");
  const shown = [dunedin, inv].map((o) => TV.renderTrip(TV.tripRows(o, pack, lookup)) + o.days.map((_, n) => TV.renderDay(TV.dayView(o, n, pack, lookup))).join("")).join("");
  assert.ok(!/Itinerar|Plans\b|Location/.test(shown), "Trip and place words only");
});

test("budget: everything the quiz loads is under 300 KB gzipped", () => {
  const files = ["plan/index.html", "styles.css", "plan/measure.js", "plan/account.js", "plan/builder.js", "plan/tripview.js", "plan/quiz.js", "plan/pack.js", "plan/builder-data.json", "plan/trips.json", "img/icons.svg"];
  const total = files.reduce((s, f) => s + gzipSync(read(f)).length, 0);
  assert.ok(total < 300 * 1024, total + " bytes");
});
