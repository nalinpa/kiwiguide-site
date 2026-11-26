import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire(import.meta.url);
const Q = req("../public/plan/quiz.js");
const { monthsOf, startDateFor, stepFromHash, seasonOf, seasonLine, STEPS } = Q;
const data = JSON.parse(readFileSync(new URL("../public/plan/builder-data.json", import.meta.url), "utf8"));
const NOV20 = new Date(2026, 10, 20);
const at = (name) => STEPS.indexOf(name);
const full = { start: "dunedin", end: "dunedin", band: "fortnight", days: 12, season: "summer", month: { month: 0, year: 2027 }, pace: "some", drive: 240, who: "couple", age: "30-44", vibes: ["nature", "relax"], into: ["Scenic", "Walks"], food: true, activities: ["hot-pools"], heard: "google", pick: "built-dunedin-12-loop" };
const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");

test("steps in order: the owner's order (the finish after the days), a break after the finish and after the vibe; the cards ask kinds of place and activities; who's travelling and age after the driving, how did you hear about us the last question; the account before the trip cards, the trip the end (owner, 2026-11-26)", () => {
  assert.deepEqual(STEPS, ["start", "band", "days", "finish", "break1", "season", "month", "pace", "drive", "who", "age", "vibe", "break2", "into", "food", "heard", "account", "choice", "reveal"]);
  // the progress bar grows in the order asked, every step on it
  const bar = JSON.parse(src.match(/var PROGRESS = (\{[^}]*\});/)[1].replace(/(\w+):/g, '"$1":'));
  assert.deepEqual(Object.keys(bar), STEPS);
  STEPS.forEach((s, i) => { if (i) assert.ok(bar[s] >= bar[STEPS[i - 1]], s); });
  assert.deepEqual([bar.account, bar.choice, bar.reveal], [94, 97, 100]);
});

test("who's travelling, age and how did you hear about us: kept with the quiz answers (analytics) only, the trip the same; age and how you heard can be skipped (owner, 2026-11-24)", () => {
  assert.deepEqual(Q.WHO.map((w) => [w.id, w.label]), [["solo", "Solo"], ["couple", "Couple"], ["family", "Family"], ["group", "Group"]]);
  assert.deepEqual(Q.AGES.map((a) => a.label), ["18–29", "30–44", "45–59", "60+"]);
  assert.deepEqual(Q.HEARD.map((h) => h.label), ["App Store", "Google", "Instagram or TikTok", "A friend", "Other"]);
  // a skip is an answer; a bad answer drops it and everything after
  assert.equal(Q.cleanState({ ...full, age: "skip" }, NOV20).age, "skip");
  assert.equal(Q.cleanState({ ...full, heard: "skip" }, NOV20).pick, "built-dunedin-12-loop");
  const w = Q.cleanState({ ...full, who: "constructor" }, NOV20);
  assert.deepEqual([w.drive, w.who, w.age, w.vibes], [240, null, null, null]);
  const a = Q.cleanState({ ...full, age: "12" }, NOV20);
  assert.deepEqual([a.who, a.age, a.vibes], ["couple", null, null]);
  const h = Q.cleanState({ ...full, heard: "tv" }, NOV20);
  assert.deepEqual([h.food, h.heard, h.pick], [true, null, null]);
  // a reload can't land past them
  assert.equal(Q.firstOpenStep({ ...full, who: null }, at("vibe")), at("who"));
  assert.equal(Q.firstOpenStep({ ...full, age: null }, at("into")), at("age"));
  assert.equal(Q.firstOpenStep({ ...full, heard: null }, at("reveal")), at("heard"));
  // never in the builder's answers or the reveal and save events' params
  assert.deepEqual(Object.keys(Q.answersFor(full)).sort(), ["activities", "days", "drive", "end", "food", "into", "pace", "start", "vibes"]);
  assert.deepEqual(Object.keys(Q.measureParams({ kind: "built", days: [], start: "dunedin", end: "dunedin" }, full)).sort(), ["days", "drive", "end", "kind", "pace", "start"]);
  // each answer is a quiz step (analytics); the trip picked stays (the trips don't change); Skip on age and how you heard
  assert.match(src, /act === "drive"\) \{ answered\("drive", v\); st\.drive = \+v; st\.pick = null; save\(\); go\(S\.who\); \}/);
  assert.match(src, /act === "who"\) \{ answered\("who", v\); st\.who = v; save\(\); go\(S\.age\); \}/);
  assert.match(src, /act === "age"\) \{ answered\("age", v\); st\.age = v; save\(\); go\(S\.vibe\); \}/);
  assert.match(src, /act === "food"\) \{ answered\("food", v\); st\.food = v === "yes"; st\.pick = null; save\(\); go\(S\.heard\); \}/);
  assert.match(src, /act === "heard"\) \{ answered\("heard", v\); st\.heard = v; save\(\); go\(S\.account\); \}/);
  assert.match(src, /<h1 tabindex="-1">Who’s travelling\?<\/h1>/);
  assert.match(src, /<h1 tabindex="-1">How old are you\?<\/h1>/);
  assert.match(src, /<h1 tabindex="-1">How did you hear about us\?<\/h1>/);
  assert.equal((src.match(/data-act="(age|heard)" data-val="skip">Skip<\/button>/g) || []).length, 2);
});

test("start screen: Queenstown, Christchurch and Picton, then Somewhere else? (Dunedin's photo) for the rest", () => {
  assert.deepEqual(Q.TOWNS.filter((t) => !t.more).map((t) => t.id), ["queenstown", "christchurch", "picton"]);
  assert.deepEqual(Q.TOWNS.filter((t) => t.more).map((t) => t.id), ["dunedin", "nelson", "invercargill"]);
  assert.match(src, /class="q-town" data-act="other-towns"><img src="' \+ more\[0\]\.img \+ '"/);
  assert.match(src, /<strong>Somewhere else\?<\/strong>/);
});

test("how many days: 2 to 21, asked before the finish (owner, 2026-11-23)", () => {
  assert.match(src, /<input type="range" class="q-range" id="q-range" min="' \+ n \+ '" max="21"/);
  assert.match(src, /"Pick anything from " \+ n \+ " to 21\.<\/p>"/);
  assert.match(src, /draft = Math\.max\(least\(\), Math\.min\(21, n\)\);/);
  assert.match(src, /CHIPS\.filter\(function \(c\) \{ return c >= n; \}\)/);
  assert.equal(Q.cleanState({ ...full, days: 2 }, NOV20).days, 2);
  // a saved finish the days can't reach is dropped (and every answer after it); the days and the band stay
  const far = Q.cleanState({ ...full, start: "nelson", end: "dunedin", band: "fortnight", days: 10 }, NOV20);
  assert.equal(far.band, "fortnight"); assert.equal(far.days, 10); assert.equal(far.end, null); assert.equal(far.season, null);
  assert.equal(Q.cleanState({ ...full, start: "nelson", end: "dunedin", band: "ten", days: 11 }, NOV20).end, "dunedin");
  assert.match(src, /BANDS\.filter\(function \(b\) \{ return b\.days >= least\(\); \}\)/);
  // every start can do 2 days (its shortest finish), so the picker always starts at the table's lowest number
  for (const t of Q.TOWNS) assert.equal(Q.leastFrom(t.id), Math.min(...Object.values(Q.MIN_DAYS[t.id])), t.id);
  assert.match(src, /function least\(\) \{ return leastFrom\(st\.start\); \}/);
});

test("where does your trip finish: only the towns the days can reach; the start first, ringed, Finish back in X; Somewhere else? for the rest", () => {
  assert.match(src, /<h1 tabindex="-1">Where does your trip finish\?<\/h1>/);
  assert.match(src, /\(f\.home \? card\(home, "Finish back in " \+ home\.name, "A loop, back where you started", " q-home"\) : ""\)/);
  assert.match(src, /data-act="other-ends"/);
  assert.deepEqual(Q.TOWNS.map((t) => t.out), ["Fly out of Queenstown", "Fly out of Christchurch", "Take the ferry back to Wellington", "Fly out of Dunedin", "Fly out of Nelson", "Fly out of Invercargill"]);
  // a new start asks the finish again; fewer days than the finish needs ask it again; the finish leads to the break
  assert.match(src, /if \(st\.start !== v\) \{ st\.end = null; allEnds = false; \}/);
  assert.match(src, /st\.days = draft; if \(st\.end && minDays\(st\.start, st\.end\) > draft\) st\.end = null; st\.pick = null; save\(\); go\(S\.finish\);/);
  assert.match(src, /act === "finish"\) \{ answered\("finish", v\); st\.end = v; st\.pick = null; save\(\); go\(S\.break1\); \}/);
  assert.deepEqual(Q.answersFor(full).end, "dunedin");
  // a saved finish that is no town is dropped (an object's own "constructor" would otherwise pass for one)
  assert.equal(Q.cleanState({ ...full, end: "nowhere" }, NOV20).end, null);
  assert.equal(Q.cleanState({ ...full, end: "constructor" }, NOV20).end, null);
  assert.equal(Q.cleanState({ ...full, end: "constructor" }, NOV20).days, 12);
  // the start leads to the length; the two length screens never read the finish (it isn't chosen yet)
  assert.match(src, /st\.start = v; st\.pick = null; save\(\); loadData\(\); go\(S\.band\); \}/);
  assert.match(src, /'<p class="q-kicker">From ' \+ town\(st\.start\)\.name \+ '<\/p><h1 tabindex="-1">How long have you got\?<\/h1>'/);
  assert.match(src, /'<p class="q-kicker">' \+ esc\(bandOf\(st\.band\)\.label\) \+ '<\/p><h1 tabindex="-1">How many days\?<\/h1>/);
  assert.match(src, /'<p class="q-kicker">' \+ days\(st\.days\) \+ " from " \+ home\.name \+ '<\/p><h1 tabindex="-1">Where does your trip finish\?<\/h1>'/);
  // the progress bar grows in the order asked
  assert.match(src, /var PROGRESS = \{ start: 5, band: 10, days: 15, finish: 20, break1: 25, season: 30,/);
  // the towns on offer, in the towns' order
  assert.deepEqual(Q.endsFor("queenstown", 3), ["queenstown", "dunedin", "invercargill"]);
  assert.deepEqual(Q.endsFor("queenstown", 4), ["queenstown", "christchurch", "dunedin", "invercargill"]);
  assert.deepEqual(Q.endsFor("invercargill", 2), ["queenstown", "dunedin", "invercargill"], "Queenstown, and back to Invercargill, in 2 by the day to Te Anau");
  assert.deepEqual(Q.endsFor("invercargill", 7), ["queenstown", "christchurch", "picton", "dunedin", "nelson", "invercargill"]);
  assert.deepEqual(Q.endsFor("nelson", 2), ["nelson"]);
  // never an empty screen, and never a town the days can't reach
  for (const t of Q.TOWNS) for (let d = 2; d <= 21; d++) {
    const ends = Q.endsFor(t.id, d);
    assert.ok(ends.length >= 1, t.id + " in " + d + " days");
    for (const e of Q.TOWNS) assert.equal(ends.includes(e.id), Q.minDays(t.id, e.id) <= d, t.id + " to " + e.id + " in " + d);
  }
  assert.equal(Q.endsFor("queenstown", 21).length, 6);
  // the screen: the loop card, the town cards, the towns behind Somewhere else?; a town the days can't reach is left off
  const F = Q.finishCards;
  assert.deepEqual(F("queenstown", 7, false), { home: true, towns: ["christchurch", "picton"], behind: ["dunedin", "nelson", "invercargill"] });
  assert.deepEqual(F("queenstown", 7, true), { home: true, towns: ["christchurch", "picton", "dunedin", "nelson", "invercargill"], behind: [] });
  assert.deepEqual(F("queenstown", 4, false), { home: true, towns: ["christchurch", "dunedin", "invercargill"], behind: [] }, "four cards: nothing hidden");
  assert.deepEqual(F("queenstown", 3, false), { home: true, towns: ["dunedin", "invercargill"], behind: [] });
  assert.deepEqual(F("invercargill", 2, false), { home: true, towns: ["queenstown", "dunedin"], behind: [] });
  assert.deepEqual(F("dunedin", 21, false), { home: true, towns: ["queenstown", "christchurch", "picton"], behind: ["nelson", "invercargill"] });
  assert.deepEqual(F("dunedin", 4, false), { home: true, towns: ["queenstown", "christchurch", "picton", "nelson"], behind: [] }, "one extra town is a card, not a Somewhere else? of one");
  for (const t of Q.TOWNS) for (let d = 2; d <= 21; d++) for (const open of [false, true]) {
    const f = F(t.id, d, open), ends = Q.endsFor(t.id, d), why = t.id + " " + d + " " + open;
    assert.equal(f.home, ends.includes(t.id), why);
    assert.deepEqual([...f.towns, ...f.behind].sort(), ends.filter((e) => e !== t.id).sort(), "every reachable town once: " + why);
    assert.deepEqual(Object.keys(f), ["home", "towns", "behind"], why);
    assert.ok(f.behind.length !== 1 && (!open || !f.behind.length), why);
    assert.ok(f.behind.every((e) => Q.TOWNS.find((x) => x.id === e).more), why);
    assert.ok((f.home ? 1 : 0) + f.towns.length + (f.behind.length ? 1 : 0) >= 1, "never an empty screen: " + why);
    // Somewhere else? only when every reachable town as a card would run past four; with it, at most five cards
    // (the loop, three main towns and Somewhere else? from Dunedin, Nelson or Invercargill)
    const cards = (f.home ? 1 : 0) + f.towns.length + (f.behind.length ? 1 : 0);
    assert.ok(open || cards <= 5, why);
    if (f.behind.length) assert.ok(ends.length > 4, why);
    if (!open && !f.behind.length) assert.ok(ends.length <= 4 || f.towns.filter((e) => Q.TOWNS.find((x) => x.id === e).more).length === 1, why);
  }
  // the screen draws what finishCards says and no line about the towns left off (owner, 2026-11-23); Somewhere else? opens on its first town
  assert.match(src, /f = finishCards\(st\.start, st\.days, allEnds \|\| !!\(st\.end && st\.end !== st\.start && town\(st\.end\)\.more\)\);/);
  assert.match(src, /f\.towns\.map\(function \(id\) \{ var t = town\(id\); return card\(t, t\.name, t\.out\); \}\)\.join\(""\)/);
  assert.match(src, /\(!f\.behind\.length \? "" : '<button type="button" class="q-town" data-act="other-ends"><img src="' \+ town\(f\.behind\[0\]\)\.img/);
  assert.doesNotMatch(src, /Needs more than/);
  assert.match(src, /esc\(and\(f\.behind\.map\(function \(id\) \{ return town\(id\)\.name; \}\), "or"\)\) \+ "<\/span><\/span><\/button>"\);\n    \},/);
  assert.match(src, /act === "other-ends"\) \{ var first = finishCards\(st\.start, st\.days, false\)\.behind\[0\]; allEnds = true; render\(\);/);
});

test("fewest days: every start and finish, true to the builder (it gets a trip at that length, and none a day shorter)", () => {
  const B = req("../public/plan/builder.js"), pack = req("../public/plan/pack.js");
  const ids = Q.TOWNS.map((t) => t.id);
  const tries = [{ drive: 120, pace: "easy", food: false, vibes: [], into: [], activities: [] }, { drive: 360, pace: "hikes", food: true, vibes: ["nature"], into: ["Scenic"], activities: ["hot-pools"] }];
  // a trip comes back, and none of its days is empty past a quarter of the trip (Dunedin and back in 3 days was two empty days)
  const trips = (start, end, days) => tries.every((a) => {
    const os = B.buildTrips(data, pack, { start, end, days, ...a });
    return os.length > 0 && os.every((o) => o.days.filter((d) => d.free).length <= Math.floor(days / 4));
  });
  for (const start of ids) for (const end of ids) {
    const n = Q.minDays(start, end);
    assert.ok(n >= 2 && n <= 21, start + " to " + end);
    for (const d of [n, n + 1, 21]) if (d <= 21) assert.ok(trips(start, end, d), start + " to " + end + " in " + d + " days");
    if (n > 2) assert.ok(!trips(start, end, n - 1), start + " to " + end + " in " + (n - 1) + " days should not work");
  }
});

test("no driving question where the start and the finish are far apart for the days: Happy to drive, 6 hours (owner, 2026-11-24)", () => {
  // "dont ask them about it on those short long distance trips": the drive between the two towns' hubs, spread over the days,
  // over 2 hours a day
  const pack = req("../public/plan/pack.js"), look = (id) => data.places[id];
  for (const s of Q.TOWNS) for (const e of Q.TOWNS) for (let d = Q.minDays(s.id, e.id); d <= 21; d++) {
    const mins = s.id === e.id ? 0 : pack.getLeg(pack.hubs[s.id], pack.hubs[e.id], look).slots * 30;
    assert.equal(Q.longDrive(s.id, e.id, d), mins / d > 120, `${s.id} to ${e.id} in ${d} days: ${mins} minutes`);
  }
  assert.deepEqual(Q.LONG_DRIVES, { christchurch: { picton: 3 }, picton: { christchurch: 3 }, dunedin: { christchurch: 3, picton: 5, nelson: 5 }, invercargill: { christchurch: 4, picton: 6, nelson: 7 } });
  // after How active?: straight to Who's travelling with Happy to drive set, and its kicker the pace, not a driving answer
  assert.match(src, /act === "pace"\) \{ answered\("pace", v\); st\.pace = v; st\.pick = null; var far = longDrive\(st\.start, st\.end, st\.days\); if \(far\) st\.drive = 360; save\(\); go\(far \? S\.who : S\.drive\); \}/);
  assert.match(src, /esc\(longDrive\(st\.start, st\.end, st\.days\) \? labelOf\(PACES, st\.pace\) : DRIVES\.filter\(function \(d\) \{ return d\.id === st\.drive; \}\)\[0\]\.hint\)/);
});

test("how active: Easy, Some walking, Lots of walking", () => {
  assert.deepEqual(Q.PACES.map((p) => p.label), ["Easy", "Some walking", "Lots of walking"]);
});

test("how long: the old rough lengths, each setting the days picker to its top", () => {
  assert.deepEqual(Q.BANDS.map((b) => [b.label, b.hint, b.days]), [
    ["A long weekend", "Three or four days", 4],
    ["About a week", "Five to seven days", 7],
    ["Ten days or so", "A good chunk of the island", 10],
    ["A couple of weeks", "Time to slow down", 14],
    ["Three weeks", "The whole island", 21],
  ]);
  // the days picker opens on the band's number, or the visitor's own number once they have set one
  assert.match(src, /draft = name === "days" \? st\.days \|\| Math\.max\(bandOf\(st\.band\)\.days, least\(\)\) :/);
  // a new band sets the picker again; the same band keeps the visitor's number
  assert.match(src, /act === "band"\) \{ answered\("band", v\); if \(st\.band !== v\) st\.days = null;/);
});

test("back never lands on a photo break, in the quiz's back button or the browser's", () => {
  assert.equal(Q.backStep(at("season")), at("finish"));
  assert.equal(Q.backStep(at("into")), at("vibe"));
  assert.equal(Q.backStep(at("break1")), at("finish"));
  assert.equal(Q.backStep(at("break2")), at("vibe"));
  assert.equal(Q.backStep(at("days")), at("band"));
  assert.equal(Q.backStep(at("band")), at("start"));
  assert.equal(Q.backStep(at("finish")), at("days"));
  assert.equal(Q.backStep(0), 0);
  for (let s = 0; s < STEPS.length; s++) assert.doesNotMatch(STEPS[Q.backStep(s)], /^break/, STEPS[s]);
  assert.match(src, /return backStep\(step\);/);
  // a break's Next takes the break's own place in the history, so the browser's back skips it too
  // and only from the break itself, so a double tap can't skip the question after it
  assert.match(src, /act === "next" && \/\^break\/\.test\(STEPS\[step\]\)\) location\.replace\("#" \+ \(step \+ 1\)\);/);
});

test("cleanState old shape: today's saved quiz gives a clean state at the first unanswered step", () => {
  const old = { start: "queenstown", band: "weekend", idx: 8, liked: ["shotover-jet"], season: "summer", month: { month: 0, year: 2027 }, pick: "queenstown-weekend" };
  let c;
  assert.doesNotThrow(() => { c = Q.cleanState(old, NOV20); });
  assert.equal(c.start, "queenstown");
  assert.equal(c.end, null);
  assert.equal(c.band, "weekend", "the old quiz's lengths are today's");
  assert.equal(c.days, null);
  assert.equal(c.season, null);
  assert.equal(c.pick, null);
  assert.equal(Q.firstOpenStep(c, at("reveal")), at("days"));
  assert.equal(Q.cleanState("junk", NOV20).start, null);
  assert.equal(Q.cleanState({ start: "constructor" }, NOV20).start, null);
});

test("cleanState: a full state passes; a bad answer drops it and everything after", () => {
  assert.deepEqual(Q.cleanState(full, NOV20), full);
  const n = Q.cleanState({ ...full, band: "month" }, NOV20);
  assert.equal(n.band, null); assert.equal(n.days, null); assert.equal(n.start, "dunedin");
  assert.equal(Q.cleanState({ ...full, band: "short" }, NOV20).band, null, "'A day or two' is not an answer");
  const a = Q.cleanState({ ...full, days: 1 }, NOV20);
  assert.equal(a.days, null); assert.equal(a.pace, null); assert.equal(a.start, "dunedin");
  const b = Q.cleanState({ ...full, drive: 999 }, NOV20);
  assert.equal(b.drive, null); assert.equal(b.pace, "some"); assert.equal(b.vibes, null);
  const c = Q.cleanState({ ...full, vibes: ["party"] }, NOV20);
  assert.equal(c.vibes, null); assert.equal(c.drive, 240);
  assert.equal(Q.cleanState({ ...full, into: ["Food"] }, NOV20).into, null);
  assert.equal(Q.cleanState({ ...full, food: "yes" }, NOV20).food, null);
  assert.equal(Q.cleanState({ ...full, activities: ["toString"] }, NOV20).activities, null);
  assert.equal(Q.cleanState({ ...full, month: { month: 5, year: 2027 } }, NOV20).month, null);
  const u = Q.cleanState({ ...full, season: "unsure", month: null }, NOV20);
  assert.equal(u.season, "unsure"); assert.equal(u.pace, "some");
});

test("firstOpenStep: no landing past a missing answer; the month only for a season", () => {
  const st = Q.cleanState(full, NOV20);
  assert.equal(Q.firstOpenStep(st, at("account")), at("account"));
  assert.equal(Q.firstOpenStep({ ...st, pick: null }, at("account")), at("account"), "the account comes before the trip is picked");
  assert.equal(Q.firstOpenStep({ ...st, heard: null }, at("account")), at("heard"));
  assert.equal(Q.firstOpenStep({ ...st, vibes: null }, at("into")), at("vibe"));
  assert.equal(Q.firstOpenStep({ ...st, vibes: null }, at("break2")), at("vibe"));
  assert.equal(Q.firstOpenStep({ ...st, food: null }, at("choice")), at("food"));
  assert.equal(Q.firstOpenStep({ ...st, activities: null }, at("food")), at("into"), "the cards answer kinds of place and activities together");
  assert.equal(Q.firstOpenStep({ ...st, into: null }, at("choice")), at("into"));
  assert.equal(Q.firstOpenStep({ ...st, season: "unsure", month: null }, at("month")), at("season"));
  assert.equal(Q.firstOpenStep({ ...st, season: "unsure", month: null }, at("pace")), at("pace"));
  assert.equal(Q.firstOpenStep({ ...st, pick: null }, at("reveal")), at("choice"));
  assert.equal(Q.firstOpenStep({ ...st, start: null }, at("days")), 0);
  assert.equal(Q.firstOpenStep({ ...st, band: null }, at("days")), at("band"));
  assert.equal(Q.firstOpenStep({ ...st, end: null }, at("break1")), at("finish"));
  assert.equal(Q.firstOpenStep({ ...st, end: null }, at("season")), at("finish"));
  assert.equal(Q.firstOpenStep({ ...st, end: null }, at("days")), at("days"), "the finish is not asked for before the days");
  assert.equal(Q.firstOpenStep({ ...st, days: null }, at("break1")), at("days"));
  assert.equal(Q.firstOpenStep(st, at("break1")), at("break1"));
});

test("activitiesFor: skiing only for June to October starts; only what the data has", () => {
  const ids = (d, m) => Q.activitiesFor(d, m).map((a) => a.id);
  const fake = { places: { a: { activities: ["skiing"] }, b: { activities: ["wine"] }, c: { activities: ["surfing"] } } };
  assert.deepEqual(ids(fake, 6), ["skiing", "wine"]);
  assert.deepEqual(ids(fake, 9), ["skiing", "wine"]);
  assert.deepEqual(ids(fake, 0), ["wine"]);
  assert.deepEqual(ids(fake, 4), ["wine"]);
  assert.deepEqual(ids(fake, 10), ["wine"]);
  const real = ids(data, 0);
  assert.ok(real.includes("hot-pools") && !real.includes("skiing"));
  for (const id of real) assert.ok(Object.values(data.places).some((p) => p.activities.includes(id)), id);
  for (const a of Q.activitiesFor(data, 0)) assert.ok(a.label && a.hint, a.id);
});

test("revealState: loading, error, then the builder's options", () => {
  const ans = Q.answersFor(full);
  assert.equal(Q.revealState({ status: "loading" }, ans, () => assert.fail()), "loading");
  assert.equal(Q.revealState({ status: "error" }, ans, () => assert.fail()), "error");
  const seen = [];
  const out = Q.revealState({ status: "ready", data: "D", pack: "P" }, ans, (d, p, a) => { seen.push([d, p, a]); return [{ key: "x" }]; });
  assert.deepEqual(out, [{ key: "x" }]);
  assert.deepEqual(seen, [["D", "P", ans]]);
  assert.deepEqual(ans, { start: "dunedin", end: "dunedin", days: 12, pace: "some", drive: 240, vibes: ["nature", "relax"], into: ["Scenic", "Walks"], food: true, activities: ["hot-pools"] });
});

test("breakLine: the start town and days, then the vibe's photo", () => {
  const b1 = Q.breakLine(1, { start: "dunedin", days: 12 });
  assert.equal(b1.line, "Dunedin, 12 days. A southern city with real character and a wild peninsula where albatross, penguins and seals live just out of town.");
  assert.match(b1.img, /^https:\/\/api\.blacksands\.app\/images\/southislandguide\//);
  assert.equal(b1.credit, "");
  // the owner's lines (2026-11-23), after the town and the days (no "Good pick.": owner, 2026-11-23)
  const want = {
      "queenstown": "Lake and mountains in every direction and more adventure than you could pack into a month.",
      "christchurch": "A garden city with fresh energy, great food and a lively bar scene, and the beach and the Port Hills both close by.",
      "picton": "A laid-back harbour town at the edge of the Marlborough Sounds with boat trips, bush walks and wineries close by.",
      "dunedin": "A southern city with real character and a wild peninsula where albatross, penguins and seals live just out of town.",
      "nelson": "The sunniest spot in the country with golden beaches and Abel Tasman a short drive away.",
      "invercargill": "Friendly and unhurried and your way in to Bluff, the Catlins and the ferry across to Stewart Island."
  };
  for (const [t, line] of Object.entries(want)) {
    const b = Q.breakLine(1, { start: t, days: 7 });
    assert.ok(b.img, t);
    assert.equal(b.line, Q.TOWNS.find((x) => x.id === t).name + ", 7 days. " + line, t);
  }
  const photo = (vibes) => Q.breakLine(2, { vibes }).img;
  assert.match(photo(["adventure"]), /photo-shotover-jet-/);
  assert.match(photo(["nature"]), /photo-diamond-lake-/);
  assert.match(photo(["relax"]), /photo-gore-bay-/);
  assert.match(photo(["sightseeing"]), /photo-pukaki-/);
  assert.match(photo(["relax", "nature"]), /photo-diamond-lake-/);
  const b2 = Q.breakLine(2, { vibes: ["relax"] });
  assert.equal(b2.line, "Over 500 places on the island. Picking the ones that fit you.");
  assert.match(b2.credit, /^Photo: .*Michal Klajban, CC BY-SA 4\.0/);
  assert.ok(Q.breakLine(2, { vibes: [] }).credit);
});

test("measure params: kind, days, start, end, pace, drive, and nothing typed", () => {
  const option = { kind: "built", key: "built-dunedin-12-oneway", label: "South Island in 12 Days", start: "dunedin", end: "christchurch", days: new Array(12).fill({ items: [] }), missing: [] };
  const p = Q.measureParams(option, { ...full, email: "a@b.c" });
  assert.deepEqual(p, { kind: "built", days: 12, start: "dunedin", end: "christchurch", pace: "some", drive: 240 });
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.match(src, /track\("quiz_reveal", Object\.assign\(\{ trip: [^)]*\}, measureParams\(/);
  assert.equal((src.match(/track\("trip_saved", Object\.assign\(\{ trip: st\.pick, replaced: (true|false) \}, measureParams\(/g) || []).length, 2);
});

test("summaryLine: the visitor's own answers, and no 'liked' count", () => {
  const built = { kind: "built" }, sugg = { kind: "suggested" };
  const st = { ...full, vibes: ["relax", "nature"] };
  assert.equal(Q.summaryLine(built, st), "Built for you: some walking, up to 4 hours of driving a day, relax and nature, food tips, hot pools.");
  assert.equal(Q.summaryLine(sugg, { ...st, vibes: [], food: false, activities: [], drive: 120, pace: "easy" }), "Hand-checked trip: easy, up to 2 hours of driving a day, no food tips.");
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.ok(!/You liked|you’ll like|q-liked/.test(src), "no 'liked' marks left on the reveal");
});

test("load retry: an error goes back to idle so the load runs again; the error screen offers it", () => {
  assert.deepEqual(Q.retryLoad({ status: "error" }), { status: "idle" });
  const loading = { status: "loading" }, ready = { status: "ready", data: {} };
  assert.equal(Q.retryLoad(loading), loading);
  assert.equal(Q.retryLoad(ready), ready);
  assert.match(Q.waitScreen("error"), /<button type="button"[^>]*data-act="reload"[^>]*>Try again<\/button>/);
  assert.match(Q.waitScreen("error"), /href="\/#trips"/);
  assert.doesNotMatch(Q.waitScreen("loading"), /data-act="reload"/);
});

test("activities: no surfing or mountain biking until the owner has tracked them (2026-11-23)", () => {
  assert.deepEqual(Q.ACTIVITIES.map((a) => a.id), ["skiing", "hot-pools", "kayaking", "wildlife", "stargazing", "wine"]);
});

test("the cards: every kind of place, then each activity the data has, mixed; a yes answers its kind, its activity or both", () => {
  const cards = Q.cardsFor(data, 0);
  assert.deepEqual(cards.map((c) => c.id), ["Scenic", "Walks", "Nature", "Water", "hot-pools", "Culture", "kayaking", "Attractions", "stargazing", "Adventure", "wine"]);
  const shown = new Set(Q.TOWNS.map((t) => t.img));
  for (const c of cards) {
    const p = data.places[c.site];
    assert.ok(p, c.id + ": its photo is a place in the data");
    if (c.into) assert.ok(p.category.includes(c.into), c.id + ": the photo's place is that kind of place");
    if (c.act) assert.ok(p.activities.includes(c.act), c.id + ": the photo's place has " + c.act);
    assert.match(c.img, /^https:\/\/api\.blacksands\.app\/images\/southislandguide\/[0-9a-f-]+\.webp$/, c.id);
    assert.notEqual(c.img, p.thumb, c.id + ": the full photo, not the 400px thumb");
    assert.ok(!shown.has(c.img), c.id + ": a photo the quiz shows nowhere else");
    shown.add(c.img);
    assert.ok(c.alt && c.credit && c.label && c.hint, c.id);
  }
  // Nature's whale also says yes to wildlife: one card, not two
  assert.deepEqual(cards.filter((c) => c.act === "wildlife").map((c) => c.id), ["Nature"]);
  // every activity on offer, any month, has a card (a ski field tagged one day needs its own)
  for (const m of [0, 6]) for (const a of Q.activitiesFor(data, m)) assert.ok(Q.cardsFor(data, m).some((c) => c.act === a.id), a.id);
  assert.deepEqual(Q.deckAnswers(cards, ["wine", "Nature", "Culture"]), { into: ["Nature", "Culture"], activities: ["wildlife", "wine"] });
  assert.deepEqual(Q.deckAnswers(cards, []), { into: [], activities: [] });
  assert.deepEqual(Q.deckYes(cards, { into: ["Culture", "Nature"], activities: ["wildlife", "wine"] }), ["Nature", "Culture", "wine"]);
  assert.equal(Q.deckYes(cards, { into: null, activities: null }), null);
  // an activity the data lacks: its card goes, and Nature's whale answers Nature only
  const none = { places: { x: { activities: [] } } };
  assert.deepEqual(Q.cardsFor(none, 0).map((c) => c.id), ["Scenic", "Walks", "Nature", "Water", "Culture", "Attractions", "Adventure"]);
  assert.deepEqual(Q.deckAnswers(Q.cardsFor(none, 0), ["Nature"]), { into: ["Nature"], activities: [] });
});

test("the cards: a swipe deck headed What are you into?, the one screen that asks it", () => {
  assert.equal((src.match(/>What are you into\?</g) || []).length, 1, "one screen asks it: the cards");
  assert.match(src, /<h1 tabindex="-1">What are you into\?<\/h1>/);
  assert.match(src, /data-act="no" aria-label="No, skip /);
  assert.match(src, /data-act="yes" aria-label="Yes, add /);
  assert.match(src, /var yes = deckKey\(e\);\s*if \(yes !== null\) decide\(yes\);/, "the keyboard answers a card through deckKey");
  assert.match(src, /aria-describedby="q-card-n q-card-line"/, "each button reads out the card's count and line");
  assert.match(src, /if \(deck\) \{ deck\.focus = yes \? "yes" : "no"; return render\(\); \}/, "the next card keeps focus on the button just used");
  assert.match(src, /<span class="q-keys">Drag the card, or press → for yes and ← for no\.<\/span>/, "the arrow keys are named");
  assert.match(src, /prefers-reduced-motion: reduce/);
});

test("deckKey: the right arrow says yes, the left no; a held key's repeats and keys with a modifier answer nothing", () => {
  assert.equal(Q.deckKey({ key: "ArrowRight" }), true);
  assert.equal(Q.deckKey({ key: "ArrowLeft" }), false);
  assert.equal(Q.deckKey({ key: "ArrowRight", repeat: true }), null);
  assert.equal(Q.deckKey({ key: "ArrowLeft", repeat: true }), null);
  assert.equal(Q.deckKey({ key: "ArrowRight", metaKey: true }), null);
  assert.equal(Q.deckKey({ key: "Enter" }), null);
});

test("deckAnswer: a yes is kept and a no isn't; the last card puts the answers in the state and drops the picked trip", () => {
  const cards = Q.cardsFor(data, 0), st = { ...full, into: null, activities: null, pick: "x" };
  let r = Q.deckAnswer({ idx: 0, yes: [], key: "k" }, cards, true, st);
  assert.deepEqual(r.deck, { idx: 1, yes: ["Scenic"], key: "k" });
  assert.equal(r.st, st, "nothing saved before the last card");
  r = Q.deckAnswer(r.deck, cards, false, st);
  assert.deepEqual(r.deck, { idx: 2, yes: ["Scenic"], key: "k" });
  r = Q.deckAnswer({ idx: cards.length - 1, yes: ["Scenic", "Nature"], key: "k" }, cards, true, st);
  assert.equal(r.deck, null);
  assert.deepEqual([r.st.into, r.st.activities, r.st.pick], [["Scenic", "Nature"], ["wildlife", "wine"], null]);
  assert.equal(st.pick, "x", "the state passed in stays as it was");
  assert.match(src, /var r = deckAnswer\(deck, list, yes, st\);\s*st = r\.st; deck = r\.deck;/, "the page answers a card through deckAnswer");
});

test("deckStart: a new deck opens on card 1; back to a finished one shows its last card, that card's yes taken back", () => {
  const ids = ["hot-pools", "kayaking", "wine"];
  assert.deepEqual(Q.deckStart(ids, null), { idx: 0, yes: [] });
  assert.deepEqual(Q.deckStart(ids, ["hot-pools", "wine"]), { idx: 2, yes: ["hot-pools"] });
  assert.deepEqual(Q.deckStart(ids, ["kayaking"]), { idx: 2, yes: ["kayaking"] });
  assert.deepEqual(Q.deckStart(ids, ["skiing", "wine"]), { idx: 2, yes: [] }, "one no longer offered drops out");
  assert.deepEqual(Q.deckStart(ids, []), { idx: 2, yes: [] });
});

// The account before the trip (owner, 2026-11-26): docs/plans/website-signup-first.md in the app repo.
const screen = (name, next) => src.slice(src.indexOf("    " + name + ": function"), src.indexOf("    " + next + ": function") > 0 ? src.indexOf("    " + next + ": function") : src.indexOf("var PICK_KEY"));
const renderSrc = src.slice(src.indexOf("  function render() {"), src.indexOf("  // The one-time nudge"));

test("guard: no trip cards or trip without a sign-in or a save; the account step moves on once signed in or saved", () => {
  // account: saved already, the trip; signed in, the cards
  assert.match(renderSrc, /if \(name === "account" && \(saved \|\| session\)\) \{ location\.replace\("#" \+ \(saved \? S\.reveal : S\.choice\)\); return; \}/);
  // choice with no session, and reveal with nothing saved: the account (no session) or the cards (a session, nothing saved yet)
  assert.match(renderSrc, /if \(\(name === "choice" && !session\) \|\| \(name === "reveal" && !saved\)\) \{ location\.replace\("#" \+ \(session \? S\.choice : S\.account\)\); return; \}/);
  assert.match(renderSrc, /, saved = savedInfo\(\),/);
  // after the missing-answer check, before the data loads
  const open = renderSrc.indexOf("if (ok !== step)"), guard = renderSrc.indexOf('if (name === "account" && (saved'), data = renderSrc.indexOf("if (NEEDS_DATA[name]");
  assert.ok(open > 0 && open < guard && guard < data);
  // the saved info is for the trip picked: a new pick (answers changed) is not saved
  assert.match(src, /function savedInfo\(\) \{[^\n]*d\.pick === st\.pick/);
  assert.match(src, /var NEEDS_DATA = \{ into: 1, choice: 1, reveal: 1 \};/);
  assert.ok(!/name === "done"|S\.done|done: function/.test(src), "no done screen");
  assert.ok(!STEPS.includes("done"));
});

test("back: from the trip cards while signed in, the last question; none on the trip", () => {
  assert.equal(Q.backStep(at("choice")), at("account"));
  assert.match(src, /function prevStep\(step\) \{\s*var name = STEPS\[step\];\s*if \(name === "choice" && session\) return S\.heard;/);
  assert.match(src, /backBtn\.hidden = name === "start" \|\| name === "reveal";/);
  assert.ok(!/name === "reveal"\) \{ var o = options\(\)/.test(src), "no back from the reveal");
});

test("single option: the choice step saves it on its own, once, and not again after an error", () => {
  assert.match(renderSrc, /if \(name === "choice"\) \{ var list = options\(\); if \(list\.length === 1 && session && !g\.busy\(\) && !acct\.error && !acct\.note\) \{ st\.pick = list\[0\]\.key; save\(\); auto = true; \} \}/);
  assert.match(renderSrc, /painted\(name\);\s*if \(auto\) doSave\(\);/);
  // picking a card saves it; the wait is said while it runs
  assert.match(src, /act === "pick"\) \{ answered\("choice", v\); st\.pick = v; save\(\); doSave\(\); \}/);
  assert.match(src, /function doSave\(\) \{[^]*?Building your trip…[^]*?\n  \}/);
  const choice = screen("choice", "reveal");
  assert.match(choice, /list\.length === 1 \? "1 trip fits " : list\.length \+ " trips fit "/);
  // the error above the cards (not with the dialog, which has its own), the Replace/Keep dialog on a pick
  assert.match(choice, /esc\(acct\.error\)/);
  assert.match(choice, /data-act="replace">Replace it<\/button>/);
  assert.ok(choice.indexOf("q-status") > 0 && choice.indexOf("q-status") < choice.indexOf("list.map("), "status and error above the cards");
  assert.match(src, /var dlg = document\.getElementById\("q-dialog"\);\s*if \(dlg\) \{ dlg\.showModal\(\); document\.getElementById\("q-keep"\)\.focus\(\); \}/);
  // a 401 on save: signed out, the account step in sign in mode; other save errors stay on the cards
  assert.match(src, /session = null; return go\(S\.account\);/);
  assert.match(src, /if \(session\) \{ acct\.error = [^\n]*return render\(\); \}/);
  assert.equal((src.match(/saveFlow\(/g) || []).length, 1, "only the pick saves");
  assert.ok(!/act === "retry"|act === "save"/.test(src));
});

test("account screen: the owner's framing, sign-in only (no save), then the trip cards", () => {
  const acc = screen("account", "nothing");
  assert.ok(acc.includes(`'<p class="q-kicker">Last step</p>'`));
  assert.ok(acc.includes(`"Create your free account and we'll build your trip"`));
  assert.ok(acc.includes(`"Sign in and we'll build your trip"`));
  assert.ok(acc.includes(`"It'll be waiting in the Kiwi Guide app when you sign in."`));
  assert.ok(!acc.includes("thisTrip") && !acc.includes("session") && !acc.includes("q-dialog"), "no trip, no Saving to, no dialog");
  assert.ok(!src.includes("Save your trip") && !src.includes("Save this trip"));
  // every sign-in ends in afterSignIn: the session, sign_up for a new account, the cards
  assert.match(src, /function afterSignIn\(s, by\) \{\s*session = s;\s*acct\.error = acct\.note = "";[^\n]*\s*if \(s\.isNew\) track\("sign_up", \{ method: by \}\);\s*go\(S\.choice\);\s*\}/);
  assert.match(src, /\}, function \(s\) \{ afterSignIn\(s, "email"\); \}\);/);
  assert.match(src, /\}, function \(s\) \{ afterSignIn\(s, by\); \}\);/);
  assert.equal((src.match(/track\("sign_up"/g) || []).length, 1);
  // the email box's answer, for Task 3: on every acct, false to start
  const accts = src.match(/acct = \{[^}]*\}/g);
  assert.ok(accts.length >= 4 && accts.every((a) => a.includes("optIn: false")), accts.join("\n"));
  // back from Google or Apple: signs in once the answers through How did you hear are in; no wait on the data or a pick
  assert.match(src, /answersIn = firstOpenStep\(st, S\.account\) === S\.account/);
  assert.match(src, /render\(\); if \(googlePending && answersIn\) finishGoogle\(\);/);
  assert.match(src, /if \(googlePending && !answersIn && [^\n]*Answer the questions again\./);
  assert.ok(!src.includes("Pick your trip again"));
  assert.ok(!/function onLoaded\(\) \{[^}]*googlePending/.test(src));
});

test("reveal is saved: Saved to, the app's two steps and Start again before the trip; no Save button", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const reveal = screen("reveal", "account");
  assert.ok(reveal.includes('"Saved to "'));
  assert.ok(reveal.includes("/img/app-store-badge-black.svg"));
  assert.ok(reveal.includes('"<li><b>2</b><span>Sign in with " + esc(d.email) + ", and open Trips.</span></li>'));
  assert.ok(reveal.includes('data-act="again">Start again</button>'));
  assert.ok(!src.includes('data-act="save"'));
  const at = reveal.indexOf('"Saved to "');
  assert.ok(reveal.indexOf('class="q-when"') < at && at < reveal.indexOf("q-steps") && reveal.indexOf("q-steps") < reveal.indexOf('<div id="tv"'), "under the when line, before the trip");
  assert.ok(!src.includes("q-bottom") && !css.includes("q-bottom"), "no sticky bar left");
  // saving goes to the trip, the saved info names the trip picked
  assert.match(src, /function finish\(email, title, kept\) \{[^]*?pick: st\.pick[^]*?go\(S\.reveal\);\s*\}/);
});

test("kept: the account kept its own trip; the trip shown with a line that it wasn't saved", () => {
  assert.ok(screen("reveal", "account").includes('"Not saved. Your account kept " + d.title + "."'));
});

test("monthsOf: each month at its next occurrence, current month included", () => {
  assert.deepEqual(monthsOf("summer", NOV20), [{ month: 11, year: 2026 }, { month: 0, year: 2027 }, { month: 1, year: 2027 }]);
  assert.deepEqual(monthsOf("spring", NOV20), [{ month: 10, year: 2026 }, { month: 8, year: 2027 }, { month: 9, year: 2027 }]);
});

test("startDateFor", () => {
  assert.equal(startDateFor({ season: "summer", month: { month: 0, year: 2027 } }, NOV20), "2027-01-01");
  assert.equal(startDateFor({ season: "spring", month: { month: 10, year: 2026 } }, NOV20), "2026-11-21");
  assert.equal(startDateFor({ season: "winter", month: null }, NOV20), "2027-06-01");
  assert.equal(startDateFor({ season: "spring", month: null }, NOV20), "2026-11-21");
  // no season: three months from today (the owner, 2026-11-23), the same day or the month's last
  assert.equal(startDateFor({ season: null, month: null }, NOV20), "2027-02-20");
  assert.equal(startDateFor({ season: "unsure", month: null }, NOV20), "2027-02-20");
  assert.equal(startDateFor({ season: "unsure", month: null }, new Date(2026, 10, 23)), "2027-02-23");
  assert.equal(startDateFor({ season: null, month: null }, new Date(2026, 11, 5)), "2027-03-05");
  assert.equal(startDateFor({ season: "unsure", month: null }, new Date(2026, 10, 30)), "2027-02-28", "no 30 February");
  assert.equal(startDateFor({ season: "unsure", month: null }, new Date(2027, 10, 30)), "2028-02-29", "a leap year");
  assert.equal(startDateFor({ season: "unsure", month: null }, new Date(2026, 11, 31)), "2027-03-31");
  assert.equal(startDateFor({ season: "summer", month: { month: 11, year: 2026 } }, new Date(2026, 11, 31)), "2027-01-01");
});

test("seasonOf and seasonLine", () => {
  assert.equal(seasonOf(11), "summer"); assert.equal(seasonOf(0), "summer"); assert.equal(seasonOf(4), "autumn");
  assert.equal(seasonOf(6), "winter"); assert.equal(seasonOf(10), "spring");
  assert.match(seasonLine("winter"), /^Winter: /);
  assert.equal(seasonLine(null), null);
  assert.equal(seasonLine("unsure"), null);
});

test("stepFromHash", () => {
  assert.equal(stepFromHash("#3"), 3);
  assert.equal(stepFromHash("#15"), 15);
  assert.equal(stepFromHash(""), 0);
  assert.equal(stepFromHash("#x"), 0);
  assert.equal(stepFromHash("#99"), 0);
});

test("tripPhotos: a different photo for each trip, never Food, from day 2 on", () => {
  const stop = (id, thumb, category = ["Scenic"]) => ({ siteId: id, thumb, category });
  const a = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("r", "r.webp", ["Food"]), stop("x", "x.webp")] }] };
  const b = { days: [{ items: [stop("g", "g.webp")] }, { items: [stop("x", "x.webp"), stop("y", "y.webp")] }] };
  assert.deepEqual(Q.tripPhotos([a, b]), ["x.webp", "y.webp"]);
  const one = { days: [{ items: [stop("g", "g.webp")] }] };
  assert.deepEqual(Q.tripPhotos([one, one]), ["g.webp", "g.webp"]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("n", null)] }] }]), [""]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ items: [stop("f", "f.webp", ["Food"])] }] }]), ["f.webp"]);
  assert.deepEqual(Q.tripPhotos([{ days: [{ free: true, items: [] }] }]), [""]);
});

test("dots: no middle dot survives into a rendered screen", () => {
  const out = Q.dots('<h2>Day 1 <span>· Queenstown</span></h2><p>3 days · Back in</p>');
  assert.ok(!out.includes("·"));
  assert.ok(out.includes("∙ Queenstown") && out.includes("3 days ∙ Back in"));
  const src = readFileSync(new URL("../public/plan/quiz.js", import.meta.url), "utf8");
  assert.ok(src.includes("root.innerHTML = dots(screens[STEPS[step]]())"), "render passes every screen through dots");
});

test("a stop with no photo gets its fallback URL; a real photo wins", () => {
  assert.equal(Q.stopPhoto({ thumb: null, fallback: "types/coffee" }), "/img/places/types/coffee.webp");
  assert.equal(Q.stopPhoto({ thumb: "a.webp", fallback: "types/coffee" }), "a.webp");
  assert.equal(Q.stopPhoto({ thumb: null }), "");
});

test("the start towns are the builder's six start cities, each with a photo from the image host and a line", () => {
  assert.deepEqual(Q.TOWNS.map((t) => t.id).sort(), data.starts.slice().sort());
  for (const t of Q.TOWNS) {
    assert.match(t.img, /^https:\/\/api\.blacksands\.app\/images\/southislandguide\/[0-9a-f-]+\.webp$/, t.id);
    assert.ok(t.sub && t.name === data.towns[t.id].name, t.id);
  }
});

test("driveLine: the over-limit line", () => {
  assert.equal(Q.driveLine(320, 240), "About 5 h 20 of driving. Over your 4 h limit.");
  assert.equal(Q.driveLine(300, 120), "About 5 h of driving. Over your 2 h limit.");
  assert.equal(Q.driveLine(185, 120), "About 3 h 05 of driving. Over your 2 h limit.");
});
