// The trip quiz: where you start, how long, a swipe deck, when, then a suggested trip.
// The pure functions at the top are tested (test/quiz.test.js); the page code at the bottom only runs in a browser.

var BANDS = [
  { id: "short", label: "A day or two", hint: "Short and sweet", min: 1, max: 2 },
  { id: "weekend", label: "A long weekend", hint: "Three or four days", min: 3, max: 4 },
  { id: "week", label: "About a week", hint: "Five to seven days", min: 5, max: 7 },
  { id: "ten", label: "Ten days or so", hint: "A good chunk of the island", min: 8, max: 10 },
  { id: "fortnight", label: "A couple of weeks", hint: "Time to slow down", min: 11, max: 14 },
  { id: "long", label: "Three weeks or more", hint: "The whole island", min: 15, max: 99 },
];

var PHOTO = "https://api.blacksands.app/images/southislandguide/";
var TOWNS = [
  { id: "queenstown", name: "Queenstown", sub: "Fly in to the lakes and mountains, with Wānaka and Milford Sound close by.", range: "a weekend to three weeks", img: PHOTO + "a6904a0d-2c8e-4f25-b533-e51241d6665e.webp" },
  { id: "christchurch", name: "Christchurch", sub: "Fly in to the Garden City, then inland to Tekapo and Mount Cook or up the coast to Kaikōura.", range: "a day to three weeks", img: PHOTO + "2f5a12e0-dfbc-4fcd-a7bc-f86ca3e0e0dd.webp" },
  { id: "picton", name: "Picton", sub: "Off the ferry from Wellington, into the Marlborough Sounds, Nelson and Abel Tasman.", range: "a long weekend to three weeks", img: PHOTO + "7711e2f4-268e-4f3e-ab25-30d72a357cbe.webp" },
];

var CARDS = [
  { siteId: "cruise-milford-small-boat-cruise", img: PHOTO + "67aba220-6978-4ea7-9ea9-5c747da82491.webp", name: "A cruise on Milford Sound", town: "Fiordland", tag: "Scenic", likes: ["scenic"], alt: "Milford Sound from the water",
    facts: "1 hr 45 on the water · from $189 · easy",
    what: "Out towards the Tasman Sea past the waterfalls, with seals on the rocks and dolphins some days.",
    yesIf: "you want the South Island’s most famous view, up close.",
    skipIf: "a long day in the car doesn’t appeal: it’s 2.5 hours each way from Te Anau." },
  { siteId: "hooker-valley-track", img: PHOTO + "21f51a42-bdf1-4d70-be42-3f6bd6049d26.webp", name: "The Hooker Valley Track", town: "Aoraki / Mount Cook", tag: "Hike", likes: ["hikes"], alt: "The Hooker Valley Track",
    facts: "3 hours return · free · easy, mostly flat",
    what: "A 10 km walk over three swing bridges to a glacier lake, with Aoraki / Mount Cook straight ahead.",
    yesIf: "you like big mountain views without a hard climb.",
    skipIf: "busy tracks put you off. It’s quietest at first light." },
  { siteId: "shotover-jet", img: PHOTO + "a950640c-882d-4b4c-82d6-88dae6b56e86.webp", name: "The Shotover Jet", town: "Queenstown", tag: "Adventure", likes: ["adventure"], alt: "A jet boat in a canyon",
    facts: "25 minutes · $199 · you’ll get wet",
    what: "A jet boat skims the canyon walls of the Shotover River, with full 360-degree spins.",
    yesIf: "you want a quick thrill that anyone can do.",
    skipIf: "speed and cold spray aren’t your idea of fun." },
  { siteId: "wine-tours-by-bike", img: PHOTO + "4be2fd1c-491d-45fa-8c71-344cd6c7d1cb.webp", name: "Wine tours by bike", town: "Renwick, Marlborough", tag: "Food & wine", likes: ["food", "adventure"], alt: "Cycling between vineyards",
    facts: "A day · from $70, tastings extra · flat, gentle riding",
    what: "Ride quiet lanes between more than 14 cellar doors, with lunch at a winery on the way.",
    yesIf: "a long lunch and a few tastings sounds like the perfect day.",
    skipIf: "you don’t drink wine, or would rather not cycle." },
  { siteId: "te-anau-glowworm-caves", img: PHOTO + "7868c0f3-b043-4f0f-b6e2-2da23e036da4.webp", name: "The Te Anau glowworm caves", town: "Te Anau", tag: "Nature", likes: ["hikes"], alt: "Glowworms in a cave",
    facts: "2.5 hours · from $154 · lots of steps",
    what: "Cross Lake Te Anau, then drift by boat into a silent grotto lit by glowworms.",
    yesIf: "you want something magical at the end of a Fiordland day.",
    skipIf: "tight, dark spaces aren’t for you. No phones in the cave." },
  { siteId: "nevis-bungy", img: PHOTO + "3fd6e6d2-e83e-483f-86b7-ba070bf05698.webp", name: "The Nevis Bungy", town: "Queenstown", tag: "Adventure", likes: ["adventure"], alt: "A bungy jump over a gorge",
    facts: "Half a day · from $395 · a 134 m drop",
    what: "New Zealand’s highest bungy, from a cable car over the Nevis River gorge.",
    yesIf: "you want the story you’ll tell for years.",
    skipIf: "heights are a hard no, or the money’s better spent elsewhere." },
  { siteId: "redcliff-te-anau", img: PHOTO + "433fe67d-86f6-4723-a2b6-82caa5df4671.webp", name: "Dinner at Redcliff", town: "Te Anau", tag: "Food & wine", likes: ["food"], alt: "A restaurant table",
    facts: "An evening · mains about $50 · book ahead",
    what: "Wild Fiordland venison, Southland lamb and Central Otago wine in a cosy old cottage.",
    yesIf: "eating well is a big part of the trip for you.",
    skipIf: "you’d rather keep dinners quick and cheap." },
  { siteId: "pancake-rocks-and-blowholes-walk", img: PHOTO + "c9d244ae-cf6b-44e2-bc7e-4bc895641649.webp", name: "Pancake Rocks and the blowholes", town: "Punakaiki, West Coast", tag: "Scenic", likes: ["scenic", "hikes"], alt: "Layered rocks above the sea",
    facts: "30-minute loop · free · paved and easy",
    what: "Layered limestone stacks where the sea booms up through the blowholes at high tide.",
    yesIf: "you love an easy road-trip stop with a big wow.",
    skipIf: "you won’t make it to the West Coast this time." },
];

var INTEREST_CATEGORIES = { hikes: ["Walks", "Nature"], food: ["Food"], adventure: ["Adventure"], scenic: ["Scenic"] };
// The order the match line reads in.
var INTEREST_ORDER = ["hikes", "food", "scenic", "adventure"];
var INTEREST_NAMES = { hikes: ["hike or nature stop", "hikes and nature stops"], food: ["food stop", "food stops"], scenic: ["scenic stop", "scenic stops"], adventure: ["adventure", "adventures"] };

var SEASONS = [
  { id: "summer", feel: "Warm days for swimming and long evenings. Peak season, so book ahead.", label: "Summer", hint: "December to February", months: [11, 0, 1], line: "Summer: book the popular stays and cruises early. It’s the busiest time of year." },
  { id: "autumn", feel: "Quieter roads, settled weather and gold trees in Central Otago.", label: "Autumn", hint: "March to May", months: [2, 3, 4], line: "Autumn: quieter roads and gold trees in Central Otago. Nights get cold." },
  { id: "winter", feel: "Snow on the mountains and the ski fields. Cold nights, and some passes close.", label: "Winter", hint: "June to August", months: [5, 6, 7], line: "Winter: check the passes for snow before you drive, and carry chains." },
  { id: "spring", feel: "Lambs, waterfalls in full flow and fewer crowds. The weather changes fast.", label: "Spring", hint: "September to November", months: [8, 9, 10], line: "Spring: lambs and long days. Some walks close for lambing." },
];
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function inBand(trip, band) {
  var n = trip.days.length;
  return n >= band.min && n <= band.max;
}
function bandsFor(trips, start) {
  var mine = trips.filter(function (t) { return t.start === start; });
  return BANDS.filter(function (b) { return mine.some(function (t) { return inBand(t, b); }); });
}
function tripsFor(trips, start, bandId) {
  var band = BANDS.filter(function (b) { return b.id === bandId; })[0];
  if (!band) return [];
  return trips.filter(function (t) { return t.start === start && inBand(t, band); }).sort(function (a, b) {
    return a.days.length - b.days.length || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
  });
}

function interestsFrom(likedCardIds) {
  var out = [];
  likedCardIds.forEach(function (id) {
    CARDS.forEach(function (c) {
      if (c.siteId === id) c.likes.forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); });
    });
  });
  return out;
}

function hasCategory(item, interest) {
  return (INTEREST_CATEGORIES[interest] || []).some(function (c) { return item.category.indexOf(c) >= 0; });
}
function stopMatches(item, interests) {
  return interests.some(function (i) { return hasCategory(item, i); });
}
function matchCounts(trip, interests) {
  var out = [];
  INTEREST_ORDER.forEach(function (i) {
    if (interests.indexOf(i) < 0) return;
    var n = 0;
    trip.days.forEach(function (d) { d.items.forEach(function (it) { if (hasCategory(it, i)) n++; }); });
    if (n > 0) out.push({ label: INTEREST_NAMES[i][n === 1 ? 0 : 1], count: n });
  });
  return out;
}
function matchLine(counts) {
  if (!counts.length) return "";
  var parts = counts.map(function (c) { return c.count + " " + c.label; });
  return parts.slice(0, -1).join(", ") + (parts.length > 1 ? " and " : "") + parts[parts.length - 1] + " you’ll like";
}

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

// Coming back to a finished deck keeps the swipes: the last card shows again, and its yes (if any) is taken back.
function reopenDeck(idx, liked) {
  if (idx < CARDS.length) return { idx: idx, liked: liked };
  var last = CARDS[CARDS.length - 1].siteId, at = liked.lastIndexOf(last);
  return { idx: CARDS.length - 1, liked: at < 0 ? liked.slice() : liked.slice(0, at).concat(liked.slice(at + 1)) };
}

// The earliest step whose answer is missing, so a reload or a typed hash can't land past it.
function firstOpenStep(st, step) {
  if (!st.start) return 0;
  if (!st.band) return step > 1 ? 1 : step;
  if (step >= 3 && st.idx < CARDS.length) return 2;
  if (step >= 4 && st.season === null) return 3;
  if (step === 4 && st.season === "unsure") return 3;
  if ((step === 6 || step === 7) && !st.pick) return 5;
  return step;
}

// Drops any saved answer that no longer fits the data, and every answer after it.
function cleanState(saved, trips, today) {
  var out = { start: null, band: null, idx: 0, liked: [], season: null, month: null, pick: null };
  if (!saved || typeof saved !== "object") return out;
  var towns = Object.create(null); trips.forEach(function (t) { towns[t.start] = true; });
  if (typeof saved.start !== "string" || !towns[saved.start]) return out;
  out.start = saved.start;
  if (!bandsFor(trips, out.start).some(function (b) { return b.id === saved.band; })) return out;
  out.band = saved.band;
  var ids = CARDS.map(function (c) { return c.siteId; });
  if (!Array.isArray(saved.liked) || !saved.liked.every(function (i) { return ids.indexOf(i) >= 0; }) || typeof saved.idx !== "number" || !(saved.idx >= 0 && saved.idx <= CARDS.length && saved.idx % 1 === 0)) return out;
  out.idx = saved.idx; out.liked = saved.liked.slice();
  if (saved.season !== "unsure" && !SEASONS.some(function (x) { return x.id === saved.season; })) return out;
  out.season = saved.season;
  var m = saved.month;
  if (m && saved.season !== "unsure" && monthsOf(saved.season, today).some(function (x) { return x.month === m.month && x.year === m.year; })) out.month = { month: m.month, year: m.year };
  else if (m) return out;
  if (tripsFor(trips, out.start, out.band).some(function (t) { return t.key === saved.pick; })) out.pick = saved.pick;
  return out;
}

function stepFromHash(hash) {
  var n = parseInt(String(hash).replace("#", ""), 10);
  return n >= 0 && n <= 8 ? n : 0;
}

if (typeof module !== "undefined") {
  module.exports = { BANDS: BANDS, bandsFor: bandsFor, tripsFor: tripsFor, CARDS: CARDS, interestsFrom: interestsFrom, monthsOf: monthsOf, startDateFor: startDateFor, seasonOf: seasonOf, seasonLine: seasonLine, matchCounts: matchCounts, matchLine: matchLine, INTEREST_CATEGORIES: INTEREST_CATEGORIES, stepFromHash: stepFromHash, reopenDeck: reopenDeck, firstOpenStep: firstOpenStep, cleanState: cleanState };
}

// ---- the page ----
if (typeof document !== "undefined") (function () {
  var APP = "https://apps.apple.com/app/apple-store/id6818057796?pt=128674950&ct=quiz&mt=8";
  var KEY = "kg-quiz";
  var root = document.getElementById("q");
  var bar = document.getElementById("bar");
  var backBtn = document.getElementById("back");
  var PROGRESS = [8, 22, 40, 58, 70, 84, 100];
  var trips = null;
  var busy = false;
  var keyHandler = null;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function blank() { return { start: null, band: null, idx: 0, liked: [], season: null, month: null, pick: null }; }
  var st = blank();
  try { var saved = JSON.parse(sessionStorage.getItem(KEY)); if (saved && typeof saved === "object") st = saved; } catch (e) { /* works without it */ }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* works without it */ } }

  var SAVED = "kg-saved";
  var session = null; // { idToken, email }: in memory only, never stored
  var acct = { mode: "create", error: "", note: "", existing: null, email: "" };
  var g = guard(); // one sign-in, save or replace at a time
  function savedInfo() { try { var d = JSON.parse(sessionStorage.getItem(SAVED)); if (d && typeof d.email === "string" && typeof d.title === "string") return d; } catch (e) { /* none */ } return null; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function townName(id) { return TOWNS.filter(function (t) { return t.id === id; })[0].name; }
  function go(step) { if (location.hash === "#" + step) render(); else location.hash = "#" + step; }
  function days(n) { return n + (n === 1 ? " day" : " days"); }
  function tripList() { return tripsFor(trips, st.start, st.band); }

  function prevStep(step) {
    if (step === 6) return tripList().length > 1 ? 5 : prevStep(5);
    if (step === 5) return st.season && st.season !== "unsure" ? 4 : 3;
    return Math.max(0, step - 1);
  }
  function lowestValid(step) { return firstOpenStep(st, step); }

  function choice(label, hint, act, val) {
    return '<button type="button" class="q-btn" data-act="' + act + '" data-val="' + esc(val) + '"><span>' + esc(label) + "</span>" + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</button>";
  }

  var screens = {
    0: function () {
      return '<p class="q-kicker">Plan your South Island trip in a minute</p><h1 tabindex="-1">Where do you start?</h1>' +
        TOWNS.map(function (t) {
          var n = trips.filter(function (x) { return x.start === t.id; }).length;
          return '<button type="button" class="q-town" data-act="start" data-val="' + t.id + '"><img src="' + t.img + '" alt="" width="640" height="360">' +
            '<span class="q-town-text"><strong>' + t.name + "</strong><span>" + esc(t.sub) + "</span><em>" + n + " trips · " + t.range + "</em></span></button>";
        }).join("");
    },
    1: function () {
      return '<p class="q-kicker">From ' + townName(st.start) + '</p><h1 tabindex="-1">How long have you got?</h1>' +
        bandsFor(trips, st.start).map(function (b) { return choice(b.label, b.hint, "band", b.id); }).join("");
    },
    2: function () {
      var c = CARDS[st.idx], next = CARDS[st.idx + 1];
      return '<div class="q-deck-head"><h1 tabindex="-1">Would you do this?</h1><p class="q-lead">Let’s get an idea of what type of traveller you are.</p>' +
        '<p class="q-kicker">Swipe right for yes, left for no. ' + (st.idx + 1) + " of " + CARDS.length + "</p></div>" +
        '<div class="q-deck">' +
        (next ? '<div class="q-card q-card-next"><img src="' + next.img + '" alt="" width="640" height="480"></div>' : "") +
        '<div class="q-card q-card-top" id="card"><div class="q-card-body">' +
        '<div class="q-card-photo"><img src="' + c.img + '" alt="' + esc(c.alt) + '" width="640" height="480"><span class="q-tag">' + esc(c.tag) + "</span></div>" +
        '<div class="q-card-text"><div><h2>' + esc(c.name) + '</h2><p class="q-town-line">' + esc(c.town) + "</p></div>" +
        '<p class="q-facts">' + esc(c.facts) + "</p><p>" + esc(c.what) + "</p>" +
        '<p class="q-sm"><strong>Yes if</strong> ' + esc(c.yesIf) + '</p><p class="q-sm q-skip"><strong>Skip if</strong> ' + esc(c.skipIf) + "</p></div></div>" +
        '<span class="q-stamp q-yes" id="stamp-yes" aria-hidden="true">YES</span><span class="q-stamp q-no" id="stamp-no" aria-hidden="true">NOPE</span></div></div>' +
        '<div class="q-deck-btns"><button type="button" class="q-round q-round-no" data-act="no" aria-label="No, skip this place"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<button type="button" class="q-round q-round-yes" data-act="yes" aria-label="Yes, I would do this"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.2 4.3 2.4h2c.8-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg></button></div>';
    },
    3: function () {
      var n = interestsFrom(st.liked).length;
      return '<p class="q-kicker">' + (n ? "Nice. " + n + (n === 1 ? " thing" : " things") + " you’re into, noted." : "Noted.") + '</p><h1 tabindex="-1">Which NZ season are you picking?</h1><p class="q-lead">Southern hemisphere seasons!</p>' +
        SEASONS.map(function (s) { return choice(s.label, s.hint + ". " + s.feel, "season", s.id); }).join("") +
        choice("Not sure yet", "Set your dates later in the app.", "season", "unsure");
    },
    4: function () {
      var s = SEASONS.filter(function (x) { return x.id === st.season; })[0];
      return '<p class="q-kicker">' + "NZ " + s.label.toLowerCase() + " · " + s.hint + '</p><h1 tabindex="-1">Which month?</h1>' +
        monthsOf(s.id, new Date()).map(function (m) { return choice(MONTH_NAMES[m.month] + " " + m.year, "", "month", m.month + "-" + m.year); }).join("") +
        choice("Not sure which month", "", "month", "");
    },
    5: function () {
      var band = BANDS.filter(function (b) { return b.id === st.band; })[0];
      var list = tripList();
      return '<p class="q-kicker">' + list.length + " trips fit " + townName(st.start) + " · " + band.label.toLowerCase() + '</p><h1 tabindex="-1">Which one sounds like you?</h1>' +
        list.map(function (t) {
          var thumb = "";
          t.days.some(function (d) { return d.items.some(function (i) { if (i.thumb) { thumb = i.thumb; return true; } return false; }); });
          var route = t.description.length > 110 ? t.description.slice(0, 110).replace(/\s+\S*$/, "") + "…" : t.description;
          var ends = t.ends === townName(st.start) ? "Back in " + t.ends : "Ends in " + t.ends;
          return '<button type="button" class="q-trip" data-act="pick" data-val="' + esc(t.key) + '">' + (thumb ? '<img src="' + esc(thumb) + '" alt="" width="640" height="240">' : "") +
            '<span class="q-trip-text"><strong>' + esc(t.label) + "</strong><span>" + esc(route) + "</span><em>" + days(t.days.length) + " · " + esc(ends) + "</em></span></button>";
        }).join("");
    },
    6: function () {
      var t = trips.filter(function (x) { return x.key === st.pick; })[0];
      var interests = interestsFrom(st.liked);
      var line = matchLine(matchCounts(t, interests));
      var when = st.month ? MONTH_NAMES[st.month.month] + " " + st.month.year : st.season && st.season !== "unsure" ? SEASONS.filter(function (s) { return s.id === st.season; })[0].label : "";
      var sline = seasonLine(st.season);
      return '<p class="q-kicker">Your trip</p><h1 tabindex="-1">' + esc(t.label) + "</h1>" +
        '<p class="q-when">From ' + townName(st.start) + " · " + days(t.days.length) + " · " + (when ? when + " · dates" : "Dates") + " to set in the app</p>" +
        '<div class="q-actions"><button type="button" class="q-cta" data-act="save">Save this trip</button><button type="button" class="q-again" data-act="again">Start again</button></div>' +
        (line ? '<p class="q-match">' + esc(line) + "</p>" : "") +
        '<div class="q-days">' + t.days.map(function (d, n) {
          return '<section class="q-day"><h2>Day ' + (n + 1) + " <span>· " + esc(d.town) + "</span></h2><ul>" +
            d.items.map(function (i) {
              var m = stopMatches(i, interests);
              return '<li class="q-stop' + (m ? " q-liked" : "") + '">' +
                (i.thumb ? '<img src="' + esc(i.thumb) + '" alt="" width="56" height="56" loading="lazy">' : '<span class="q-noimg">' + esc(i.category[0] || "") + "</span>") +
                "<div><p>" + esc(i.siteName) + "</p><small>" + esc(i.timeLabel + " · " + i.durationLabel) + "</small></div>" + (m ? '<b class="q-youliked">You liked</b>' : "") + "</li>";
            }).join("") + "</ul></section>";
        }).join("") + "</div>" +
        (sline ? '<p class="q-season">' + esc(sline) + "</p>" : "") +
        '<div class="q-actions"><button type="button" class="q-cta" data-act="save">Save this trip</button></div>';
    },
    7: function () {
      var t = trips.filter(function (x) { return x.key === st.pick; })[0];
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
      return kicker + '<h1 tabindex="-1">' + title + '</h1><p class="q-lead">' + lead + "</p>" +
        '<form id="q-form" class="q-form" novalidate><label>Email<input id="q-email" type="email" name="email" autocomplete="email" inputmode="email" required' + dby + "></label>" +
        (mode === "forgot" ? "" : '<label>Password<input id="q-pass" type="password" name="password" autocomplete="' + (mode === "signin" ? "current-password" : "new-password") + '" required' + dby + "></label>") +
        '<p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>" +
        '<button type="submit" class="q-cta" id="q-go">' + (mode === "forgot" ? "Send reset email" : mode === "signin" ? "Sign in" : "Create account") + "</button></form>" +
        '<p class="q-alt">' + (mode === "create" ? 'Already have one? <button type="button" class="q-link" data-act="mode" data-val="signin">Sign in</button>' :
          (mode === "signin" ? '<button type="button" class="q-link" data-act="mode" data-val="forgot">Forgot password?</button> · ' : "") + '<button type="button" class="q-link" data-act="mode" data-val="create">Create account</button>') + "</p>" +
        (mode === "create" ? '<p class="q-terms">By creating an account you agree to the <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy Policy</a>.</p>' : "");
    },
    8: function () {
      var d = savedInfo();
      return '<div class="q-done"><div class="q-tick"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h1 tabindex="-1">' + (d.kept ? "Your trip is unchanged" : "Your trip is saved") + '</h1><p class="q-lead">' + esc(d.title) + "</p>" +
        '<ol class="q-steps"><li><b>1</b><span>Get Kiwi Guide<a class="badge" href="' + APP + '"><img src="/img/app-store-badge-black.svg" alt="Download Kiwi Guide on the App Store" width="162" height="54"></a></span></li>' +
        "<li><b>2</b><span>Sign in with " + esc(d.email) + ", and open Trips.</span></li></ol>" +
        '<button type="button" class="q-again" data-act="again">Start again</button></div>';
    },
  };

  function removeKeys() { if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; } }

  function render() {
    removeKeys();
    busy = false;
    var step = stepFromHash(location.hash);
    var ok = lowestValid(step);
    if (step === 7 && savedInfo()) { location.replace("#8"); return; }
    if (step === 8 && !savedInfo()) { location.replace("#" + (ok === 8 ? 6 : ok)); return; }
    if (step === 5 && ok === 5 && tripList().length === 1) { st.pick = tripList()[0].key; save(); location.replace("#6"); return; }
    if (step === 2 && ok === 2 && st.idx >= CARDS.length) { var r = reopenDeck(st.idx, st.liked); st.idx = r.idx; st.liked = r.liked; save(); }
    if (ok !== step) { location.replace("#" + ok); return; }
    root.innerHTML = screens[step]();
    bar.style.width = PROGRESS[step] + "%";
    bar.parentNode.setAttribute("aria-valuenow", PROGRESS[step]);
    backBtn.hidden = step === 0 || step === 8;
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    var h = root.querySelector("h1");
    if (h) h.focus({ preventScroll: true });
    if (step === 2) setupDeck();
    if (step === 7) {
      var f = document.getElementById("q-email");
      if (f) { f.value = acct.email; f.focus({ preventScroll: true }); }
      var dlg = document.getElementById("q-dialog");
      if (dlg) { dlg.showModal(); document.getElementById("q-keep").focus(); }
    }
  }

  function decide(yes) {
    if (busy) return;
    busy = true;
    var card = document.getElementById("card");
    var done = function () {
      if (yes) st.liked.push(CARDS[st.idx].siteId);
      st.idx++;
      save();
      if (st.idx >= CARDS.length) go(3); else render();
    };
    if (reduced || !card) return done();
    card.style.transition = "transform .25s ease";
    card.style.transform = "translateX(" + (yes ? 600 : -600) + "px) rotate(" + (yes ? 25 : -25) + "deg)";
    setTimeout(done, 250);
  }

  function setupDeck() {
    var card = document.getElementById("card");
    var x0 = 0, dx = 0, drag = false;
    var yes = document.getElementById("stamp-yes"), no = document.getElementById("stamp-no");
    card.addEventListener("pointerdown", function (e) {
      if (busy) return;
      drag = true; x0 = e.clientX; dx = 0; card.style.transition = "none";
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    });
    card.addEventListener("pointermove", function (e) {
      if (!drag) return;
      dx = e.clientX - x0;
      card.style.transform = "translateX(" + dx + "px) rotate(" + dx / 18 + "deg)";
      yes.style.opacity = Math.max(0, Math.min(1, dx / 90));
      no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    var end = function () {
      if (!drag) return;
      drag = false;
      if (dx > 100) return decide(true);
      if (dx < -100) return decide(false);
      card.style.transition = reduced ? "none" : "transform .25s ease";
      card.style.transform = "";
      yes.style.opacity = no.style.opacity = 0;
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    keyHandler = function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") decide(true);
      else if (e.key === "ArrowLeft") decide(false);
    };
    document.addEventListener("keydown", keyHandler);
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || g.busy()) return;
    var act = b.getAttribute("data-act"), v = b.getAttribute("data-val");
    if (act === "start") { st = Object.assign(blank(), { start: v }); save(); go(1); }
    else if (act === "band") { st.band = v; st.idx = 0; st.liked = []; st.season = null; st.month = null; st.pick = null; save(); go(2); }
    else if (act === "yes") decide(true);
    else if (act === "no") decide(false);
    else if (act === "season") { st.season = v; st.month = null; st.pick = null; save(); go(v === "unsure" ? 5 : 4); }
    else if (act === "month") { var p = v ? v.split("-") : null; st.month = p ? { month: +p[0], year: +p[1] } : null; st.pick = null; save(); go(5); }
    else if (act === "pick") { st.pick = v; save(); go(6); }
    else if (act === "again") { st = blank(); save(); session = null; acct = { mode: "create", error: "", note: "", existing: null, email: "" }; try { sessionStorage.removeItem(SAVED); } catch (e2) { /* fine */ } go(0); }
    else if (act === "save") { acct.error = ""; acct.note = ""; go(7); }
    else if (act === "mode") { var ef = document.getElementById("q-email"); if (ef) acct.email = ef.value; acct.mode = v; acct.error = ""; render(); }
    else if (act === "retry") doSave();
    else if (act === "replace") doReplace();
    else if (act === "keep") keepIt();
  });

  // The page's own error is shown in #q-err; field is the input at fault.
  function setErr(text, field, ok) {
    var e = document.getElementById("q-err");
    if (e) { e.textContent = text; e.className = "q-error" + (ok ? " q-ok" : ""); }
    ["q-email", "q-pass"].forEach(function (id) {
      var i = document.getElementById(id);
      if (i) { if (field === id && !ok) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); }
    });
  }
  function setDisabled(b) { Array.prototype.forEach.call(root.querySelectorAll("button"), function (x) { x.disabled = b; }); }
  function fieldFor(code) {
    var c = String(code || "").split(/[\s:]/)[0];
    return c === "EMAIL_EXISTS" || c === "INVALID_EMAIL" ? "q-email" : c === "WEAK_PASSWORD" || c === "INVALID_LOGIN_CREDENTIALS" || c === "INVALID_PASSWORD" || c === "EMAIL_NOT_FOUND" ? "q-pass" : null;
  }
  function thisTrip() { return trips.filter(function (x) { return x.key === st.pick; })[0]; }
  function newBody() { return tripBody(thisTrip(), startDateFor(st, new Date()), function () { return crypto.randomUUID(); }); }
  function finish(email, title, kept) {
    try { sessionStorage.setItem(SAVED, JSON.stringify({ email: email, title: title, kept: !!kept })); } catch (e) { /* the screen still shows this time */ }
    session = null;
    go(8);
  }

  // Every failure ends in a re-render or a re-enabled form, never a stuck disabled button.
  function fail(err) {
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
    if (!p) return;
    setDisabled(true);
    p.then(onOk).catch(fail);
  }
  function afterSave(r) {
    if (r.result === "has-trip") { acct.note = "has-trip"; acct.existing = r.existing; acct.error = ""; return render(); }
    finish(session.email, thisTrip().label);
  }
  function doSave() {
    acct.error = "";
    run(function () { return saveFlow(fetch.bind(window), session.idToken, newBody()); }, afterSave);
  }
  function doReplace() {
    acct.error = "";
    run(function () { return replaceTrip(fetch.bind(window), session.idToken, acct.existing.id, newBody()); }, function () { finish(session.email, thisTrip().label); });
    // buttons are off while it runs; say so (a failure re-renders a fresh dialog, success leaves the screen)
    var dlg = document.getElementById("q-dialog"), rb = root.querySelector("[data-act=replace]");
    if (g.busy() && dlg && rb) { dlg.setAttribute("aria-busy", "true"); rb.textContent = "Replacing…"; }
  }
  function keepIt() { if (session && acct.existing && !g.busy()) finish(session.email, acct.existing.title || "Your trip", true); }

  // Escape on the dialog means Keep (cancel does not bubble, so listen while it goes down).
  root.addEventListener("cancel", function (e) { e.preventDefault(); keepIt(); }, true);
  // newer Chrome can close on Escape without cancel (no interaction since showModal); close does not bubble either
  root.addEventListener("close", keepIt, true);

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
      return (acct.mode === "signin" ? signIn : signUp)(net, email, passEl.value).then(function (s) {
        session = s;
        return saveFlow(net, s.idToken, newBody());
      });
    }, afterSave);
  });

  backBtn.addEventListener("click", function () {
    var step = stepFromHash(location.hash);
    location.hash = "#" + prevStep(step);
  });

  window.addEventListener("hashchange", function () { if (trips) render(); });

  function onTrips(d) {
    try {
      trips = d.trips;
      st = cleanState(st, trips, new Date());
      save();
      render();
    } catch (e) {
      root.innerHTML = '<h1>Something went wrong</h1><p>The quiz hit a problem. Reload the page, or <a href="/#trips">see the suggested trips</a>.</p>';
    }
  }
  function loadError() {
    root.innerHTML = '<h1>Something went wrong</h1><p>The trips would not load. Try again, or <a href="/#trips">see the suggested trips</a>.</p>';
  }
  fetch("/plan/trips.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(onTrips, loadError);
})();
