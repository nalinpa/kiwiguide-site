// The trip quiz: where you start, how long, when, how you like to travel, then a trip built for the answers (builder.js).
// The pure functions at the top are tested (test/quiz.test.js); the page code at the bottom only runs in a browser.

var PHOTO = "https://api.blacksands.app/images/southislandguide/";
// fact: the first photo break's line, after "<Town>, <N> days." (the owner's words, 2026-11-23)
var TOWNS = [
  { id: "queenstown", out: "Fly out of Queenstown", name: "Queenstown", sub: "Fly in to the lakes and mountains, with Wānaka and Milford Sound close by.", fact: "Lake and mountains in every direction and more adventure than you could pack into a month.", img: PHOTO + "a6904a0d-2c8e-4f25-b533-e51241d6665e.webp" },
  { id: "christchurch", out: "Fly out of Christchurch", name: "Christchurch", sub: "Fly in to the Garden City, then inland to Tekapo and Mount Cook or up the coast to Kaikōura.", fact: "A garden city with fresh energy, great food and a lively bar scene, and the beach and the Port Hills both close by.", img: PHOTO + "2f5a12e0-dfbc-4fcd-a7bc-f86ca3e0e0dd.webp" },
  { id: "picton", out: "Take the ferry back to Wellington", name: "Picton", sub: "Off the ferry from Wellington, into the Marlborough Sounds, Nelson and Abel Tasman.", fact: "A laid-back harbour town at the edge of the Marlborough Sounds with boat trips, bush walks and wineries close by.", img: PHOTO + "7711e2f4-268e-4f3e-ab25-30d72a357cbe.webp" },
  // Larnach Castle, Moturoa / Rabbit Island, Stirling Point (Bluff): featured places in each town
  // more: behind the start screen's "Other towns" button (the owner, 2026-11-23)
  { id: "dunedin", out: "Fly out of Dunedin", name: "Dunedin", sub: "Wildlife, castles and steep streets, then south to the Catlins or inland to Central Otago.", fact: "A southern city with real character and a wild peninsula where albatross, penguins and seals live just out of town.", img: PHOTO + "6bdb19f2-c7e1-4601-bfd2-0c4265831f74.webp", more: true },
  { id: "nelson", out: "Fly out of Nelson", name: "Nelson", sub: "Golden beaches and Abel Tasman on the sunny top of the island.", fact: "The sunniest spot in the country with golden beaches and Abel Tasman a short drive away.", img: PHOTO + "8d44a03a-d3ba-4c71-ba59-a25faf23e4b5.webp", more: true },
  { id: "invercargill", out: "Fly out of Invercargill", name: "Invercargill", sub: "The far south: Bluff, the Catlins and Fiordland.", fact: "Friendly and unhurried and your way in to Bluff, the Catlins and the ferry across to Stewart Island.", img: PHOTO + "a2f24963-ec1c-4a10-a50c-31733b302595.webp", more: true },
];

var STEPS = ["start", "band", "days", "finish", "break1", "season", "month", "pace", "drive", "who", "age", "vibe", "break2", "into", "food", "heard", "account", "choice", "reveal", "done"];

// "How long have you got?", the first quiz's rough lengths: each opens the days picker on its top number (2 to 21 days).
var BANDS = [
  { id: "weekend", label: "A long weekend", hint: "Three or four days", days: 4 },
  { id: "week", label: "About a week", hint: "Five to seven days", days: 7 },
  { id: "ten", label: "Ten days or so", hint: "A good chunk of the island", days: 10 },
  { id: "fortnight", label: "A couple of weeks", hint: "Time to slow down", days: 14 },
  { id: "long", label: "Three weeks", hint: "The whole island", days: 21 },
];
function bandOf(id) { return BANDS.filter(function (b) { return b.id === id; })[0]; }

// The fewest days from each start (row) to each finish (column) from which every length up to 21 gets a trip. The builder's
// day blocks set these (test/quiz.test.js checks them against builder.js). From Invercargill, the website-only day to Te
// Anau (owner, 2026-11-24) reaches Queenstown, and back to Invercargill, in 2.
var MIN_DAYS = {
  queenstown: { queenstown: 2, christchurch: 4, picton: 6, dunedin: 3, nelson: 7, invercargill: 2 },
  christchurch: { queenstown: 4, christchurch: 2, picton: 2, dunedin: 7, nelson: 3, invercargill: 6 },
  picton: { queenstown: 6, christchurch: 2, picton: 2, dunedin: 9, nelson: 2, invercargill: 8 },
  dunedin: { queenstown: 3, christchurch: 2, picton: 3, dunedin: 2, nelson: 4, invercargill: 5 },
  nelson: { queenstown: 8, christchurch: 4, picton: 3, dunedin: 11, nelson: 2, invercargill: 10 },
  invercargill: { queenstown: 2, christchurch: 3, picton: 5, dunedin: 2, nelson: 6, invercargill: 2 },
};
function minDays(start, end) { return (MIN_DAYS[start] && MIN_DAYS[start][end]) || 2; }
// The days are asked before the finish (owner, 2026-11-23). The fewest days any trip from this start takes:
function leastFrom(start) { var row = MIN_DAYS[start]; return row ? Math.min.apply(null, Object.keys(row).map(function (k) { return row[k]; })) : 2; }
// and the finishes a trip of this many days can reach from it, in the towns' order (never none: test/quiz.test.js).
function endsFor(start, days) { return TOWNS.filter(function (t) { return minDays(start, t.id) <= days; }).map(function (t) { return t.id; }); }
// The finish screen for a start and a number of days: the loop card (when the days get back), the towns shown as cards,
// and the towns behind "Somewhere else?" (only when there are two or more of them and the screen would run past four cards;
// none once it is open). Towns the days can't reach are left off (owner, 2026-11-23).
function finishCards(start, days, open) {
  var ok = endsFor(start, days), can = function (id) { return ok.indexOf(id) >= 0; };
  var rest = TOWNS.filter(function (t) { return t.id !== start && can(t.id); }), more = rest.filter(function (t) { return t.more; });
  var all = open || more.length < 2 || (can(start) ? 1 : 0) + rest.length <= 4;
  return {
    home: can(start),
    towns: rest.filter(function (t) { return all || !t.more; }).map(function (t) { return t.id; }),
    behind: all ? [] : more.map(function (t) { return t.id; }),
  };
}

var PACES = [
  { id: "easy", label: "Easy", hint: "Short walks, mostly flat. Skips the longest walk on a busy day." },
  { id: "some", label: "Some walking", hint: "A mix: a few good walks, nothing all day." },
  { id: "hikes", label: "Lots of walking", hint: "Adds the long walks of two hours or more in each town." },
];
var DRIVES = [
  { id: 120, label: "A little", hint: "Up to 2 hours a day" },
  { id: 240, label: "Some", hint: "Up to 4 hours a day" },
  { id: 360, label: "Happy to drive", hint: "Up to 6 hours a day" },
];
// A long way in few days: the drive between the start's and the finish's hubs (the app's own, test/quiz.test.js checks it
// against pack.js), spread over the days, is over 2 hours a day. The driving isn't asked then: Happy to drive (owner,
// 2026-11-24: "dont ask them about it on those short long distance trips"). Each: the fewest days 2 hours a day covers.
var LONG_DRIVES = { christchurch: { picton: 3 }, picton: { christchurch: 3 }, dunedin: { christchurch: 3, picton: 5, nelson: 5 }, invercargill: { christchurch: 4, picton: 6, nelson: 7 } };
function longDrive(start, end, days) { return !!(LONG_DRIVES[start] && LONG_DRIVES[start][end] > days); }
// Who's travelling, their age and how they heard of the app (owner, 2026-11-24): kept with the quiz answers (analytics) only,
// the trip the same whatever they say. Age and how they heard can be skipped ("skip").
var WHO = [
  { id: "solo", label: "Solo", hint: "Just me" },
  { id: "couple", label: "Couple", hint: "The two of us" },
  { id: "family", label: "Family", hint: "With kids" },
  { id: "group", label: "Group", hint: "Friends travelling together" },
];
var AGES = [{ id: "18-29", label: "18–29" }, { id: "30-44", label: "30–44" }, { id: "45-59", label: "45–59" }, { id: "60+", label: "60+" }];
var HEARD = [{ id: "app-store", label: "App Store" }, { id: "google", label: "Google" }, { id: "social", label: "Instagram or TikTok" }, { id: "friend", label: "A friend" }, { id: "other", label: "Other" }];
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
// The activities a card can add to the trip, each line naming places or towns the data tags. No surfing or mountain biking
// until the owner has tracked them (2026-11-23); skiing needs a card of its own once a ski field is tagged (none yet).
var ACTIVITIES = [
  { id: "skiing", label: "Skiing", hint: "Only offered June to October" },
  { id: "hot-pools", label: "Hot pools", hint: "Hanmer Springs, Tekapo Springs and more" },
  { id: "kayaking", label: "Kayaking", hint: "Abel Tasman, Wānaka, Franz Josef and more" },
  { id: "wildlife", label: "Wildlife", hint: "Kaikōura, Ōamaru, Dunedin and more" },
  { id: "stargazing", label: "Stargazing", hint: "Mt John and the Dark Sky Project, Tekapo" },
  { id: "wine", label: "Wine", hint: "Wine tours around Blenheim" },
];
// "What are you into?": a swipe card per kind of place (into) and per activity (act), mixed (owner, 2026-11-23). Each shows one
// real place (site) in its full-size app photo, credited as the app repo's docs/photo-sources.md records. Nature's whale says
// yes to wildlife too, so wildlife has no card of its own.
var DECK = [
  { into: "Scenic", site: "devils-staircase-lookout", img: PHOTO + "b2e5ef81-cc95-4268-a0e1-49263665fa12.webp", alt: "Lake Wakatipu below a long range of snow-capped mountains, with scrub in the foreground", credit: "public domain, via Wikimedia Commons" },
  { into: "Walks", site: "routeburn-track-day-walk", img: PHOTO + "75144c4e-3c1c-47c3-b1c9-fbe3e9041c51.webp", alt: "A wooden swing bridge on a walking track, leading into misty beech forest", credit: "ShakyIsles, CC BY-SA 4.0, resized" },
  { into: "Nature", act: "wildlife", site: "whale-watch-kaikoura", img: PHOTO + "d07fe98e-0016-4bdd-addc-5f078dc4c73e.webp", alt: "A whale’s tail rising out of the sea, with mountains behind", credit: "Whale Watch Kaikoura" },
  { into: "Water", site: "cruise-milford-small-boat-cruise", img: PHOTO + "67aba220-6978-4ea7-9ea9-5c747da82491.webp", alt: "A small cruise boat on Milford Sound below a sheer, bush-covered mountain wall, with a waterfall to the left", credit: "Great South" },
  { act: "hot-pools", site: "onsen-hot-pools", img: PHOTO + "af2e0c60-d2be-4628-a5c8-72f8c7a89dd2.webp", alt: "A woman soaking in a cedar hot tub, looking out at mountains in evening light", credit: "Onsen Hot Pools" },
  { into: "Culture", site: "toitu-otago-settlers-museum", img: PHOTO + "c2dc5a91-bd45-4279-92eb-140446f5876e.webp", alt: "Two girls walking past a red wall covered in old framed portraits of settlers", credit: "DunedinNZ" },
  { act: "kayaking", site: "marahau-sea-kayaks", img: PHOTO + "bb7b4ee2-3468-46ed-a501-97df6aee549e.webp", alt: "Two people paddling an orange sea kayak past granite boulders in clear green water", credit: "Nelson Tasman" },
  { into: "Attractions", site: "west-coast-treetop-walk", img: PHOTO + "7e5886dd-76f1-4bf9-9c26-883d1b354eb2.webp", alt: "Two people walking along a steel walkway high above the rainforest canopy", credit: "BareKiwi" },
  { act: "stargazing", site: "dark-sky-project-summit-experience", img: PHOTO + "442f673d-dc53-45e3-bc73-30136399e184.webp", alt: "The Milky Way over Lake Tekapo, with the town’s lights below", credit: "Ekant Veer" },
  { into: "Adventure", site: "franz-josef-glacier-heli-hike", img: PHOTO + "ff1293cd-b943-48ed-b68f-d7324dcfe48d.webp", alt: "Five hikers in helmets with ice axes standing on Franz Josef Glacier among towering blue-white ice", credit: "Franz Josef Glacier Guides" },
  { act: "wine", site: "wine-tours-by-bike", img: PHOTO + "4be2fd1c-491d-45fa-8c71-344cd6c7d1cb.webp", alt: "Two cyclists riding a lane between rows of golden autumn vines", credit: "Only Marlborough" },
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
  if (!m) { // no season: three months from today (the owner, 2026-11-23), the same day or, in a shorter month, its last
    var y = today.getFullYear(), mo = today.getMonth() + 3;
    return iso(y, mo, Math.min(today.getDate(), new Date(y, mo + 1, 0).getDate()));
  }
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

function blankState() { return { start: null, end: null, band: null, days: null, season: null, month: null, pace: null, drive: null, who: null, age: null, vibes: null, into: null, food: null, activities: null, heard: null, pick: null }; }
function oneOf(list, v) { return list.some(function (x) { return x.id === v; }); }
function someOf(list, v) { return Array.isArray(v) && v.every(function (x) { return oneOf(list, x); }); }

// The answers in the order they're asked, each with the step that asks it. (The month is optional: "Not sure which month".)
var ASKED = [["start", "start"], ["band", "band"], ["days", "days"], ["end", "finish"], ["season", "season"], ["pace", "pace"], ["drive", "drive"], ["who", "who"], ["age", "age"], ["vibes", "vibe"], ["into", "into"], ["activities", "into"], ["food", "food"], ["heard", "heard"], ["pick", "choice"]];
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
  var least = leastFrom(s.start);
  if (!oneOf(BANDS, s.band) || bandOf(s.band).days < least) return out;
  out.band = s.band;
  if (typeof s.days !== "number" || !(s.days >= least && s.days <= 21 && s.days % 1 === 0)) return out;
  out.days = s.days;
  // a finish the days can't reach is asked again
  if (!oneOf(TOWNS, s.end) || minDays(s.start, s.end) > s.days) return out;
  out.end = s.end;
  if (s.season !== "unsure" && !oneOf(SEASONS, s.season)) return out;
  out.season = s.season;
  var m = s.month;
  if (m && s.season !== "unsure" && monthsOf(s.season, today).some(function (x) { return x.month === m.month && x.year === m.year; })) out.month = { month: m.month, year: m.year };
  else if (m) return out;
  if (!oneOf(PACES, s.pace)) return out;
  out.pace = s.pace;
  if (!oneOf(DRIVES, s.drive)) return out;
  out.drive = s.drive;
  if (!oneOf(WHO, s.who)) return out;
  out.who = s.who;
  if (s.age !== "skip" && !oneOf(AGES, s.age)) return out;
  out.age = s.age;
  if (!someOf(VIBES, s.vibes)) return out;
  out.vibes = s.vibes.slice();
  if (!someOf(INTO, s.into)) return out;
  out.into = s.into.slice();
  if (!someOf(ACTIVITIES, s.activities)) return out;
  out.activities = s.activities.slice();
  if (typeof s.food !== "boolean") return out;
  out.food = s.food;
  if (s.heard !== "skip" && !oneOf(HEARD, s.heard)) return out;
  out.heard = s.heard;
  if (typeof s.pick === "string") out.pick = s.pick; // checked against the trips once they're built
  return out;
}

// The activities worth asking about: those the data has somewhere; skiing only for a June to October start.
function activitiesFor(data, startMonth) {
  var have = Object.create(null);
  Object.keys(data.places).forEach(function (k) { data.places[k].activities.forEach(function (a) { have[a] = true; }); });
  return ACTIVITIES.filter(function (a) { return have[a.id] && (a.id !== "skiing" || (startMonth >= 5 && startMonth <= 9)); });
}

// The cards on offer: every kind of place, and the activities the data has for this start month. A card whose activity
// isn't on offer keeps only its kind of place (Nature without wildlife); a card that is only an activity goes.
function cardsFor(data, startMonth) {
  var acts = activitiesFor(data, startMonth).map(function (a) { return a.id; });
  return DECK.filter(function (c) { return c.into || acts.indexOf(c.act) >= 0; }).map(function (c) {
    var of = c.into ? INTO.filter(function (x) { return x.id === c.into; })[0] : ACTIVITIES.filter(function (x) { return x.id === c.act; })[0];
    return Object.assign({}, c, { id: c.into || c.act, label: of.label, hint: of.hint, act: acts.indexOf(c.act) >= 0 ? c.act : undefined });
  });
}

// The quiz answers in buildTrips' shape (builder.js).
function answersFor(st) {
  return { start: st.start, end: st.end, days: st.days, pace: st.pace, drive: st.drive, vibes: st.vibes, into: st.into, food: st.food, activities: st.activities };
}

// What the trip screens show: "loading" until the builder's data and pack.js are in, "error" if they failed, else the trips.
function revealState(load, ans, build) {
  if (load.status === "error") return "error";
  if (load.status !== "ready") return "loading";
  return build(load.data, load.pack, ans);
}

// The photo breaks: 1 after "Where does your trip finish?" (the start town's card photo), 2 after the vibe.
function breakLine(n, st) {
  if (n === 1) {
    var t = TOWNS.filter(function (x) { return x.id === st.start; })[0];
    // the photo is a thumbnail, so it shows as a card at its own size, not full screen
    var head = t.name + ", " + st.days + " days.";
    return { line: head + " " + t.fact, head: t.name + ", " + st.days + "\u00a0days.", body: t.fact, img: t.img, credit: "", card: true };
  }
  var vibes = st.vibes || [];
  var p = VIBE_PHOTOS.filter(function (x) { return vibes.indexOf(x.vibe) >= 0; })[0] || VIBE_PHOTOS[VIBE_PHOTOS.length - 1];
  return { line: "Over 500 places on the island. Picking the ones that fit you.", img: p.img, credit: p.credit };
}

// Back never lands on a photo break: from the screen after one it goes to the question before it.
function backStep(step) {
  var p = Math.max(0, step - 1);
  return /^break/.test(STEPS[p]) ? p - 1 : p;
}

// The cards: a new deck opens on card 1; coming back to a finished one shows its last card again, that card's yes taken back.
function deckStart(ids, picked) {
  if (!picked) return { idx: 0, yes: [] };
  var last = ids[ids.length - 1];
  return { idx: Math.max(0, ids.length - 1), yes: picked.filter(function (id) { return id !== last && ids.indexOf(id) >= 0; }) };
}
// What the yes cards answer: their kinds of place and their activities, each in its own list's order.
function deckAnswers(cards, yes) {
  var on = cards.filter(function (c) { return yes.indexOf(c.id) >= 0; });
  var pick = function (list, key) { return list.map(function (x) { return x.id; }).filter(function (id) { return on.some(function (c) { return c[key] === id; }); }); };
  return { into: pick(INTO, "into"), activities: pick(ACTIVITIES, "act") };
}
// The yes cards behind answers already given (back to a finished deck), or null before the deck is done.
function deckYes(cards, st) {
  if (!st.into || !st.activities) return null;
  return cards.filter(function (c) { return c.into ? st.into.indexOf(c.into) >= 0 : st.activities.indexOf(c.act) >= 0; }).map(function (c) { return c.id; });
}
// One card answered: the deck on its next card, or, after the last, the answers in the state (and no trip picked: the trips change).
function deckAnswer(deck, cards, yes, st) {
  var next = { idx: deck.idx + 1, yes: yes ? deck.yes.concat([cards[deck.idx].id]) : deck.yes.slice(), key: deck.key };
  if (next.idx < cards.length) return { deck: next, st: st };
  var got = deckAnswers(cards, next.yes);
  return { deck: null, st: Object.assign({}, st, { into: got.into, activities: got.activities, pick: null }) };
}
// A key on the cards: the right arrow says yes, the left arrow no; a key held down (its repeats) or with a modifier, nothing.
function deckKey(e) {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return null;
  return e.key === "ArrowRight" ? true : e.key === "ArrowLeft" ? false : null;
}

function labelOf(list, id) { return list.filter(function (x) { return x.id === id; })[0].label; }
function and(list, word) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " " + (word || "and") + " " + list[list.length - 1]; }

// The reveal's summary: the visitor's own answers, nothing more.
function summaryLine(option, st) {
  var parts = [labelOf(PACES, st.pace).toLowerCase(), "up to " + st.drive / 60 + " hours of driving a day"];
  if (st.vibes.length) parts.push(and(st.vibes.map(function (v) { return labelOf(VIBES, v).toLowerCase(); })));
  parts.push(st.food ? "food tips" : "no food tips");
  st.activities.forEach(function (a) { parts.push(labelOf(ACTIVITIES, a).toLowerCase()); });
  return (option.kind === "built" ? "Built for you: " : "Hand-checked trip: ") + parts.join(", ") + ".";
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
  module.exports = { STEPS: STEPS, TOWNS: TOWNS, BANDS: BANDS, MIN_DAYS: MIN_DAYS, minDays: minDays, leastFrom: leastFrom, endsFor: endsFor, finishCards: finishCards, PACES: PACES, WHO: WHO, AGES: AGES, HEARD: HEARD, LONG_DRIVES: LONG_DRIVES, longDrive: longDrive, backStep: backStep, deckStart: deckStart, cardsFor: cardsFor, deckAnswers: deckAnswers, deckYes: deckYes, deckAnswer: deckAnswer, deckKey: deckKey, ACTIVITIES: ACTIVITIES, monthsOf: monthsOf, startDateFor: startDateFor, seasonOf: seasonOf, seasonLine: seasonLine, stepFromHash: stepFromHash, tripPhotos: tripPhotos, stopPhoto: stopPhoto, SEP: SEP, dots: dots, firstOpenStep: firstOpenStep, cleanState: cleanState, activitiesFor: activitiesFor, answersFor: answersFor, revealState: revealState, breakLine: breakLine, measureParams: measureParams, driveLine: driveLine, summaryLine: summaryLine, retryLoad: retryLoad, waitScreen: waitScreen };
}

// ---- the page ----
if (typeof document !== "undefined") (function () {
  var APP = "https://apps.apple.com/app/apple-store/id6818057796?pt=128674950&ct=quiz&mt=8";
  var KEY = "kg-quiz";
  var root = document.getElementById("q");
  var bar = document.getElementById("bar");
  var backBtn = document.getElementById("back");
  var PROGRESS = { start: 5, band: 10, days: 15, finish: 20, break1: 25, season: 30, month: 36, pace: 42, drive: 48, who: 53, age: 58, vibe: 63, break2: 67, into: 74, food: 86, heard: 91, account: 94, choice: 97, reveal: 100, done: 100 };
  var S = {}; STEPS.forEach(function (n, i) { S[n] = i; });
  var NEEDS_DATA = { into: 1, choice: 1, reveal: 1 };
  var CHIPS = [3, 5, 7, 10, 12, 14, 17, 21];
  var draft = null; // the days picker's number, or a pick list's ids, until Next
  var allTowns = false, allEnds = false; // "Somewhere else?" tapped: the start (or finish) screen shows every town
  // The activity cards: where the visitor is in the deck (in memory: a reload starts the deck again), one card moving at a time
  var deck = null, busy = false, keyHandler = null;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var st = blankState();
  try { st = cleanState(JSON.parse(sessionStorage.getItem(KEY)), new Date()); } catch (e) { /* works without it */ }
  var track = typeof window.track === "function" ? window.track : function () {}; // the quiz works without measure.js
  var started = !!st.start, revealed = ""; try { revealed = sessionStorage.getItem("kg-revealed") || ""; } catch (e) { /* fires again */ }
  // events (measure.js): quiz_start once per visit; quiz_step per answer; quiz_reveal once per trip shown (the marker survives a reload)
  function answered(step, answer) { track("quiz_step", { step: step, answer: answer }); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* works without it */ } }

  var SAVED = "kg-saved";
  var GOOGLE = "kg-google"; // { state, nonce, provider } while the visitor is at Google or Apple; removed on return
  // Continue with Apple for everyone: owner's phone test passed, Apple's screen shows Kiwi Guide (2026-11-26)
  var APPLE_ON = true;
  var A_MARK = '<svg width="20" height="20" viewBox="0 0 814 1000" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-107-58-157-129C43 788 0 671 0 560c0-178 116-272 230-272 61 0 111 40 149 40 37 0 94-42 163-42 26 0 120 2 182 92zM554 175c28-34 49-81 49-128 0-7-1-13-2-19-46 2-101 31-134 70-26 30-50 77-50 124 0 7 1 14 2 16 3 1 8 1 12 1 41 0 93-28 123-64z"/></svg>';
  var G_MARK = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  // Back from Google: the answer is in the address bar (#id_token=..&state=..). Take it and clear it before anything else.
  // Anything that carries id_token or error is cleared, even if it is malformed or the saved key is corrupt.
  var gfrag = /(^|[#&])(id_token|error)=/.test(location.hash), gret = null, gsaved = null, notice = "";
  if (gfrag) {
    gret = readGoogleReturn(location.hash);
    try { gsaved = JSON.parse(sessionStorage.getItem(GOOGLE)); } catch (e) { /* refused later */ } finally { try { sessionStorage.removeItem(GOOGLE); } catch (e2) { /* fine */ } }
    history.replaceState(null, "", location.pathname + location.search + "#" + S.account);
  }
  var session = null; // { idToken, email, uid, isNew }: in memory only, never stored
  var acct = { mode: "create", error: "", note: "", existing: null, email: "", optIn: false };
  var g = guard(); // one sign-in, save or replace at a time
  // The trip saved (or kept) for the trip picked: { email, title, kept, pick }. A copy in memory for when sessionStorage is off.
  var savedMem = null;
  function savedInfo() { var d = savedMem; if (!d) try { d = JSON.parse(sessionStorage.getItem(SAVED)); } catch (e) { /* none */ } return d && typeof d.email === "string" && typeof d.title === "string" && d.pick && d.pick === st.pick ? d : null; }
  var shown = ""; // the step last painted: a re-render of the trip (after a save) keeps its error and dialog, coming back doesn't

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
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function town(id) { return TOWNS.filter(function (t) { return t.id === id; })[0]; }
  function areaName(id) { var t = load.data && load.data.towns[id]; return t ? t.name : id; }
  function go(step) { if (location.hash === "#" + step) render(); else location.hash = "#" + step; }
  function days(n) { return n + (n === 1 ? " day" : " days"); }
  function startMonth() { return +startDateFor(st, new Date()).slice(5, 7) - 1; }
  function offered() { return activitiesFor(load.data, startMonth()); }
  function cards() { return cardsFor(load.data, startMonth()); }
  function least() { return leastFrom(st.start); }
  function fromTo() { return st.end === st.start ? "From " + town(st.start).name + " and back" : town(st.start).name + " to " + town(st.end).name; }

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
    // the trip (never shown once saved): to the cards, or past them with one trip, which would only show again
    if (name === "reveal") { var o = options(); return typeof o !== "string" && o.length === 1 ? prevStep(S.choice) : S.choice; }
    if (name === "choice" && session) return S.heard; // signed in: the account step would only send the visitor back here
    if (name === "pace") return st.season && st.season !== "unsure" ? S.month : S.season;
    return backStep(step);
  }

  function choice(label, hint, act, val, on) {
    return '<button type="button" class="q-btn' + (on ? " q-on" : "") + '" data-act="' + act + '" data-val="' + esc(val) + '"><span>' + esc(label) + "</span>" + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</button>";
  }
  function picks(key, list) {
    return list.map(function (x) {
      var on = draft.indexOf(x.id) >= 0;
      return '<button type="button" class="q-btn q-pick' + (on ? " q-on" : "") + '" data-act="toggle" data-val="' + esc(x.id) + '" aria-pressed="' + on + '"><span>' + esc(x.label) + "<small>" + esc(x.hint) + '</small></span><span class="q-chk" aria-hidden="true">' + (on ? "✓" : "") + "</span></button>";
    }).join("") + '<button type="button" class="q-cta q-next" data-act="picked" data-val="' + key + '">' + (draft.length ? "Next" : "Skip") + "</button>";
  }
  function photoBreak(b) {
    return '<div class="q-brk' + (b.card ? " q-brk-card" : "") + '"><img src="' + esc(b.img) + '" alt=""><div class="q-brk-text"><h1 class="q-brk-line" tabindex="-1">' + esc(b.head || b.line) + "</h1>" + (b.body ? '<p class="q-brk-body">' + esc(b.body) + "</p>" : "") +
      (b.credit ? "<small>" + esc(b.credit) + "</small>" : "") + '<button type="button" class="q-cta q-next" data-act="next">Next</button></div></div>';
  }
  function whenLabel() {
    return st.month ? MONTH_NAMES[st.month.month] + " " + st.month.year : st.season && st.season !== "unsure" ? labelOf(SEASONS, st.season) : "";
  }

  var screens = {
    start: function () {
      // Queenstown, Christchurch and Picton, then "Somewhere else?" with Dunedin's photo for the rest (owner, 2026-11-23),
      // open already when the visitor picked one of them
      var all = allTowns || town(st.start) && town(st.start).more, more = TOWNS.filter(function (t) { return t.more; });
      return '<p class="q-kicker">Plan your South Island trip in a minute</p><h1 tabindex="-1">Where do you start?</h1>' +
        TOWNS.filter(function (t) { return all || !t.more; }).map(function (t) {
          return '<button type="button" class="q-town" data-act="start" data-val="' + t.id + '"><img src="' + t.img + '" alt="" width="640" height="360">' +
            '<span class="q-town-text"><strong>' + t.name + "</strong><span>" + esc(t.sub) + "</span></span></button>";
        }).join("") +
        (all ? "" : '<button type="button" class="q-town" data-act="other-towns"><img src="' + more[0].img + '" alt="" width="640" height="360">' +
          '<span class="q-town-text"><strong>Somewhere else?</strong><span>' + esc(and(more.map(function (t) { return t.name; }), "or")) + "</span></span></button>");
    },
    // Asked once the days are set (owner, 2026-11-23), so only the towns those days can reach. The start town first,
    // highlighted: "Finish back in X"; then the other towns as the start screen has them.
    finish: function () {
      // open already when the visitor picked one of the towns behind "Somewhere else?"
      var home = town(st.start), f = finishCards(st.start, st.days, allEnds || !!(st.end && st.end !== st.start && town(st.end).more));
      var card = function (t, title, line, cls) {
        return '<button type="button" class="q-town' + (cls || "") + '" data-act="finish" data-val="' + t.id + '"><img src="' + t.img + '" alt="" width="640" height="360">' +
          '<span class="q-town-text"><strong>' + esc(title) + "</strong><span>" + esc(line) + "</span></span></button>";
      };
      return '<p class="q-kicker">' + days(st.days) + " from " + home.name + '</p><h1 tabindex="-1">Where does your trip finish?</h1>' +
        (f.home ? card(home, "Finish back in " + home.name, "A loop, back where you started", " q-home") : "") +
        f.towns.map(function (id) { var t = town(id); return card(t, t.name, t.out); }).join("") +
        (!f.behind.length ? "" : '<button type="button" class="q-town" data-act="other-ends"><img src="' + town(f.behind[0]).img + '" alt="" width="640" height="360">' +
          '<span class="q-town-text"><strong>Somewhere else?</strong><span>' + esc(and(f.behind.map(function (id) { return town(id).name; }), "or")) + "</span></span></button>");
    },
    // Every length this start can do
    band: function () {
      return '<p class="q-kicker">From ' + town(st.start).name + '</p><h1 tabindex="-1">How long have you got?</h1>' +
        BANDS.filter(function (b) { return b.days >= least(); }).map(function (b) { return choice(b.label, b.hint, "band", b.id, st.band === b.id); }).join("");
    },
    days: function () {
      var n = least();
      return '<p class="q-kicker">' + esc(bandOf(st.band).label) + '</p><h1 tabindex="-1">How many days?</h1><p class="q-lead">' + "Pick anything from " + n + " to 21.</p>" +
        '<div class="q-stepper"><button type="button" class="q-step" data-act="fewer" aria-label="One day fewer">−</button>' +
        '<p class="q-num"><strong id="q-n" aria-live="polite">' + draft + "</strong><span>days</span></p>" +
        '<button type="button" class="q-step" data-act="more" aria-label="One day more">+</button></div>' +
        '<input type="range" class="q-range" id="q-range" min="' + n + '" max="21" step="1" value="' + draft + '" aria-label="Number of days">' +
        '<div class="q-ends" aria-hidden="true"><span>' + n + "</span><span>21</span></div>" +
        '<div class="q-chips">' + CHIPS.filter(function (c) { return c >= n; }).map(function (c) {
          return '<button type="button" class="q-chip' + (c === draft ? " q-on" : "") + '" data-act="setdays" data-val="' + c + '" aria-pressed="' + (c === draft) + '">' + c + "</button>";
        }).join("") + "</div>" +
        '<button type="button" class="q-cta q-next" data-act="days">Next</button>';
    },
    break1: function () { return photoBreak(breakLine(1, st)); },
    season: function () {
      return '<p class="q-kicker">' + esc(fromTo()) + " · " + days(st.days) + '</p><h1 tabindex="-1">Which NZ season are you picking?</h1><p class="q-lead">Southern hemisphere seasons!</p>' +
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
    who: function () {
      return '<p class="q-kicker">' + esc(longDrive(st.start, st.end, st.days) ? labelOf(PACES, st.pace) : DRIVES.filter(function (d) { return d.id === st.drive; })[0].hint) + '</p><h1 tabindex="-1">Who’s travelling?</h1>' +
        WHO.map(function (w) { return choice(w.label, w.hint, "who", w.id, st.who === w.id); }).join("");
    },
    age: function () {
      return '<p class="q-kicker">' + esc(labelOf(WHO, st.who)) + '</p><h1 tabindex="-1">How old are you?</h1>' +
        AGES.map(function (a) { return choice(a.label, "", "age", a.id, st.age === a.id); }).join("") +
        '<button type="button" class="q-cta q-next" data-act="age" data-val="skip">Skip</button>';
    },
    vibe: function () { return '<h1 tabindex="-1">What’s the vibe?</h1><p class="q-lead">Pick as many as you like.</p>' + picks("vibes", VIBES); },
    break2: function () { return photoBreak(breakLine(2, st)); },
    // The swipe deck, a card per kind of place and per activity on offer: right (or the heart, or the right arrow key) for yes
    into: function () {
      var list = cards(), c = list[deck.idx], next = list[deck.idx + 1], what = esc(c.label.toLowerCase());
      return '<div class="q-deck-head"><h1 tabindex="-1">What are you into?</h1>' +
        '<p class="q-kicker"><b id="q-card-n">' + (deck.idx + 1) + " of " + list.length + '</b> · <span class="q-touch">Swipe right for yes, left for no.</span><span class="q-keys">Drag the card, or press → for yes and ← for no.</span></p></div>' +
        '<div class="q-deck">' +
        (next ? '<div class="q-card q-card-next"><img src="' + esc(next.img) + '" alt="" width="640" height="480"></div>' : "") +
        '<div class="q-card q-card-top" id="card"><div class="q-card-body">' +
        '<div class="q-card-photo"><img src="' + esc(c.img) + '" alt="' + esc(c.alt) + '" width="640" height="480"><div class="q-card-text"><h2>' + esc(c.label) + '</h2><p id="q-card-line">' + esc(c.hint) + '</p><small class="q-credit">' + esc(load.data.places[c.site].name) + ". Photo: " + esc(c.credit) + "</small></div></div></div>" +
        '<span class="q-stamp q-yes" id="stamp-yes" aria-hidden="true">YES</span><span class="q-stamp q-no" id="stamp-no" aria-hidden="true">NOPE</span></div></div>' +
        '<div class="q-deck-btns"><button type="button" class="q-round q-round-no" data-act="no" aria-label="No, skip ' + what + '" aria-describedby="q-card-n q-card-line"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>No</button>' +
        '<button type="button" class="q-round q-round-yes" data-act="yes" aria-label="Yes, add ' + what + '" aria-describedby="q-card-n q-card-line"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.2 4.3 2.4h2c.8-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>Yes</button></div>';
    },
    food: function () {
      return '<p class="q-kicker">Nearly there</p><h1 tabindex="-1">Food tips?</h1><p class="q-lead">Cafés and places to eat, placed along each day.</p>' +
        choice("Yes", "Add the good places to eat", "food", "yes", st.food === true) + choice("No", "Just the places to see", "food", "no", st.food === false);
    },
    heard: function () {
      return '<p class="q-kicker">Last one</p><h1 tabindex="-1">How did you hear about us?</h1>' +
        HEARD.map(function (h) { return choice(h.label, "", "heard", h.id, st.heard === h.id); }).join("") +
        '<button type="button" class="q-cta q-next" data-act="heard" data-val="skip">Skip</button>';
    },
    // Picking a trip shows it (one trip: render shows it on its own); nothing is saved here.
    choice: function () {
      var list = options(), photos = tripPhotos(list);
      return '<p class="q-kicker">' + (list.length === 1 ? "1 trip fits " : list.length + " trips fit ") + (st.end === st.start ? town(st.start).name + " and back" : town(st.start).name + " to " + town(st.end).name) + " · " + days(st.days) + '</p><h1 tabindex="-1">Which one sounds like you?</h1>' +
        list.map(function (t, n) {
          var built = t.kind === "built";
          return '<button type="button" class="q-trip" data-act="pick" data-val="' + esc(t.key) + '">' + (photos[n] ? '<img src="' + esc(photos[n]) + '" alt="" width="640" height="240">' : "") +
            '<span class="q-trip-text"><b class="q-badge ' + (built ? "q-built" : "q-sugg") + '">' + (built ? "Built for you" : "Hand-checked trip") + "</b><strong>" + esc(t.label) + "</strong><span>" + esc(routeLine(t)) + "</span><em>" + days(t.days.length) + " · " + esc(endLabel(t)) + "</em></span></button>";
        }).join("");
    },
    // The trip, with one button: Save and open in the app (owner, 2026-11-26). Never saved here: render sends a saved one to done.
    reveal: function () {
      var t = thisTrip(), w = whenLabel(), sline = seasonLine(st.season), acts = st.activities, dialog = "";
      // the account has a trip of its own: Replace or Keep
      if (session && acct.note === "has-trip") {
        var x = acct.existing, dt = tripDates(x.startDate, x.endDate);
        dialog = '<dialog class="q-dialog" id="q-dialog" aria-labelledby="q-dlg-h"><h2 id="q-dlg-h">Your account already has a trip</h2><p>This will replace your current trip.</p>' +
          '<p class="q-small">' + esc((x.title || "Your trip") + (dt ? " · " + dt : "")) + '</p><p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>" +
          '<div class="q-actions q-stack"><button type="button" class="q-cta" data-act="replace">Replace it</button><button type="button" class="q-again" id="q-keep" data-act="keep" autofocus>Keep my trip</button></div></dialog>';
      }
      var missing = t.missing.map(function (a) { return labelOf(ACTIVITIES, a).toLowerCase(); });
      // Where each picked activity is: one line per activity, naming its places and days, after the trip (so Day 1 is on a phone's first screen).
      var notes = acts.map(function (a) {
        var at = [];
        t.days.forEach(function (d, k) { d.items.forEach(function (i) { if (i.activities.indexOf(a) >= 0) at.push(i.siteName + " (Day " + (k + 1) + ")"); }); });
        return at.length ? '<p class="q-act">' + esc(labelOf(ACTIVITIES, a) + ": " + at.join(", ")) + "</p>" : "";
      }).join("");
      if (tv.pick !== st.pick) tv = { pick: st.pick, view: "trip", day: tv.day }; // another trip opens on Trip; the open day stays if it has one (paintTrip clamps it)
      return '<p class="q-kicker">Your trip</p><h1 tabindex="-1">' + esc(t.label) + "</h1>" +
        '<p class="q-when"><b>From ' + esc(areaName(t.start)) + (t.end === t.start ? " and back" : " to " + esc(areaName(t.end))) + '</b><br><span class="q-nb">' + days(t.days.length) + (w ? " · " + w : "") + ".</span> Change the dates in the app.</p>" +
        // the button at the top, before the trip (the owner, 2026-11-23 and 2026-11-26); its status and error lines take no
        // space while empty (styles.css); the dialog's own error line stands in while it is up
        '<div class="q-actions q-stack"><button type="button" class="q-cta" data-act="save">' + (acct.error ? "Try again" : "Save and open in the app") + "</button></div>" +
        '<p class="q-status" id="q-status" role="status"></p>' + (dialog ? "" : '<p class="q-error" id="q-err" role="alert">' + esc(acct.error) + "</p>") +
        '<p class="q-match">' + esc(summaryLine(t, st)) + "</p>" +
        (missing.length ? '<p class="q-miss">Nothing for ' + esc(and(missing, "or")) + " on this route.</p>" : "") +
        '<div id="tv" class="q-days tv"></div>' + notes +
        (sline ? '<p class="q-season">' + esc(sline) + "</p>" : "") +
        '<div class="q-actions q-stack"><button type="button" class="q-link q-restart" data-act="again">Start again</button></div>' + dialog;
    },
    // Saved (or kept): the app is its own step (owner, 2026-11-26), with no Back
    done: function () {
      var d = savedInfo();
      return '<div class="q-done"><div class="q-tick"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h1 tabindex="-1">' + (d.kept ? "Your trip is unchanged" : "Your trip is saved") + '</h1><p class="q-lead">' + esc(d.kept ? "Not saved. Your account kept " + d.title + "." : d.title) + "</p>" +
        '<ol class="q-steps"><li><b>1</b><span>Get Kiwi Guide<a class="badge" href="' + APP + '"><img src="/img/app-store-badge-black.svg" alt="Download Kiwi Guide on the App Store" width="162" height="54"></a></span></li>' +
        "<li><b>2</b><span>Sign in with " + esc(d.email) + ", and open Trips.</span></li></ol>" +
        '<button type="button" class="q-again" data-act="again">Start again</button></div>';
    },
    // The account before any trip shows (owner, 2026-11-26): sign in only; the trip's Save button saves it
    account: function () {
      var kicker = '<p class="q-kicker">Last step</p>';
      var mode = acct.mode;
      var title = mode === "forgot" ? "Reset your password" : mode === "signin" ? "Sign in and we'll build your trip" : "Create your free account and we'll build your trip";
      var lead = mode === "forgot" ? "We will email you a link to choose a new password." : mode === "signin" ? "Use your Kiwi Guide account." : "It'll be waiting in the Kiwi Guide app when you sign in.";
      var dby = ' aria-describedby="q-err"';
      var box = mode === "create" ? '<label class="q-optin"><input type="checkbox" id="q-optin"' + (acct.optIn ? " checked" : "") + "><span>Email me now and then to ask for feedback and share Kiwi Guide news</span></label>" : "";
      var google = mode === "forgot" ? "" : box + (APPLE_ON ? '<button type="button" class="q-apple" data-act="apple">' + A_MARK + "<span>Continue with Apple</span></button>" : "") +
        '<button type="button" class="q-google" data-act="google">' + G_MARK + "<span>Continue with Google</span></button>" + '<p class="q-or"><span>or use your email</span></p>';
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
  };
  var PICK_KEY = { vibe: "vibes" };

  function render() {
    removeKeys();
    stopHint();
    var step = stepFromHash(location.hash), name = STEPS[step];
    var ok = firstOpenStep(st, step), saved = savedInfo();
    if (ok !== step) { location.replace("#" + ok); return; }
    // no trip cards without a sign-in, and no trip without a sign-in or a save (a reload loses the sign-in: tokens are never stored)
    if (name === "account" && (saved || session)) { location.replace("#" + (saved ? S.done : S.choice)); return; }
    // saved: the app step, never the trip again (no second save); the app step needs the save
    if (name === "reveal" && saved) { location.replace("#" + S.done); return; }
    if (name === "done" && !saved) { location.replace("#" + S.reveal); return; }
    if ((name === "choice" && !session) || (name === "reveal" && !saved && !session)) { location.replace("#" + S.account); return; }
    if (name === "reveal" && shown !== "reveal" && !g.busy()) { acct.error = acct.note = ""; acct.existing = null; }
    if (NEEDS_DATA[name] && load.status !== "ready") {
      loadData();
      root.innerHTML = dots(waitScreen(load.status));
      return painted(name);
    }
    // one trip for the answers: no cards, it shows on its own (back from it goes past the cards: prevStep)
    if (name === "choice") { var list = options(); if (list.length === 1) { st.pick = list[0].key; save(); location.replace("#" + S.reveal); return; } }
    if (name === "reveal" && !thisTrip()) { st.pick = null; save(); location.replace("#" + S.choice); return; }
    if (name === "reveal" && st.pick !== revealed) {
      revealed = st.pick; try { sessionStorage.setItem("kg-revealed", revealed); } catch (e) { /* fires again */ }
      track("quiz_reveal", Object.assign({ trip: st.pick }, measureParams(thisTrip(), st)));
    }
    if (name === "into") {
      // the deck as the visitor left it, unless the cards on offer changed (a new month brings or drops skiing)
      var deal = cards(), ids = deal.map(function (c) { return c.id; }), key = ids.join();
      if (!deck || deck.key !== key) deck = Object.assign(deckStart(ids, deckYes(deal, st)), { key: key });
    }
    draft = name === "days" ? st.days || Math.max(bandOf(st.band).days, least()) : PICK_KEY[name] ? (st[PICK_KEY[name]] || []).slice() : null;
    root.innerHTML = dots(screens[STEPS[step]]());
    // tripview.js lost on the way (one dropped request): say so; the screen still finishes (Save still works)
    if (name === "reveal") try { paintTrip(); } catch (e) { document.getElementById("tv").innerHTML = '<p class="q-error">Your days would not show. Reload the page to see them.</p>'; }
    painted(name);
    if (name === "into") {
      setupDeck();
      // after an answer, focus stays on the button just used (it names the new card), not back on the heading
      if (deck.focus) { root.querySelector('[data-act="' + deck.focus + '"]').focus({ preventScroll: true }); deck.focus = null; }
    }
  }

  // The one-time nudge on card 1 (right, then left), about 3 s. Anything the visitor does cancels it.
  var HINT = "kg-hint", hintTimer = null, hintAnims = [];
  function stopHint() { clearTimeout(hintTimer); hintAnims.forEach(function (a) { a.cancel(); }); hintAnims = []; }
  function startHint(card, yes, no) {
    var seen = false;
    try { seen = !!sessionStorage.getItem(HINT); } catch (e) { /* shows each time */ }
    if (seen || reduced || deck.idx !== 0 || !card.animate) return;
    hintTimer = setTimeout(function () {
      try { sessionStorage.setItem(HINT, "1"); } catch (e) { /* fine */ }
      // 3 s: out to one side 600 ms, hold 400, back 500; then the other side the same.
      var o = { duration: 3000 }, R = "translateX(40px) rotate(2.2deg)", L = "translateX(-40px) rotate(-2.2deg)";
      hintAnims = [
        card.animate([{ transform: "none", easing: "ease-out" }, { transform: R, offset: 0.2 }, { transform: R, offset: 0.333, easing: "ease-in-out" }, { transform: "none", offset: 0.5, easing: "ease-out" }, { transform: L, offset: 0.7 }, { transform: L, offset: 0.833, easing: "ease-in-out" }, { transform: "none" }], o),
        yes.animate([{ opacity: 0, easing: "ease-out" }, { opacity: 0.6, offset: 0.2 }, { opacity: 0.6, offset: 0.333, easing: "ease-in-out" }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], o),
        no.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5, easing: "ease-out" }, { opacity: 0.6, offset: 0.7 }, { opacity: 0.6, offset: 0.833, easing: "ease-in-out" }, { opacity: 0 }], o),
      ];
    }, 600);
  }
  function removeKeys() { if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; } }

  // A card answered: it flies off, then the next card, or the trips once the last one is done.
  function decide(yes) {
    if (busy) return;
    busy = true;
    var card = document.getElementById("card"), list = cards();
    var done = function () {
      busy = false;
      if (STEPS[stepFromHash(location.hash)] !== "into") return; // the visitor went back mid-swipe
      var r = deckAnswer(deck, list, yes, st);
      st = r.st; deck = r.deck;
      if (deck) { deck.focus = yes ? "yes" : "no"; return render(); }
      answered("into", st.into.join(",") || "none"); answered("activities", st.activities.join(",") || "none"); save();
      go(S.food);
    };
    if (reduced || !card) return done();
    card.style.transition = "transform .25s ease";
    card.style.transform = "translateX(" + (yes ? 600 : -600) + "px) rotate(" + (yes ? 25 : -25) + "deg)";
    setTimeout(done, 250);
  }

  // The top card follows a finger (or mouse) sideways; past 100 px it counts, short of that it springs back.
  function setupDeck() {
    var card = document.getElementById("card");
    var x0 = 0, dx = 0, drag = false;
    var yes = document.getElementById("stamp-yes"), no = document.getElementById("stamp-no");
    card.addEventListener("pointerdown", function (e) {
      stopHint();
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
      stopHint();
      var yes = deckKey(e);
      if (yes !== null) decide(yes);
    };
    document.addEventListener("keydown", keyHandler);
    startHint(card, yes, no);
  }
  function painted(name) {
    shown = name;
    bar.style.width = PROGRESS[name] + "%";
    bar.parentNode.setAttribute("aria-valuenow", PROGRESS[name]);
    backBtn.hidden = name === "start" || name === "done";
    document.body.classList.toggle("q-photo", !!root.querySelector(".q-brk:not(.q-brk-card)"));
    if (notice) { root.insertAdjacentHTML("afterbegin", '<p class="q-error" role="alert">' + esc(notice) + "</p>"); notice = ""; }
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    var h = root.querySelector("h1");
    if (h) h.focus({ preventScroll: true });
    if (name === "account") {
      var f = document.getElementById("q-email");
      if (f) { f.value = acct.email; f.focus({ preventScroll: true }); }
    }
    var dlg = document.getElementById("q-dialog");
    if (dlg) { dlg.showModal(); document.getElementById("q-keep").focus(); }
  }

  // The days picker: the number, the slider and the chips move together.
  function setDays(n) {
    draft = Math.max(least(), Math.min(21, n));
    document.getElementById("q-n").textContent = draft;
    document.getElementById("q-range").value = draft;
    Array.prototype.forEach.call(root.querySelectorAll(".q-chip"), function (c) {
      var on = +c.getAttribute("data-val") === draft;
      c.classList.toggle("q-on", on); c.setAttribute("aria-pressed", on);
    });
  }
  root.addEventListener("input", function (e) { if (e.target.id === "q-range") setDays(+e.target.value); });
  root.addEventListener("change", function (e) { if (e.target.id === "q-optin") acct.optIn = e.target.checked; });
  // A row photo that fails (a dead thumb) becomes the free day's pin, not an empty frame. Error events don't bubble, so this
  // listens on the way down; the CSP allows no inline onerror.
  root.addEventListener("error", function (e) { if (e.target.matches("img.tv-pic")) e.target.outerHTML = TripView.nopic; }, true);

  root.addEventListener("click", function (e) {
    if (e.target.closest("a.badge")) track("app_store_click", { trip: st.pick });
    stopHint();
    var b = e.target.closest("[data-act]");
    if (!b || g.busy()) return;
    var act = b.getAttribute("data-act"), v = b.getAttribute("data-val"), step = stepFromHash(location.hash);
    if (act === "start") { if (!started) { started = true; track("quiz_start"); } answered("start", v); if (st.start !== v) { st.end = null; allEnds = false; } st.start = v; st.pick = null; save(); loadData(); go(S.band); }
    else if (act === "finish") { answered("finish", v); st.end = v; st.pick = null; save(); go(S.break1); }
    else if (act === "other-ends") { var first = finishCards(st.start, st.days, false).behind[0]; allEnds = true; render(); root.querySelector('[data-act="finish"][data-val="' + first + '"]').focus(); }
    else if (act === "other-towns") { allTowns = true; render(); root.querySelector('[data-act="start"][data-val="' + TOWNS.filter(function (t) { return t.more; })[0].id + '"]').focus(); }
    else if (act === "band") { answered("band", v); if (st.band !== v) st.days = null; st.band = v; st.pick = null; save(); go(S.days); }
    else if (act === "fewer") setDays(draft - 1);
    else if (act === "more") setDays(draft + 1);
    else if (act === "setdays") setDays(+v);
    else if (act === "days") { answered("days", String(draft)); st.days = draft; if (st.end && minDays(st.start, st.end) > draft) st.end = null; st.pick = null; save(); go(S.finish); }
    else if (act === "next" && /^break/.test(STEPS[step])) location.replace("#" + (step + 1));
    else if (act === "yes") decide(true);
    else if (act === "no") decide(false);
    else if (act === "season") { answered("season", v); st.season = v; st.month = null; st.pick = null; save(); go(v === "unsure" ? S.pace : S.month); }
    else if (act === "month") { answered("month", v || "none"); var p = v ? v.split("-") : null; st.month = p ? { month: +p[0], year: +p[1] } : null; st.pick = null; save(); go(S.pace); }
    else if (act === "pace") { answered("pace", v); st.pace = v; st.pick = null; var far = longDrive(st.start, st.end, st.days); if (far) st.drive = 360; save(); go(far ? S.who : S.drive); }
    else if (act === "drive") { answered("drive", v); st.drive = +v; st.pick = null; save(); go(S.who); }
    else if (act === "who") { answered("who", v); st.who = v; save(); go(S.age); }
    else if (act === "age") { answered("age", v); st.age = v; save(); go(S.vibe); }
    else if (act === "toggle") {
      var at = draft.indexOf(v), on = at < 0;
      if (on) draft.push(v); else draft.splice(at, 1);
      b.classList.toggle("q-on", on); b.setAttribute("aria-pressed", on); b.querySelector(".q-chk").textContent = on ? "✓" : "";
      root.querySelector('[data-act="picked"]').textContent = draft.length ? "Next" : "Skip";
    }
    else if (act === "picked") {
      var list = VIBES;
      st[v] = list.map(function (x) { return x.id; }).filter(function (id) { return draft.indexOf(id) >= 0; }); // in list order
      answered(STEPS[step], st[v].join(",") || "none"); st.pick = null; save();
      go(S.break2);
    }
    else if (act === "food") { answered("food", v); st.food = v === "yes"; st.pick = null; save(); go(S.heard); }
    else if (act === "heard") { answered("heard", v); st.heard = v; save(); go(S.account); }
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
    else if (act === "save") doSave();
    else if (act === "again") { tv = { pick: null, view: "trip", day: 0 }; deck = null; allTowns = allEnds = false; st = blankState(); save(); session = null; acct = { mode: "create", error: "", note: "", existing: null, email: "", optIn: false }; savedMem = null; try { sessionStorage.removeItem(SAVED); } catch (e2) { /* fine */ } go(S.start); }
    else if (act === "mode") { var ef = document.getElementById("q-email"); if (ef) acct.email = ef.value; acct.mode = v; acct.error = ""; render(); }
    else if (act === "google") goGoogle();
    else if (act === "apple") goApple();
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
    savedMem = { email: email, title: title, kept: !!kept, pick: st.pick };
    try { sessionStorage.setItem(SAVED, JSON.stringify(savedMem)); } catch (e) { /* the copy in memory shows it this time */ }
    session = null;
    go(S.done);
  }

  // Every failure ends in a re-render or a re-enabled form, never a stuck disabled button.
  function fail(err) {
    var sb = document.getElementById("q-status"); if (sb) sb.textContent = "";
    // the email has a password account: back to Sign in with it filled in, message kept
    if (err && !session && (err.code === "NEED_CONFIRMATION" || err.code === "FEDERATED_USER_ID_ALREADY_LINKED")) {
      acct = { mode: "signin", error: authErrorMessage(err.code), note: "", existing: null, email: err.email || acct.email, optIn: false };
      return render();
    }
    if (err && typeof err.code === "string") { setDisabled(false); var m = authErrorMessage(err.code); setErr(m, fieldFor(err.code)); return; }
    // the sign-in ran out before the save: back to the account step to sign in again
    if (err && err.status === 401) {
      acct = { mode: "signin", error: saveErrorMessage(401), note: "", existing: null, email: session ? session.email : "", optIn: false };
      session = null; return go(S.account);
    }
    // any other failed save: the trip again with the error; its button tries again
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
    acct.error = ""; setErr("");
    run(function () { return saveFlow(fetch.bind(window), session.idToken, newBody()); }, afterSave);
    var sb = document.getElementById("q-status"); if (sb && g.busy()) sb.textContent = "Saving…"; // fail() clears it
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
      return acct.mode === "signin" ? signIn(net, email, passEl.value) : createAccount(net, email, passEl.value, document.getElementById("q-pass2").value);
    }, function (s) { afterSignIn(s, "email", acct.optIn); });
  });

  // Every sign-in ends here (email, Google, Apple): signed in, on to the trip cards. Nothing is saved until the trip's button.
  function afterSignIn(s, by, optIn) {
    session = s;
    if (s.isNew) {
      track("sign_up", { method: by });
      saveEmailOptIn(fetch.bind(window), s.idToken, s.uid, optIn).catch(function () {}); // yes or no is recorded; never awaited, never blocks
    }
    go(S.choice);
  }

  // Off to Google. The state and nonce wait in sessionStorage (the quiz answers already do); the tokens never do.
  function goGoogle() {
    var state = newToken(), nonce = newToken();
    try { sessionStorage.setItem(GOOGLE, JSON.stringify({ state: state, nonce: nonce, optIn: acct.mode === "create" && acct.optIn })); } catch (e) { return setErr(authErrorMessage("")); }
    location.assign(googleAuthUrl(location.origin, state, nonce));
  }
  // Off to Apple, the same way; Apple gets the nonce's hash (Firebase checks it against the nonce itself).
  function goApple() {
    var state = newToken(), nonce = newToken();
    try { sessionStorage.setItem(GOOGLE, JSON.stringify({ state: state, nonce: nonce, provider: "apple", optIn: acct.mode === "create" && acct.optIn })); } catch (e) { return setErr(authErrorMessage("")); }
    sha256Hex(nonce).then(function (h) { location.assign(appleAuthUrl(location.origin, state, h)); }, function () { setErr(authErrorMessage("")); });
  }
  // The visitor is back from Google or Apple: sign in with its answer, then on as for email.
  function finishGoogle() {
    var net = fetch.bind(window), r = gret, sv = gsaved, by = sv && sv.provider === "apple" ? "apple" : "google", optIn = sv && sv.optIn === true;
    gret = gsaved = null;
    var sb = document.getElementById("q-status"); if (sb) sb.textContent = "Signing in with " + (by === "apple" ? "Apple" : "Google") + "…"; // render left it empty, so the change is announced; fail() clears it
    run(function () { return completeGoogle(net, r, sv, location.origin + "/plan/"); }, function (s) { afterSignIn(s, by, optIn); });
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

  // Back from Google or Apple (and not already saved): the sign-in finishes once the answers through How did you hear are in.
  var googlePending = gfrag && !savedInfo(), answersIn = firstOpenStep(st, S.account) === S.account;
  if (googlePending && !answersIn && !(gret && gret.error === "access_denied")) notice = "Your answers were lost on the way back from " + (gsaved && gsaved.provider === "apple" ? "Apple" : "Google") + ". Answer the questions again.";
  if (st.start) loadData();
  try { render(); if (googlePending && answersIn) finishGoogle(); } catch (e) {
    root.innerHTML = '<h1>Something went wrong</h1><p>The quiz hit a problem. Reload the page, or <a href="/#trips">see the suggested trips</a>.</p>';
  }
})();
