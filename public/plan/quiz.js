// The trip quiz: where you start, how long, when, how you like to travel, then a trip built for the answers (builder.js).
// The pure functions at the top are tested (test/quiz.test.js); the page code at the bottom only runs in a browser.

var PHOTO = "https://api.blacksands.app/images/southislandguide/";
// fact: the first photo break's line, true of the town itself (never a place the route may skip)
var TOWNS = [
  { id: "queenstown", name: "Queenstown", sub: "Fly in to the lakes and mountains, with Wānaka and Milford Sound close by.", fact: "The world’s first commercial bungy jump opened here, off the Kawarau Bridge, in 1988.", img: PHOTO + "a6904a0d-2c8e-4f25-b533-e51241d6665e.webp" },
  { id: "christchurch", name: "Christchurch", sub: "Fly in to the Garden City, then inland to Tekapo and Mount Cook or up the coast to Kaikōura.", fact: "Its Botanic Gardens have grown beside the Avon River since 1863.", img: PHOTO + "2f5a12e0-dfbc-4fcd-a7bc-f86ca3e0e0dd.webp" },
  { id: "picton", name: "Picton", sub: "Off the ferry from Wellington, into the Marlborough Sounds, Nelson and Abel Tasman.", fact: "The Cook Strait ferries from Wellington dock right in town.", img: PHOTO + "7711e2f4-268e-4f3e-ab25-30d72a357cbe.webp" },
  // Larnach Castle, Moturoa / Rabbit Island, Stirling Point (Bluff): featured places in each town
  { id: "dunedin", name: "Dunedin", sub: "Wildlife, castles and steep streets, then south to the Catlins or inland to Central Otago.", fact: "The world’s only mainland royal albatross colony is at Taiaroa Head, inside the city limits.", img: PHOTO + "93b9fe65-f916-449e-90f3-9574ff1aef75.webp" },
  { id: "nelson", name: "Nelson", sub: "Golden beaches and Abel Tasman on the sunny top of the island.", fact: "It’s one of the sunniest towns in New Zealand.", img: PHOTO + "2afe072b-3dc4-478e-868d-9a76d3a17775.webp" },
  { id: "invercargill", name: "Invercargill", sub: "The far south: Bluff, the Catlins and Fiordland.", fact: "New Zealand’s southernmost city, and Burt Munro’s home town.", img: PHOTO + "c370321b-5445-4bc3-b38f-33b1164c909f.webp" },
];

var STEPS = ["start", "days", "break1", "season", "month", "pace", "drive", "vibe", "break2", "into", "food", "activities", "choice", "reveal", "account", "done"];

var PACES = [
  { id: "easy", label: "Easy", hint: "Short walks, mostly flat. Skips the longest walk on a busy day." },
  { id: "some", label: "Some walking", hint: "A mix: a few good walks, nothing all day." },
  { id: "hikes", label: "Big hikes", hint: "Adds the long walks of two hours or more in each town." },
];
var DRIVES = [
  { id: 120, label: "A little", hint: "Up to 2 hours a day" },
  { id: 240, label: "Some", hint: "Up to 4 hours a day" },
  { id: 360, label: "Happy to drive", hint: "Up to 6 hours a day" },
];
var VIBES = [
  { id: "relax", label: "Relax", hint: "Beaches, cafés, a slower day" },
  { id: "sightseeing", label: "Sightseeing", hint: "Lookouts, towns and the famous views" },
  { id: "nature", label: "Nature", hint: "Forest, lakes, wildlife and quiet" },
  { id: "adventure", label: "Adventure", hint: "Jet boats, bungy and big days out" },
];
// The place categories, less Food (its own question)
var INTO = [
  { id: "Scenic", label: "Scenic", hint: "Lookouts and big views" },
  { id: "Walks", label: "Walks", hint: "From a short stroll to a day out" },
  { id: "Nature", label: "Nature", hint: "Wildlife, lakes and forest" },
  { id: "Water", label: "Water", hint: "Beaches, boats, swimming" },
  { id: "Culture", label: "Culture", hint: "Museums, history and local stories" },
  { id: "Attractions", label: "Attractions", hint: "Gondolas, castles and the famous things" },
  { id: "Adventure", label: "Adventure", hint: "Jet boats, bungy and big days out" },
];
var ACTIVITIES = [
  { id: "surfing", label: "Surfing", hint: "Surf beaches on the route" },
  { id: "skiing", label: "Skiing", hint: "Only offered June to October" },
  { id: "hot-pools", label: "Hot pools", hint: "Tekapo Springs and more" },
  { id: "mountain-biking", label: "Mountain biking", hint: "Trails and bike parks" },
  { id: "kayaking", label: "Kayaking", hint: "Lakes and bays" },
  { id: "wildlife", label: "Wildlife", hint: "Penguins, seals, albatross and kiwi" },
  { id: "stargazing", label: "Stargazing", hint: "Dark-sky towns" },
  { id: "wine", label: "Wine", hint: "Cellar doors and tastings" },
];
// The second photo break: the first picked vibe in this order, else the last. The site's own photos (docs/photo-sources.md).
var VIBE_PHOTOS = [
  { vibe: "adventure", img: "/img/photo-shotover-jet-1200.webp", credit: "Photo: Shotover Jet, CC0, via Wikimedia Commons" },
  { vibe: "nature", img: "/img/photo-diamond-lake-1200.webp", credit: "Photo: Diamond Lake, public domain, via Wikimedia Commons" },
  { vibe: "relax", img: "/img/photo-gore-bay-1200.webp", credit: "Photo: Cathedral Cliffs, Gore Bay, Michal Klajban, CC BY-SA 4.0, resized" },
  { vibe: "sightseeing", img: "/img/photo-pukaki-1200.webp", credit: "Photo: Lake Pukaki, Francis Vallance (Heritage Warrior), CC BY 2.0, resized" },
];

var SEASONS = [
  { id: "summer", feel: "Warm days for swimming and long evenings. Peak season, so book ahead.", label: "Summer", hint: "December to February", months: [11, 0, 1], line: "Summer: book the popular stays and cruises early. It’s the busiest time of year." },
  { id: "autumn", feel: "Quieter roads, settled weather and gold trees in Central Otago.", label: "Autumn", hint: "March to May", months: [2, 3, 4], line: "Autumn: quieter roads and gold trees in Central Otago. Nights get cold." },
  { id: "winter", feel: "Snow on the mountains and the ski fields. Cold nights, and some passes close.", label: "Winter", hint: "June to August", months: [5, 6, 7], line: "Winter: check the passes for snow before you drive, and carry chains." },
  { id: "spring", feel: "Lambs, waterfalls in full flow and fewer crowds. The weather changes fast.", label: "Spring", hint: "September to November", months: [8, 9, 10], line: "Spring: lambs and long days. Some walks close for lambing." },
];
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function seasonOf(month) {
  return SEASONS.filter(function (s) { return s.months.indexOf(month) >= 0; })[0].id;
}
function seasonLine(season) {
  var s = SEASONS.filter(function (x) { return x.id === season; })[0];
  return s ? s.line : null;
}
function monthsOf(season, today) {
  var s = SEASONS.filter(function (x) { return x.id === season; })[0];
  if (!s) return [];
  return s.months.map(function (m) {
    return { month: m, year: today.getFullYear() + (m >= today.getMonth() ? 0 : 1) };
  }).sort(function (a, b) { return a.year - b.year || a.month - b.month; });
}
function iso(y, m, d) {
  var dt = new Date(y, m, d);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}
function startDateFor(answer, today) {
  var m = answer.month;
  if (!m && answer.season) m = monthsOf(answer.season, today)[0];
  if (!m) return iso(today.getFullYear(), today.getMonth() + 2, 1);
  if (m.year === today.getFullYear() && m.month === today.getMonth()) return iso(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return iso(m.year, m.month, 1);
}

// One separator everywhere: a dot with a space each side. Every screen is written with " · " and its dots swapped on render (see dots),
// because Overpass draws its middle dot (U+00B7) off to the left, so it reads as "·a"; U+2219 is centred.
var SEP = " ∙ ";

// A stop's picture: its own photo, else the app's default for it (self-hosted), else "".
function stopPhoto(i) { return i.thumb || (i.fallback ? "/img/places/" + i.fallback + ".webp" : ""); }
function plainStop(i) { return i.thumb && i.category.indexOf("Food") < 0 && i.category.indexOf("Stay") < 0; }
// A card photo for each trip: a stop that is not Food or Stay, from day 2 on when there is one, and not one an earlier card used.
// Falls back to any such stop, then any stop with a photo, then "" (a plain tile).
function tripPhotos(list) {
  var used = {};
  return list.map(function (t) {
    var days = t.days.length > 1 ? t.days.slice(1).concat(t.days.slice(0, 1)) : t.days;
    var items = [];
    days.forEach(function (d) { items = items.concat(d.items); });
    var pick = items.filter(function (i) { return plainStop(i) && !used[i.thumb]; })[0] || items.filter(plainStop)[0] || items.filter(function (i) { return i.thumb; })[0];
    if (!pick) { pick = items.filter(stopPhoto)[0]; return pick ? stopPhoto(pick) : ""; }
    used[pick.thumb] = true;
    return pick.thumb;
  });
}

// Every middle dot in a screen becomes the centred one (the font's own sits off to the left).
function dots(html) { return html.split("·").join(SEP.trim()); }

function blankState() { return { start: null, days: null, season: null, month: null, pace: null, drive: null, vibes: null, into: null, food: null, activities: null, pick: null }; }
function oneOf(list, v) { return list.some(function (x) { return x.id === v; }); }
function someOf(list, v) { return Array.isArray(v) && v.every(function (x) { return oneOf(list, x); }); }

// The answers in the order they're asked, each with the step that asks it. (The month is optional: "Not sure which month".)
var ASKED = [["start", "start"], ["days", "days"], ["season", "season"], ["pace", "pace"], ["drive", "drive"], ["vibes", "vibe"], ["into", "into"], ["food", "food"], ["activities", "activities"], ["pick", "choice"]];
// The earliest step whose answer is missing, so a reload or a typed hash can't land past it.
function firstOpenStep(st, step) {
  for (var i = 0; i < ASKED.length; i++) {
    var at = STEPS.indexOf(ASKED[i][1]);
    if (step <= at) break;
    if (st[ASKED[i][0]] === null || st[ASKED[i][0]] === undefined) return at;
  }
  if (STEPS[step] === "month" && st.season === "unsure") return STEPS.indexOf("season");
  return step;
}

// Drops any saved answer that doesn't fit (including today's old quiz shape), and every answer after it.
function cleanState(saved, today) {
  var out = blankState(), s = saved;
  if (!s || typeof s !== "object") return out;
  if (!oneOf(TOWNS, s.start)) return out;
  out.start = s.start;
  if (typeof s.days !== "number" || !(s.days >= 3 && s.days <= 21 && s.days % 1 === 0)) return out;
  out.days = s.days;
  if (s.season !== "unsure" && !oneOf(SEASONS, s.season)) return out;
  out.season = s.season;
  var m = s.month;
  if (m && s.season !== "unsure" && monthsOf(s.season, today).some(function (x) { return x.month === m.month && x.year === m.year; })) out.month = { month: m.month, year: m.year };
  else if (m) return out;
  if (!oneOf(PACES, s.pace)) return out;
  out.pace = s.pace;
  if (!oneOf(DRIVES, s.drive)) return out;
  out.drive = s.drive;
  if (!someOf(VIBES, s.vibes)) return out;
  out.vibes = s.vibes.slice();
  if (!someOf(INTO, s.into)) return out;
  out.into = s.into.slice();
  if (typeof s.food !== "boolean") return out;
  out.food = s.food;
  if (!someOf(ACTIVITIES, s.activities)) return out;
  out.activities = s.activities.slice();
  if (typeof s.pick === "string") out.pick = s.pick; // checked against the trips once they're built
  return out;
}

// The activities worth asking about: those the data has somewhere; skiing only for a June to October start.
function activitiesFor(data, startMonth) {
  var have = Object.create(null);
  Object.keys(data.places).forEach(function (k) { data.places[k].activities.forEach(function (a) { have[a] = true; }); });
  return ACTIVITIES.filter(function (a) { return have[a.id] && (a.id !== "skiing" || (startMonth >= 5 && startMonth <= 9)); });
}

// The quiz answers in buildTrips' shape (builder.js).
function answersFor(st) {
  return { start: st.start, days: st.days, pace: st.pace, drive: st.drive, vibes: st.vibes, into: st.into, food: st.food, activities: st.activities };
}

// What the trip screens show: "loading" until the builder's data and pack.js are in, "error" if they failed, else the trips.
function revealState(load, ans, build) {
  if (load.status === "error") return "error";
  if (load.status !== "ready") return "loading";
  return build(load.data, load.pack, ans);
}

// The photo breaks: 1 after "How many days?" (the start town's card photo), 2 after the vibe.
function breakLine(n, st) {
  if (n === 1) {
    var t = TOWNS.filter(function (x) { return x.id === st.start; })[0];
    // the photo is a thumbnail, so it shows as a card at its own size, not full screen
    return { line: t.name + ", " + st.days + " days. Good pick. " + t.fact, img: t.img, credit: "", card: true };
  }
  var vibes = st.vibes || [];
  var p = VIBE_PHOTOS.filter(function (x) { return vibes.indexOf(x.vibe) >= 0; })[0] || VIBE_PHOTOS[VIBE_PHOTOS.length - 1];
  return { line: "Over 500 places on the island. Picking the ones that fit you.", img: p.img, credit: p.credit };
}

function labelOf(list, id) { return list.filter(function (x) { return x.id === id; })[0].label; }
function and(list, word) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " " + (word || "and") + " " + list[list.length - 1]; }

// The reveal's summary: the visitor's own answers, nothing more.
function summaryLine(option, st) {
  var parts = [labelOf(PACES, st.pace), "up to " + st.drive / 60 + " h driving"];
  if (st.vibes.length) parts.push(and(st.vibes.map(function (v) { return labelOf(VIBES, v); })));
  parts.push(st.food ? "food tips on" : "no food tips");
  st.activities.forEach(function (a) { parts.push(labelOf(ACTIVITIES, a).toLowerCase()); });
  return (option.kind === "built" ? "Built for you: " : "Hand-checked trip: ") + parts.join(" · ") + ".";
}

// "Try again" after a failed load: back to idle, so the next render loads again. Anything else stays as it is.
function retryLoad(load) { return load.status === "error" ? { status: "idle" } : load; }
// What the trip screens show while the builder's data loads, or when it failed.
function waitScreen(state) {
  return state === "error" ? '<h1 tabindex="-1">Something went wrong</h1><p>The trips would not load. <button type="button" class="q-link" data-act="reload">Try again</button>, or <a href="/#trips">see the suggested trips</a>.</p>'
    : '<p class="q-kicker">One moment</p><h1 tabindex="-1">Picking the places that fit you…</h1>';
}

// The extra Google Analytics params on quiz_reveal and trip_saved: fixed ids and numbers only, nothing typed.
function measureParams(option, st) {
  return { kind: option.kind, days: option.days.length, start: option.start, end: option.end, pace: st.pace, drive: st.drive };
}

// The line on a drive day over the visitor's limit.
function driveLine(minutes, limit) {
  var h = Math.floor(minutes / 60), m = minutes % 60;
  return "About " + h + " h" + (m ? " " + String(m).padStart(2, "0") : "") + " of driving. Over your " + limit / 60 + " h limit.";
}

function stepFromHash(hash) {
  var n = parseInt(String(hash).replace("#", ""), 10);
  return n >= 0 && n < STEPS.length ? n : 0;
}

if (typeof module !== "undefined") {
  module.exports = { STEPS: STEPS, TOWNS: TOWNS, ACTIVITIES: ACTIVITIES, monthsOf: monthsOf, startDateFor: startDateFor, seasonOf: seasonOf, seasonLine: seasonLine, stepFromHash: stepFromHash, tripPhotos: tripPhotos, stopPhoto: stopPhoto, SEP: SEP, dots: dots, firstOpenStep: firstOpenStep, cleanState: cleanState, activitiesFor: activitiesFor, answersFor: answersFor, revealState: revealState, breakLine: breakLine, measureParams: measureParams, driveLine: driveLine, summaryLine: summaryLine, retryLoad: retryLoad, waitScreen: waitScreen };
}

// ---- the page ----
if (typeof document !== "undefined") (function () {
  var APP = "https://apps.apple.com/app/apple-store/id6818057796?pt=128674950&ct=quiz&mt=8";
  var KEY = "kg-quiz";
  var root = document.getElementById("q");
  var bar = document.getElementById("bar");
  var backBtn = document.getElementById("back");
  var PROGRESS = { start: 8, days: 16, break1: 24, season: 30, month: 38, pace: 46, drive: 54, vibe: 62, break2: 66, into: 70, food: 78, activities: 86, choice: 92, reveal: 100, account: 100, done: 100 };
  var S = {}; STEPS.forEach(function (n, i) { S[n] = i; });
  var NEEDS_DATA = { activities: 1, choice: 1, reveal: 1, account: 1 };
  var CHIPS = [3, 5, 7, 10, 12, 14, 17, 21];
  var draft = null; // the days picker's number, or a pick list's ids, until Next

  var st = blankState();
  try { st = cleanState(JSON.parse(sessionStorage.getItem(KEY)), new Date()); } catch (e) { /* works without it */ }
  var track = typeof window.track === "function" ? window.track : function () {}; // the quiz works without measure.js
  var started = !!st.start, revealed = ""; try { revealed = sessionStorage.getItem("kg-revealed") || ""; } catch (e) { /* fires again */ }
  // events (measure.js): quiz_start once per visit; quiz_step per answer; quiz_reveal once per trip shown (the marker survives a reload)
  function answered(step, answer) { track("quiz_step", { step: step, answer: answer }); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* works without it */ } }

  var SAVED = "kg-saved";
  var GOOGLE = "kg-google"; // { state, nonce } while the visitor is at Google; removed on return
  var G_MARK = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  // Back from Google: the answer is in the address bar (#id_token=..&state=..). Take it and clear it before anything else.
  // Anything that carries id_token or error is cleared, even if it is malformed or the saved key is corrupt.
  var gfrag = /(^|[#&])(id_token|error)=/.test(location.hash), gret = null, gsaved = null, notice = "";
  if (gfrag) {
    gret = readGoogleReturn(location.hash);
    try { gsaved = JSON.parse(sessionStorage.getItem(GOOGLE)); } catch (e) { /* refused later */ } finally { try { sessionStorage.removeItem(GOOGLE); } catch (e2) { /* fine */ } }
    history.replaceState(null, "", location.pathname + location.search + "#" + S.account);
  }
  var session = null; // { idToken, email }: in memory only, never stored
  var acct = { mode: "create", error: "", note: "", existing: null, email: "" };
  var g = guard(); // one sign-in, save or replace at a time
  function savedInfo() { try { var d = JSON.parse(sessionStorage.getItem(SAVED)); if (d && typeof d.email === "string" && typeof d.title === "string") return d; } catch (e) { /* none */ } return null; }

  // The builder's data and pack.js load once the first answer is in (or straight away on a reload mid-quiz).
  var load = { status: "idle" };
  function loadData() {
    if (load.status !== "idle") return;
    load = { status: "loading" };
    var pack = new Promise(function (ok, no) {
      if (window.KiwiPack) return ok(window.KiwiPack); // a retry after only the data failed
      var old = document.querySelector('script[src="/plan/pack.js"]');
      if (old) old.remove(); // a retry after the script failed: one tag at a time
      var s = document.createElement("script");
      s.src = "/plan/pack.js";
      s.onload = function () { if (window.KiwiPack) ok(window.KiwiPack); else no(new Error("pack")); };
      s.onerror = no;
      document.head.appendChild(s);
    });
    var data = fetch("/plan/builder-data.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    Promise.all([data, pack]).then(function (v) {
      load = { status: "ready", data: v[0], pack: v[1] };
      onLoaded();
    }, function () { load = { status: "error" }; onLoaded(); });
  }
  function onLoaded() {
    if (!NEEDS_DATA[STEPS[stepFromHash(location.hash)]]) return; // don't reset a screen the visitor is using
    render();
    if (googlePending && load.status === "ready") { googlePending = false; if (st.pick && STEPS[stepFromHash(location.hash)] === "account" && thisTrip()) finishGoogle(); }
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function town(id) { return TOWNS.filter(function (t) { return t.id === id; })[0]; }
  function areaName(id) { var t = load.data && load.data.towns[id]; return t ? t.name : id; }
  function go(step) { if (location.hash === "#" + step) render(); else location.hash = "#" + step; }
  function days(n) { return n + (n === 1 ? " day" : " days"); }
  function startMonth() { return +startDateFor(st, new Date()).slice(5, 7) - 1; }
  function offered() { return activitiesFor(load.data, startMonth()); }

  // The trips for the answers, built once per set of answers, each stop with its place's photo and categories.
  var cache = { k: "", list: null };
  function options() {
    if (load.status !== "ready") return revealState(load, null, null);
    var ans = answersFor(st), ok = offered().map(function (a) { return a.id; });
    ans.activities = ans.activities.filter(function (a) { return ok.indexOf(a) >= 0; }); // skiing drops out if the month moved
    var k = JSON.stringify(ans);
    if (cache.k !== k) {
      var places = load.data.places;
      cache = { k: k, list: revealState(load, ans, buildTrips).map(function (o) {
        return Object.assign({}, o, { days: o.days.map(function (d) {
          return Object.assign({}, d, { items: d.items.map(function (it) {
            var p = places[it.siteId] || {};
            return Object.assign({}, it, { thumb: p.thumb, fallback: p.fallback, category: p.category || [], activities: p.activities || [] });
          }) });
        }) });
      }) };
    }
    return cache.list;
  }
  function thisTrip() { var o = options(); return typeof o === "string" ? null : o.filter(function (x) { return x.key === st.pick; })[0] || null; }
  // The reveal's trip as the app shows it (tripview.js): Trip | Days on a phone, both side by side from 1024px.
  // Repainted on its own, so a tap on a day keeps the page where it is.
  var tv = { pick: null, view: "trip", day: 0 };
  var WIDE = matchMedia("(min-width: 1024px)"); // side by side: the same query as styles.css
  function paintTrip() {
    var el = document.getElementById("tv"), t = thisTrip(), P = load.pack, start = startDateFor(st, new Date());
    var look = function (id) { return load.data.places[id]; };
    t = Object.assign({}, t, { days: t.days.map(function (d, i) { return Object.assign({}, d, { date: addDays(start, i) }); }) }); // dated as tripBody dates the saved trip
    var n = tv.day = TripView.clampDay(tv.day, t), rows = TripView.tripRows(t, P, look), row = rows[n];
    rows.forEach(function (r) { r.warn = r.overLimit ? driveLine(r.overLimit, st.drive) : ""; });
    el.className = "q-days tv tv-on-" + tv.view;
    el.innerHTML = dots('<div class="tv-switch">' + ["trip", "days"].map(function (v) {
      return '<button type="button" data-act="tv-view" data-val="' + v + '" aria-pressed="' + (tv.view === v) + '">' + (v === "trip" ? "Trip" : "Days") + "</button>";
    }).join("") + "</div>" +
      '<div class="tv-trip">' + TripView.renderTrip(rows, n) + "</div>" +
      // a tab stop of its own, so a keyboard can scroll the side by side day (WebKit gives a scroller none)
      '<div class="tv-days" tabindex="0" role="region" aria-label="' + esc(row.dateLabel) + '"><div class="tv-tabs">' + t.days.map(function (d, i) {
        return '<button type="button" class="tv-tab" data-act="tv-tab" data-val="' + i + '" aria-pressed="' + (i === n) + '">Day ' + (i + 1) +
          "<small>" + esc(new Date(d.date + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })) + "</small></button>";
      }).join("") + "</div>" +
      '<h2 class="tv-head"><span>' + esc(row.dateLabel) + "</span>" + (row.route ? "<b>" + esc(row.route) + "</b>" : "") + "</h2>" +
      (row.warn ? '<p class="q-warn"><b>Long drive.</b> ' + esc(row.warn) + "</p>" : "") +
      TripView.renderDay(TripView.dayView(t, n, P, look)) + "</div>");
    TripView.place(el);
    var tab = el.querySelector('.tv-tab[aria-pressed="true"]'), strip = tab.parentNode;
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2; // the open day's tab in view, without moving the page
  }
  function endLabel(t) { return t.end === t.start ? "Loop · back in " + areaName(t.start) : "Ends in " + areaName(t.end); }
  function routeLine(t) {
    var names = [areaName(t.start)];
    t.days.forEach(function (d) { var n = areaName(d.town); if (names[names.length - 1] !== n) names.push(n); });
    var s = names.join(", ");
    return s.length > 110 ? s.slice(0, 110).replace(/,?\s+\S*$/, "") + "…" : s;
  }

  function prevStep(step) {
    var name = STEPS[step];
    if (name === "reveal") { var o = options(); return typeof o !== "string" && o.length === 1 ? prevStep(S.choice) : S.choice; }
    if (name === "choice") return load.status === "ready" && !offered().length ? S.food : S.activities;
    if (name === "pace") return st.season && st.season !== "unsure" ? S.month : S.season;
    return Math.max(0, step - 1);
  }

  function choice(label, hint, act, val, on) {
    return '<button type="button" class="q-btn' + (on ? " q-on" : "") + '" data-act="' + act + '" data-val="' + esc(val) + '"><span>' + esc(label) + "</span>" + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</button>";
  }
  function picks(key, list) {
    return list.map(function (x) {
      var on = draft.indexOf(x.id) >= 0;
      return '<button type="button" class="q-btn q-pick' + (on ? " q-on" : "") + '" data-act="toggle" data-val="' + esc(x.id) + '" aria-pressed="' + on + '"><span>' + esc(x.label) + "<small>" + esc(x.hint) + '</small></span><span class="q-chk" aria-hidden="true">' + (on ? "✓" : "") + "</span></button>";
    }).join("") + '<button type="button" class="q-cta q-next" data-act="picked" data-val="' + key + '">Next</button>';
  }
  function photoBreak(b) {
    return '<div class="q-brk' + (b.card ? " q-brk-card" : "") + '"><img src="' + esc(b.img) + '" alt=""><div class="q-brk-text"><h1 class="q-brk-line" tabindex="-1">' + esc(b.line) + "</h1>" +
      (b.credit ? "<small>" + esc(b.credit) + "</small>" : "") + '<button type="button" class="q-kiwi" data-act="next">Next</button></div></div>';
  }
  function whenLabel() {
    return st.month ? MONTH_NAMES[st.month.month] + " " + st.month.year : st.season && st.season !== "unsure" ? labelOf(SEASONS, st.season) : "";
  }

  var screens = {
    start: function () {
      return '<p class="q-kicker">Plan your South Island trip in a minute</p><h1 tabindex="-1">Where do you start?</h1>' +
        TOWNS.map(function (t) {
          return '<button type="button" class="q-town" data-act="start" data-val="' + t.id + '"><img src="' + t.img + '" alt="" width="640" height="360">' +
            '<span class="q-town-text"><strong>' + t.name + "</strong><span>" + esc(t.sub) + "</span></span></button>";
        }).join("");
    },
    days: function () {
      return '<p class="q-kicker">From ' + town(st.start).name + '</p><h1 tabindex="-1">How many days?</h1><p class="q-lead">Pick anything from 3 to 21.</p>' +
        '<div class="q-stepper"><button type="button" class="q-step" data-act="fewer" aria-label="One day fewer">−</button>' +
        '<p class="q-num"><strong id="q-n" aria-live="polite">' + draft + "</strong><span>days</span></p>" +
        '<button type="button" class="q-step" data-act="more" aria-label="One day more">+</button></div>' +
        '<input type="range" class="q-range" id="q-range" min="3" max="21" step="1" value="' + draft + '" aria-label="Number of days">' +
        '<div class="q-ends" aria-hidden="true"><span>3</span><span>21</span></div>' +
        '<div class="q-chips">' + CHIPS.map(function (c) {
          return '<button type="button" class="q-chip' + (c === draft ? " q-on" : "") + '" data-act="setdays" data-val="' + c + '" aria-pressed="' + (c === draft) + '">' + c + "</button>";
        }).join("") + "</div>" +
        '<button type="button" class="q-cta q-next" data-act="days">Next</button>';
    },
    break1: function () { return photoBreak(breakLine(1, st)); },
    season: function () {
      return '<p class="q-kicker">' + days(st.days) + " from " + town(st.start).name + '</p><h1 tabindex="-1">Which NZ season are you picking?</h1><p class="q-lead">Southern hemisphere seasons!</p>' +
        SEASONS.map(function (s) { return choice(s.label, s.hint + ". " + s.feel, "season", s.id, st.season === s.id); }).join("") +
        choice("Not sure yet", "Set your dates later in the app.", "season", "unsure", st.season === "unsure");
    },
    month: function () {
      var s = SEASONS.filter(function (x) { return x.id === st.season; })[0];
      return '<p class="q-kicker">' + "NZ " + s.label.toLowerCase() + " · " + s.hint + '</p><h1 tabindex="-1">Which month?</h1>' +
        monthsOf(s.id, new Date()).map(function (m) { return choice(MONTH_NAMES[m.month] + " " + m.year, "", "month", m.month + "-" + m.year, st.month && st.month.month === m.month); }).join("") +
        choice("Not sure which month", "", "month", "");
    },
    pace: function () {
      var w = whenLabel(), s = st.season && st.season !== "unsure" ? labelOf(SEASONS, st.season) : "";
      var kicker = st.month ? "Nice. " + s + " in " + MONTH_NAMES[st.month.month] + "." : s ? "Nice. " + s + "." : "Noted.";
      return '<p class="q-kicker">' + esc(w ? kicker : "Noted.") + '</p><h1 tabindex="-1">How active?</h1>' +
        PACES.map(function (p) { return choice(p.label, p.hint, "pace", p.id, st.pace === p.id); }).join("");
    },
    drive: function () {
      return '<p class="q-kicker">' + esc(labelOf(PACES, st.pace)) + '</p><h1 tabindex="-1">How much driving?</h1>' +
        DRIVES.map(function (d) { return choice(d.label, d.hint, "drive", d.id, st.drive === d.id); }).join("");
    },
    vibe: function () { return '<p class="q-kicker">Pick any, or skip</p><h1 tabindex="-1">What’s the vibe?</h1>' + picks("vibes", VIBES); },
    break2: function () { return photoBreak(breakLine(2, st)); },
    into: function () { return '<p class="q-kicker">Pick any, or skip</p><h1 tabindex="-1">What are you into?</h1>' + picks("into", INTO); },
    food: function () {
      return '<p class="q-kicker">Nearly there</p><h1 tabindex="-1">Food tips?</h1><p class="q-lead">Cafés and places to eat, placed along each day.</p>' +
        choice("Yes", "Add the good places to eat", "food", "yes", st.food === true) + choice("No", "Just the places to see", "food", "no", st.food === false);
    },
    activities: function () {
      return '<p class="q-kicker">Pick any, or skip</p><h1 tabindex="-1">Anything to do?</h1><p class="q-lead">We’ll put it on a day in a town that has it.</p>' + picks("activities", offered());
    },
    choice: function () {
      var list = options(), photos = tripPhotos(list);
      return '<p class="q-kicker">' + list.length + " trips fit " + town(st.start).name + " · " + days(st.days) + '</p><h1 tabindex="-1">Which one sounds like you?</h1>' +
        list.map(function (t, n) {
          var built = t.kind === "built";
          return '<button type="button" class="q-trip" data-act="pick" data-val="' + esc(t.key) + '">' + (photos[n] ? '<img src="' + esc(photos[n]) + '" alt="" width="640" height="240">' : "") +
            '<span class="q-trip-text"><b class="q-badge ' + (built ? "q-built" : "q-sugg") + '">' + (built ? "Built for you" : "Hand-checked trip") + "</b><strong>" + esc(t.label) + "</strong><span>" + esc(routeLine(t)) + "</span><em>" + days(t.days.length) + " · " + esc(endLabel(t)) + "</em></span></button>";
        }).join("");
    },
    reveal: function () {
      var t = thisTrip(), w = whenLabel(), sline = seasonLine(st.season), acts = st.activities;
      var missing = t.missing.map(function (a) { return labelOf(ACTIVITIES, a).toLowerCase(); });
      // Where each picked activity is: one line per activity, naming its places and days, after the trip (so Day 1 is on a phone's first screen).
      var notes = acts.map(function (a) {
        var at = [];
        t.days.forEach(function (d, k) { d.items.forEach(function (i) { if (i.activities.indexOf(a) >= 0) at.push(i.siteName + " (Day " + (k + 1) + ")"); }); });
        return at.length ? '<p class="q-act">' + esc(labelOf(ACTIVITIES, a) + ": " + at.join(", ")) + "</p>" : "";
      }).join("");
      if (tv.pick !== st.pick) tv = { pick: st.pick, view: "trip", day: tv.day }; // another trip opens on Trip; the open day stays if it has one (paintTrip clamps it)
      return '<p class="q-kicker">Your trip</p><h1 tabindex="-1">' + esc(t.label) + "</h1>" +
        '<p class="q-when">From ' + esc(areaName(t.start)) + (t.end === t.start ? " and back" : " to " + esc(areaName(t.end))) + " · " + days(t.days.length) + " · " + (w ? w + " · dates" : "Dates") + " to set in the app</p>" +
        '<p class="q-match">' + esc(summaryLine(t, st)) + "</p>" +
        (missing.length ? '<p class="q-miss">Nothing for ' + esc(and(missing, "or")) + " on this route.</p>" : "") +
        '<div id="tv" class="q-days tv"></div>' + notes +
        (sline ? '<p class="q-season">' + esc(sline) + "</p>" : "") +
        '<div class="q-actions q-bottom"><button type="button" class="q-cta" data-act="save">Save this trip</button><button type="button" class="q-again" data-act="again">Start again</button></div>';
    },
    account: function () {
      var t = thisTrip();
      var kicker = '<p class="q-kicker">' + esc(t.label) + "</p>";
      var dialog = "";
      if (session && acct.note === "has-trip") {
        var x = acct.existing, dt = tripDates(x.startDate, x.endDate);
        dialog = '<dialog class="q-dialog" id="q-dialog" aria-labelledby="q-dlg-h"><h2 id="q-dlg-h">Your account already has a trip</h2><p>This will replace your current trip.</p>' +
          '<p class="q-small">' + esc((x.title || "Your trip") + (dt ? " · " + dt : "")) + '</p><p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>" +
          '<div class="q-actions q-stack"><button type="button" class="q-cta" data-act="replace">Replace it</button><button type="button" class="q-again" id="q-keep" data-act="keep" autofocus>Keep my trip</button></div></dialog>';
      }
      if (session) {
        return kicker + '<h1 tabindex="-1">Save your trip</h1><p class="q-lead">Saving to ' + esc(session.email) + ".</p>" +
          (acct.note === "has-trip" ? "" : '<p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>") +
          '<button type="button" class="q-cta" data-act="retry">' + (acct.error ? "Try again" : "Save trip") + "</button>" + dialog;
      }
      var mode = acct.mode;
      var title = mode === "forgot" ? "Reset your password" : mode === "signin" ? "Sign in to save your trip" : "Save your trip";
      var lead = mode === "forgot" ? "We will email you a link to choose a new password." : mode === "signin" ? "Use your Kiwi Guide account." : "Make a free Kiwi Guide account. Sign in to the app with it and your trip is waiting.";
      var dby = ' aria-describedby="q-err"';
      var google = mode === "forgot" ? "" : '<button type="button" class="q-google" data-act="google">' + G_MARK + "<span>Continue with Google</span></button>" + '<p class="q-or"><span>or use your email</span></p>';
      return kicker + '<h1 tabindex="-1">' + title + '</h1><p class="q-lead">' + lead + '</p><p class="q-status" id="q-status" role="status"></p>' + google +
        '<form id="q-form" class="q-form" novalidate><label>Email<input id="q-email" type="email" name="email" autocomplete="email" inputmode="email" required' + dby + "></label>" +
        (mode === "forgot" ? "" : '<label>Password<input id="q-pass" type="password" name="password" autocomplete="' + (mode === "signin" ? "current-password" : "new-password") + '" required' + dby + "></label>") +
        (mode === "create" ? '<label>Confirm password<input id="q-pass2" type="password" name="password2" autocomplete="new-password" required' + dby + "></label>" : "") +
        '<p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>" +
        '<button type="submit" class="q-cta" id="q-go">' + (mode === "forgot" ? "Send reset email" : mode === "signin" ? "Sign in" : "Create account") + "</button></form>" +
        '<p class="q-alt">' + (mode === "create" ? 'Already have one? <button type="button" class="q-link" data-act="mode" data-val="signin">Sign in</button>' :
          (mode === "signin" ? '<button type="button" class="q-link" data-act="mode" data-val="forgot">Forgot password?</button> · ' : "") + '<button type="button" class="q-link" data-act="mode" data-val="create">Create account</button>') + "</p>" +
        (mode === "create" ? '<p class="q-terms">By creating an account you agree to the <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy Policy</a>.</p>' : "");
    },
    done: function () {
      var d = savedInfo();
      return '<div class="q-done"><div class="q-tick"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h1 tabindex="-1">' + (d.kept ? "Your trip is unchanged" : "Your trip is saved") + '</h1><p class="q-lead">' + esc(d.title) + "</p>" +
        '<ol class="q-steps"><li><b>1</b><span>Get Kiwi Guide<a class="badge" href="' + APP + '"><img src="/img/app-store-badge-black.svg" alt="Download Kiwi Guide on the App Store" width="162" height="54"></a></span></li>' +
        "<li><b>2</b><span>Sign in with " + esc(d.email) + ", and open Trips.</span></li></ol>" +
        '<button type="button" class="q-again" data-act="again">Start again</button></div>';
    },
  };
  var PICK_KEY = { vibe: "vibes", into: "into", activities: "activities" };

  function render() {
    var step = stepFromHash(location.hash), name = STEPS[step];
    var ok = firstOpenStep(st, step);
    if (name === "account" && savedInfo()) { location.replace("#" + S.done); return; }
    if (name === "done" && !savedInfo()) { location.replace("#" + (ok === S.done ? S.reveal : ok)); return; }
    if (ok !== step) { location.replace("#" + ok); return; }
    if (NEEDS_DATA[name] && load.status !== "ready") {
      loadData();
      root.innerHTML = dots(waitScreen(load.status));
      return painted(name);
    }
    if (name === "activities" && !offered().length) { st.activities = []; save(); location.replace("#" + S.choice); return; }
    if (name === "choice") { var list = options(); if (list.length === 1) { st.pick = list[0].key; save(); location.replace("#" + S.reveal); return; } }
    if ((name === "reveal" || name === "account") && !thisTrip()) { st.pick = null; save(); location.replace("#" + S.choice); return; }
    if (name === "reveal" && st.pick !== revealed) {
      revealed = st.pick; try { sessionStorage.setItem("kg-revealed", revealed); } catch (e) { /* fires again */ }
      track("quiz_reveal", Object.assign({ trip: st.pick }, measureParams(thisTrip(), st)));
    }
    draft = name === "days" ? st.days || 7 : PICK_KEY[name] ? (st[PICK_KEY[name]] || []).slice() : null;
    root.innerHTML = dots(screens[STEPS[step]]());
    // tripview.js lost on the way (one dropped request): say so; the screen still finishes, and Save still builds the trip
    if (name === "reveal") try { paintTrip(); } catch (e) { document.getElementById("tv").innerHTML = '<p class="q-error">Your days would not show. Reload the page to see them.</p>'; }
    painted(name);
  }
  function painted(name) {
    bar.style.width = PROGRESS[name] + "%";
    bar.parentNode.setAttribute("aria-valuenow", PROGRESS[name]);
    backBtn.hidden = name === "start" || name === "done";
    document.body.classList.toggle("q-photo", !!root.querySelector(".q-brk"));
    if (notice) { root.insertAdjacentHTML("afterbegin", '<p class="q-error" role="alert">' + esc(notice) + "</p>"); notice = ""; }
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    var h = root.querySelector("h1");
    if (h) h.focus({ preventScroll: true });
    if (name === "account") {
      var f = document.getElementById("q-email");
      if (f) { f.value = acct.email; f.focus({ preventScroll: true }); }
      var dlg = document.getElementById("q-dialog");
      if (dlg) { dlg.showModal(); document.getElementById("q-keep").focus(); }
    }
  }

  // The days picker: the number, the slider and the chips move together.
  function setDays(n) {
    draft = Math.max(3, Math.min(21, n));
    document.getElementById("q-n").textContent = draft;
    document.getElementById("q-range").value = draft;
    Array.prototype.forEach.call(root.querySelectorAll(".q-chip"), function (c) {
      var on = +c.getAttribute("data-val") === draft;
      c.classList.toggle("q-on", on); c.setAttribute("aria-pressed", on);
    });
  }
  root.addEventListener("input", function (e) { if (e.target.id === "q-range") setDays(+e.target.value); });
  // A row photo that fails (a dead thumb) becomes the free day's pin, not an empty frame. Error events don't bubble, so this
  // listens on the way down; the CSP allows no inline onerror.
  root.addEventListener("error", function (e) { if (e.target.matches("img.tv-pic")) e.target.outerHTML = TripView.nopic; }, true);

  root.addEventListener("click", function (e) {
    if (e.target.closest("a.badge")) track("app_store_click", { trip: st.pick });
    var b = e.target.closest("[data-act]");
    if (!b || g.busy()) return;
    var act = b.getAttribute("data-act"), v = b.getAttribute("data-val"), step = stepFromHash(location.hash);
    if (act === "start") { if (!started) { started = true; track("quiz_start"); } answered("start", v); st.start = v; st.pick = null; save(); loadData(); go(S.days); }
    else if (act === "fewer") setDays(draft - 1);
    else if (act === "more") setDays(draft + 1);
    else if (act === "setdays") setDays(+v);
    else if (act === "days") { answered("days", String(draft)); st.days = draft; st.pick = null; save(); go(S.break1); }
    else if (act === "next") go(step + 1);
    else if (act === "season") { answered("season", v); st.season = v; st.month = null; st.pick = null; save(); go(v === "unsure" ? S.pace : S.month); }
    else if (act === "month") { answered("month", v || "none"); var p = v ? v.split("-") : null; st.month = p ? { month: +p[0], year: +p[1] } : null; st.pick = null; save(); go(S.pace); }
    else if (act === "pace") { answered("pace", v); st.pace = v; st.pick = null; save(); go(S.drive); }
    else if (act === "drive") { answered("drive", v); st.drive = +v; st.pick = null; save(); go(S.vibe); }
    else if (act === "toggle") {
      var at = draft.indexOf(v), on = at < 0;
      if (on) draft.push(v); else draft.splice(at, 1);
      b.classList.toggle("q-on", on); b.setAttribute("aria-pressed", on); b.querySelector(".q-chk").textContent = on ? "✓" : "";
    }
    else if (act === "picked") {
      var list = v === "vibes" ? VIBES : v === "into" ? INTO : ACTIVITIES;
      st[v] = list.map(function (x) { return x.id; }).filter(function (id) { return draft.indexOf(id) >= 0; }); // in list order
      answered(STEPS[step], st[v].join(",") || "none"); st.pick = null; save();
      go(v === "vibes" ? S.break2 : v === "into" ? S.food : S.choice);
    }
    else if (act === "food") { answered("food", v); st.food = v === "yes"; st.pick = null; save(); go(S.activities); }
    else if (act === "tv-view" || act === "tv-tab") {
      if (act === "tv-view") tv.view = v; else tv.day = +v;
      paintTrip();
      // a day picked from another day's evening opens at its morning, under the strip (the app's phone shows a new day from its top)
      if (act === "tv-tab") { var dv = root.querySelector(".tv-days"); if (dv.getBoundingClientRect().top < root.getBoundingClientRect().top) dv.scrollIntoView(); }
      root.querySelector('[data-act="' + act + '"][data-val="' + v + '"]').focus({ preventScroll: true });
    }
    else if (act === "tv-day") {
      tv.day = +v; tv.view = "days"; paintTrip();
      // side by side the day just shows; a phone opens it, with focus on its tab rather than the top of the page
      if (WIDE.matches) root.querySelector('[data-act="tv-day"][data-val="' + v + '"]').focus({ preventScroll: true });
      else { document.getElementById("tv").scrollIntoView(); root.querySelector('.tv-tab[aria-pressed="true"]').focus({ preventScroll: true }); }
    }
    else if (act === "pick") { answered("choice", v); st.pick = v; save(); go(S.reveal); }
    else if (act === "again") { tv = { pick: null, view: "trip", day: 0 }; st = blankState(); save(); session = null; acct = { mode: "create", error: "", note: "", existing: null, email: "" }; try { sessionStorage.removeItem(SAVED); } catch (e2) { /* fine */ } go(S.start); }
    else if (act === "save") { acct.error = ""; acct.note = ""; go(S.account); }
    else if (act === "mode") { var ef = document.getElementById("q-email"); if (ef) acct.email = ef.value; acct.mode = v; acct.error = ""; render(); }
    else if (act === "google") goGoogle();
    else if (act === "retry") doSave();
    else if (act === "reload") { load = retryLoad(load); render(); }
    else if (act === "replace") doReplace();
    else if (act === "keep") keepIt();
  });

  // The page's own error is shown in #q-err; field is the input at fault.
  function setErr(text, field, ok) {
    var e = document.getElementById("q-err");
    if (e) { e.textContent = text; e.className = "q-error" + (ok ? " q-ok" : ""); }
    ["q-email", "q-pass", "q-pass2"].forEach(function (id) {
      var i = document.getElementById(id);
      if (i) { if (field === id && !ok) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); }
    });
  }
  function setDisabled(b) { Array.prototype.forEach.call(root.querySelectorAll("button"), function (x) { x.disabled = b; }); }
  function fieldFor(code) {
    var c = String(code || "").split(/[\s:]/)[0];
    return c === "PASSWORDS_DIFFER" ? "q-pass2" : c === "EMAIL_EXISTS" || c === "INVALID_EMAIL" ? "q-email" : c === "WEAK_PASSWORD" || c === "INVALID_LOGIN_CREDENTIALS" || c === "INVALID_PASSWORD" || c === "EMAIL_NOT_FOUND" ? "q-pass" : null;
  }
  function newBody() { return tripBody(thisTrip(), startDateFor(st, new Date()), function () { return crypto.randomUUID(); }); }
  function finish(email, title, kept) {
    try { sessionStorage.setItem(SAVED, JSON.stringify({ email: email, title: title, kept: !!kept })); } catch (e) { /* the screen still shows this time */ }
    session = null;
    go(S.done);
  }

  // Every failure ends in a re-render or a re-enabled form, never a stuck disabled button.
  function fail(err) {
    var sb = document.getElementById("q-status"); if (sb) sb.textContent = "";
    // the email has a password account: back to Sign in with it filled in, message kept
    if (err && !session && (err.code === "NEED_CONFIRMATION" || err.code === "FEDERATED_USER_ID_ALREADY_LINKED")) {
      acct = { mode: "signin", error: authErrorMessage(err.code), note: "", existing: null, email: err.email || acct.email };
      return render();
    }
    if (err && typeof err.code === "string") { setDisabled(false); var m = authErrorMessage(err.code); setErr(m, fieldFor(err.code)); return; }
    if (err && err.status === 401) {
      acct = { mode: "signin", error: saveErrorMessage(401), note: "", existing: null, email: session ? session.email : "" };
      session = null; return render();
    }
    if (session) { acct.error = err && typeof err.status === "number" ? saveErrorMessage(err.status, err.error) : authErrorMessage(""); return render(); }
    setDisabled(false); setErr(authErrorMessage(""));
  }
  // fn returns a promise; only one runs at a time, and every button is off while it does.
  function run(fn, onOk) {
    var p = g.run(fn);
    if (!p) { var sb = document.getElementById("q-status"); if (sb) sb.textContent = ""; return; }
    setDisabled(true);
    p.then(onOk).catch(fail);
  }
  function afterSave(r) {
    if (r.result === "has-trip") { acct.note = "has-trip"; acct.existing = r.existing; acct.error = ""; return render(); }
    track("trip_saved", Object.assign({ trip: st.pick, replaced: false }, measureParams(thisTrip(), st)));
    finish(session.email, thisTrip().label);
  }
  function doSave() {
    acct.error = "";
    run(function () { return saveFlow(fetch.bind(window), session.idToken, newBody()); }, afterSave);
  }
  function doReplace() {
    acct.error = "";
    run(function () { return replaceTrip(fetch.bind(window), session.idToken, acct.existing.id, newBody()); }, function () { track("trip_saved", Object.assign({ trip: st.pick, replaced: true }, measureParams(thisTrip(), st))); finish(session.email, thisTrip().label); });
    // buttons are off while it runs; say so (a failure re-renders a fresh dialog, success leaves the screen)
    var dlg = document.getElementById("q-dialog"), rb = root.querySelector("[data-act=replace]");
    if (g.busy() && dlg && rb) { dlg.setAttribute("aria-busy", "true"); rb.textContent = "Replacing…"; }
  }
  function keepIt() { if (session && acct.existing && !g.busy()) finish(session.email, acct.existing.title || "Your trip", true); }

  // Escape on the dialog means Keep (cancel does not bubble, so listen while it goes down).
  root.addEventListener("cancel", function (e) { e.preventDefault(); keepIt(); }, true);
  // newer Chrome can close on Escape without cancel (no interaction since showModal); close does not bubble either
  // ignore it when the dialog has been re-rendered away (a failed Replace), so that can never count as Keep
  root.addEventListener("close", function (e) { if (e.target.isConnected) keepIt(); }, true);

  root.addEventListener("submit", function (e) {
    e.preventDefault();
    if (g.busy()) return;
    var email = document.getElementById("q-email").value.trim();
    var passEl = document.getElementById("q-pass");
    if (!email) return setErr("Enter your email.", "q-email");
    if (passEl && !passEl.value) return setErr("Enter your password.", "q-pass");
    acct.email = email;
    var net = fetch.bind(window);
    if (acct.mode === "forgot") {
      return run(function () { return resetPassword(net, email); }, function () { setDisabled(false); setErr("If that email has an account, a reset link is on its way.", null, true); });
    }
    run(function () {
      return (acct.mode === "signin" ? signIn(net, email, passEl.value) : createAccount(net, email, passEl.value, document.getElementById("q-pass2").value)).then(function (s) {
        if (acct.mode === "create") track("sign_up", { method: "email" });
        session = s;
        return saveFlow(net, s.idToken, newBody());
      });
    }, afterSave);
  });

  // Off to Google. The state and nonce wait in sessionStorage (the quiz answers already do); the tokens never do.
  function goGoogle() {
    var state = newToken(), nonce = newToken();
    try { sessionStorage.setItem(GOOGLE, JSON.stringify({ state: state, nonce: nonce })); } catch (e) { return setErr(authErrorMessage("")); }
    location.assign(googleAuthUrl(location.origin, state, nonce));
  }
  // The visitor is back from Google: sign in with its answer, then the same save flow as for email.
  function finishGoogle() {
    var net = fetch.bind(window), r = gret, sv = gsaved;
    gret = gsaved = null;
    var sb = document.getElementById("q-status"); if (sb) sb.textContent = "Signing in with Google…"; // render left it empty, so the change is announced; fail() clears it
    run(function () {
      return completeGoogle(net, r, sv, location.origin + "/plan/").then(function (s) {
        if (s.isNew) track("sign_up", { method: "google" });
        session = s;
        return saveFlow(net, s.idToken, newBody());
      });
    }, afterSave);
  }

  backBtn.addEventListener("click", function () {
    location.hash = "#" + prevStep(stepFromHash(location.hash));
  });

  window.addEventListener("hashchange", render);
  // Across the breakpoint (an iPad turned, a window resized) the view repaints, so the strip finds the open day's tab,
  // and a phone's Days starts at the top of the trip, not mid-timeline. (Safari 14+; an older one just doesn't repaint.)
  if (WIDE.addEventListener) WIDE.addEventListener("change", function (e) {
    if (!document.querySelector("#tv .tv-days")) return; // not on the reveal, or its days would not show
    paintTrip();
    if (!e.matches && tv.view === "days") document.getElementById("tv").scrollIntoView();
  });

  // Back from Google (and not already saved): the sign-in finishes once the trip is built again.
  var googlePending = gfrag && !savedInfo();
  if (googlePending && !st.pick && !(gret && gret.error === "access_denied")) notice = "Your answers were lost on the way back from Google. Pick your trip again.";
  if (st.start) loadData();
  try { render(); } catch (e) {
    root.innerHTML = '<h1>Something went wrong</h1><p>The quiz hit a problem. Reload the page, or <a href="/#trips">see the suggested trips</a>.</p>';
  }
})();
