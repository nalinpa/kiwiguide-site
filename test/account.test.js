import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const A = createRequire(import.meta.url)("../public/plan/account.js");
const { tripBody, authErrorMessage, saveErrorMessage, saveFlow, signUp, replaceTrip, tripDates } = A;
const { trips } = JSON.parse(readFileSync(new URL("../public/plan/trips.json", import.meta.url), "utf8"));
const ten = trips.find((t) => t.days.length === 10);
let n = 0;
const uuid = () => "u" + ++n;

test("tripBody: 10-day trip from 2027-01-01 ends 2027-01-10, days day_1..day_10 with consecutive dates", () => {
  const b = tripBody(ten, "2027-01-01", uuid);
  assert.equal(b.startDate, "2027-01-01");
  assert.equal(b.endDate, "2027-01-10");
  assert.deepEqual(b.days.map((d) => d.id), Array.from({ length: 10 }, (_, i) => "day_" + (i + 1)));
  assert.equal(b.days[9].date, "2027-01-10");
  assert.equal(tripBody(ten, "2027-02-25", uuid).days[4].date, "2027-03-01");
});

test("tripBody: items carry exactly the app's fields and an item_ id", () => {
  const b = tripBody(ten, "2027-01-01", uuid);
  const item = b.days[0].items[0];
  assert.deepEqual(Object.keys(item).sort(), ["durationLabel", "durationSlots", "id", "siteId", "siteName", "slotIndex", "timeLabel"]);
  assert.match(item.id, /^item_u\d+$/);
  assert.equal(b.days.reduce((s, d) => s + d.items.length, 0), ten.days.reduce((s, d) => s + d.items.length, 0));
});

test("tripBody: title is the trip's label", () => {
  assert.equal(tripBody(ten, "2027-01-01", uuid).title, ten.label);
});

test("authErrorMessage", () => {
  assert.match(authErrorMessage("EMAIL_EXISTS"), /sign in/i);
  assert.match(authErrorMessage("WEAK_PASSWORD : Password should be at least 6 characters"), /6 characters/);
  assert.match(authErrorMessage("INVALID_LOGIN_CREDENTIALS"), /email or password is wrong/);
  assert.match(authErrorMessage("TOO_MANY_ATTEMPTS_TRY_LATER : blah"), /wait/i);
  assert.equal(authErrorMessage("<img onerror=x>"), "Something went wrong. Check your connection and try again.");
});

test("saveErrorMessage", () => {
  assert.match(saveErrorMessage(409, "date_overlap"), /overlap/);
  assert.match(saveErrorMessage(409, "date_overlap"), /another month/);
  assert.match(saveErrorMessage(0), /signal|connection/i);
  assert.match(saveErrorMessage(0), /account is kept|still here|kept/i);
});

const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
function fake(script) {
  const calls = [];
  const f = async (url, opts) => { calls.push({ url, opts }); return script(url, opts, calls.length); };
  f.calls = calls;
  return f;
}
const body = tripBody(ten, "2027-01-01", uuid);

test("signUp sends returnSecureToken and returns the token; errors carry the code", async () => {
  const f = fake((u) => (u.includes("signUp") ? res(200, { idToken: "T", email: "a@b.co" }) : res(400, {})));
  assert.deepEqual(await signUp(f, "a@b.co", "pw1234"), { idToken: "T", email: "a@b.co" });
  assert.equal(JSON.parse(f.calls[0].opts.body).returnSecureToken, true);
  const bad = fake(() => res(400, { error: { message: "EMAIL_EXISTS" } }));
  await assert.rejects(signUp(bad, "a@b.co", "x"), (e) => e.code === "EMAIL_EXISTS");
});

test("retry after a failed save calls saveTrip again with the same idToken and never signUp", async () => {
  let posts = 0;
  const f = fake((u, o) => {
    if (o.method === "POST") { posts++; if (posts === 1) throw new TypeError("network"); return res(200, { ok: true, data: { itinerary: {} } }); }
    return res(200, { ok: true, data: { itineraries: [] } });
  });
  await assert.rejects(saveFlow(f, "TOK", body), (e) => e.status === 0);
  assert.equal((await saveFlow(f, "TOK", body)).result, "saved");
  assert.ok(f.calls.every((c) => c.opts.headers.Authorization === "Bearer TOK"));
  assert.ok(f.calls.every((c) => !c.url.includes("identitytoolkit")));
});

const OLD = [{ id: "trip1", title: "Old", startDate: "2027-03-01", endDate: "2027-03-10" }, { id: "trip2" }];
const withTrip = (onPut) => fake((u, o) => (o.method === "GET" ? res(200, { ok: true, data: { itineraries: OLD } }) : onPut(u, o)));

test("an account with a trip: confirm, then PUT to that trip's id, never POST", async () => {
  const f = withTrip(() => res(200, { ok: true }));
  const r = await saveFlow(f, "TOK", body);
  assert.equal(r.result, "has-trip");
  assert.equal(r.existing.id, "trip1");
  assert.ok(f.calls.every((c) => c.opts.method === "GET"));
  await replaceTrip(f, "TOK", r.existing.id, body);
  const put = f.calls[f.calls.length - 1];
  assert.equal(put.opts.method, "PUT");
  assert.ok(put.url.endsWith("/itineraries/trip1"));
  assert.deepEqual(JSON.parse(put.opts.body), body);
  assert.equal(put.opts.headers.Authorization, "Bearer TOK");
  assert.ok(f.calls.every((c) => c.opts.method !== "POST" && c.opts.method !== "DELETE"));
});

test("Keep my trip: no PUT, no POST", async () => {
  const f = withTrip(() => assert.fail("no write"));
  await saveFlow(f, "TOK", body); // the page then just shows the unchanged screen
  assert.deepEqual(f.calls.map((c) => c.opts.method), ["GET"]);
});

test("a 409 on replace carries the overlap error", async () => {
  const f = withTrip(() => res(409, { ok: false, error: "date_overlap" }));
  await assert.rejects(replaceTrip(f, "T", "trip1", body), (e) => e.status === 409 && saveErrorMessage(e.status, e.error).includes("overlap"));
});

test("tripDates", () => {
  assert.equal(tripDates("2027-03-01", "2027-03-10"), "1–10 Mar 2027");
  assert.equal(tripDates("2027-02-28", "2027-03-03"), "28 Feb – 3 Mar 2027");
  assert.equal(tripDates("2026-12-30", "2027-01-02"), "30 Dec 2026 – 2 Jan 2027");
  assert.equal(tripDates("x", "y"), "");
});

test("saveTrip 409 throws status and error", async () => {
  const f = fake((u, o) => (o.method === "POST" ? res(409, { ok: false, error: "date_overlap" }) : res(200, { data: { itineraries: [] } })));
  await assert.rejects(saveFlow(f, "T", body), (e) => e.status === 409 && e.error === "date_overlap");
});
