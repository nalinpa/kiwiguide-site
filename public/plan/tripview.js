// The trip as the Kiwi Guide app shows it: its Trip view (components/itinerary/TripOverview.tsx) and a day's
// timeline (the Days view, components/itinerary/ItineraryDetailView.tsx / GuestDayView.tsx), read-only.
// Every number and word comes from the app's own functions in pack.js (KiwiPack). Pure: data in, markup out;
// the quiz (quiz.js, the reveal) puts it on the page and place() lays the day out.
(function () {
  "use strict";
  // The app's place-kind icons by a place's first category (components/map/SiteMarker.tsx CATEGORY_CONFIG),
  // as symbols in /img/icons.svg. Anything else gets the pin, as the app's "other".
  var ICON = { Food: "utensils", Attractions: "camera", Culture: "landmark", Walks: "footprints", Water: "waves", Scenic: "mountain-snow", Nature: "bird", Adventure: "zap", Stay: "bed-double" };
  var LAST_SLOT = 28; // 10 PM: the app's PLANNER.MAX_GRID_SLOTS, 30-minute slots from 8 AM
  // /img/* is cached for 7 days without a check (_headers), so the sprite goes by its content's version: the first
  // 8 hex of the sha1 of icons.svg with LF line endings (test/tripview.test.js recomputes it; change both together)
  var SPRITE = "/img/icons.svg?v=108ca655";

  function iconFor(category) { return ICON[(category || [])[0]] || "map-pin"; }
  function icon(id) { return '<svg class="tv-i" aria-hidden="true"><use href="' + SPRITE + "#" + id + '"/></svg>'; }
  var NOPIC = '<span class="tv-pic tv-nopic">' + icon("map-pin") + "</span>"; // a row with no photo (quiz.js swaps a failed one for it)
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // ponytail: the quiz's stopPhoto, a global once quiz.js has loaded in the page (it loads after this file, before any call)
  function photo(it) { return (typeof stopPhoto === "function" ? stopPhoto : require("./quiz.js").stopPhoto)(it); }

  // The app's slotRangeLabel (lib/utils/itineraryPhysics.ts): "3:30 – 4:00 PM", the first period left off when both match.
  function slotRangeLabel(slot, slots, pack) {
    var start = pack.slotIndexToTimeLabel(slot), end = pack.slotIndexToTimeLabel(slot + slots), p = start.split(" ");
    return (p[1] === end.split(" ")[1] ? p[0] : start) + " – " + end;
  }

  // One row per day, as TripOverview words it. `overLimit` is the day's driving in minutes when it is over the
  // visitor's limit (the quiz adds the line itself as `warn`, since only it knows the limit).
  function tripRows(option, pack, lookup) {
    var sum = pack.tripSummary(option.days, lookup);
    return option.days.map(function (d, i) {
      var s = sum[i];
      return {
        day: i + 1,
        dateLabel: "Day " + (i + 1) + " · " + pack.dateParts(d.date, "short"),
        route: pack.routeLine(s.areas.map(pack.areaName)),
        meta: s.placeCount === 0 ? "Nothing planned yet"
          : s.placeCount + (s.placeCount === 1 ? " place" : " places") + (s.driveSlots > 0 ? " · " + pack.slotsToDurationLabel(s.driveSlots).toLowerCase() + " driving" : ""),
        opening: s.openingDrive ? "Starts with the drive from " + pack.areaName(s.openingDrive.fromArea) : null,
        overflows: s.overflows,
        overLimit: d.overLimit ? d.driveMinutes : 0,
        // the first stop with its own photo (the app's row never shows a type default), else the first default
        photo: (d.items.filter(function (it) { return it.thumb; })[0] || {}).thumb || d.items.map(photo).filter(Boolean)[0] || "",
      };
    });
  }

  // A day's timeline: hour lines 8 AM to 10 PM, then the stops and drives in the order of the day. `prevDay` is
  // the last earlier day with a stop (the app's dayStartSiteId: a free day doesn't move the traveller).
  function dayTimeline(day, prevDay, pack, lookup) {
    var hours = [], items = [];
    for (var h = 0; h <= LAST_SLOT; h += 2) hours.push({ kind: "hour", slot: h, slots: 1, label: pack.slotIndexToTimeLabel(h).replace(":00", "") });
    day.items.forEach(function (it) {
      var slot = it.slotIndex || 0, slots = it.durationSlots || 2;
      items.push({ kind: "stop", slot: slot, slots: slots, name: it.siteName, time: slotRangeLabel(slot, slots, pack), icon: iconFor((lookup(it.siteId) || {}).category) });
    });
    var from = prevDay && prevDay.items.length ? prevDay.items[prevDay.items.length - 1].siteId : undefined;
    pack.dayLegs(day.items, lookup, from).forEach(function (l) {
      if (!l.drive) return items.push({ kind: "drive", slot: l.startSlot, slots: l.slots, title: l.slots * 30 + " min drive" }); // TransitBlock, in town
      var a = pack.areaName(l.drive.fromArea), b = pack.areaName(l.drive.toArea); // DriveBlock, between towns
      items.push({ kind: "drive", slot: l.startSlot, slots: l.slots, title: "Drive to " + b, via: l.slots > 1 ? a + " to " + b : "",
        detail: pack.slotIndexToTimeLabel(l.startSlot) + " · About " + pack.slotsToDurationLabel(l.slots).toLowerCase() });
    });
    return hours.concat(items.sort(function (x, y) { return x.slot - y.slot; }));
  }
  function dayView(option, n, pack, lookup) {
    return dayTimeline(option.days[n], option.days.slice(0, n).filter(function (d) { return d.items.length; }).pop(), pack, lookup);
  }
  function clampDay(n, option) { return Math.max(0, Math.min(option.days.length - 1, n | 0)); }

  // The Trip view: each row opens its day (data-act="tv-day"); `open` marks the open day (the side by side layout).
  function renderTrip(rows, open) {
    return '<ol class="tv-list">' + rows.map(function (r, i) {
      return '<li><button type="button" class="tv-row" data-act="tv-day" data-val="' + i + '"' + (i === open ? ' aria-current="true"' : "") + ">" +
        (r.photo ? '<img class="tv-pic" src="' + esc(r.photo) + '" alt="" width="72" height="72" loading="lazy">' : NOPIC) +
        '<span class="tv-body"><span class="tv-main"><span class="tv-date">' + esc(r.dateLabel) + "</span>" +
        (r.route ? '<span class="tv-route">' + esc(r.route) + "</span>" : "") +
        '<span class="tv-meta">' + esc(r.meta) + "</span>" +
        (r.opening ? '<span class="tv-open">' + icon("car") + esc(r.opening) + "</span>" : "") +
        (r.overflows ? '<span class="tv-over">Runs past 10 PM</span>' : "") +
        (r.warn ? '<span class="q-warn"><b>Long drive.</b> ' + esc(r.warn) + "</span>" : "") +
        "</span>" + icon("chevron-right") + "</span></button></li>";
    }).join("") + "</ol>";
  }

  // The Days view's timeline: nothing to tap or drag. Rows are placed on a grid by place() from data-slot.
  function renderDay(timeline) {
    var stops = timeline.some(function (x) { return x.kind === "stop"; });
    return '<div class="tv-grid">' + timeline.map(function (x) {
      var at = ' data-slot="' + x.slot + '" data-slots="' + x.slots + '">';
      // the hour lines are only a scale (each stop and drive says its own time), so a screen reader skips them
      if (x.kind === "hour") return '<div class="tv-hour" aria-hidden="true"' + at + "<span>" + esc(x.label) + "</span></div>";
      if (x.kind === "stop") return '<div class="tv-stop"' + at + icon(x.icon) + "<span><b>" + esc(x.name) + "</b><small>" + esc(x.time) + "</small></span></div>";
      if (!x.detail) return '<div class="tv-hop"' + at + icon("car") + esc(x.title) + "</div>";
      return '<div class="tv-drv"' + at + icon("car") + "<span><b>" + esc(x.title) + "</b>" + (x.via ? "<small>" + esc(x.via) + "</small>" : "") + "<small>" + esc(x.detail) + "</small></span></div>";
    }).join("") + (stops ? "" : '<div class="tv-none" data-slot="0" data-slots="2">Nothing here yet</div>') + "</div>";
  }
  // Grid rows through the CSSOM: the page's CSP allows no inline style attribute.
  function place(el) {
    Array.prototype.forEach.call(el.querySelectorAll("[data-slot]"), function (x) {
      x.style.gridRow = (+x.getAttribute("data-slot") + 1) + " / span " + x.getAttribute("data-slots");
    });
  }

  var api = { iconFor: iconFor, slotRangeLabel: slotRangeLabel, tripRows: tripRows, dayTimeline: dayTimeline, dayView: dayView, clampDay: clampDay, renderTrip: renderTrip, renderDay: renderDay, place: place, nopic: NOPIC };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.TripView = api;
})();
