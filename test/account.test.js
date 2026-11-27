import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const A = createRequire(import.meta.url)("../public/plan/account.js");
const { tripBody, authErrorMessage, saveErrorMessage, saveFlow, signUp, replaceTrip, tripDates, guard, GOOGLE_WEB_CLIENT_ID, googleAuthUrl, readGoogleReturn, signInWithGoogle, completeGoogle, newToken, createAccount } = A;
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

// The app draws day 1's drive out of the start town from it (api: itineraries' startArea, 2026-11-27).
test("tripBody: startArea is the town the trip starts from, and left out when the trip has none", () => {
  assert.equal(tripBody(ten, "2027-01-01", uuid).startArea, ten.start);
  assert.equal("startArea" in tripBody({ ...ten, start: undefined }, "2027-01-01", uuid), false);
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
  const f = fake((u) => (u.includes("signUp") ? res(200, { idToken: "T", email: "a@b.co", localId: "u0" }) : res(400, {})));
  assert.deepEqual(await signUp(f, "a@b.co", "pw1234"), { idToken: "T", email: "a@b.co", uid: "u0", isNew: true });
  assert.equal(JSON.parse(f.calls[0].opts.body).returnSecureToken, true);
  const bad = fake(() => res(400, { error: { message: "EMAIL_EXISTS" } }));
  await assert.rejects(signUp(bad, "a@b.co", "x"), (e) => e.code === "EMAIL_EXISTS");
});

test("saveFlow: after a failed POST, calling it again reaches the api with the same Bearer token and no identitytoolkit call", async () => {
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

test("saveFlow with an existing trip only reads; nothing is written until replaceTrip is called", async () => {
  const f = withTrip(() => assert.fail("no write"));
  await saveFlow(f, "TOK", body); // the page then just shows the unchanged screen
  assert.deepEqual(f.calls.map((c) => c.opts.method), ["GET"]);
});

test("a 409 on replace carries the overlap error", async () => {
  const f = withTrip(() => res(409, { ok: false, error: "date_overlap" }));
  await assert.rejects(replaceTrip(f, "T", "trip1", body), (e) => e.status === 409 && saveErrorMessage(e.status, e.error).includes("overlap"));
});

test("saveFlow replaces the most recently updated trip, whatever the list order", async () => {
  const list = [{ id: "old", updatedAt: "2027-01-01T00:00:00Z" }, { id: "new", updatedAt: "2027-02-01T00:00:00Z" }, { id: "mid", updatedAt: "2027-01-15T00:00:00Z" }];
  const f = fake(() => res(200, { ok: true, data: { itineraries: list } }));
  assert.equal((await saveFlow(f, "T", body)).existing.id, "new");
});

test("saveErrorMessage(401) asks them to sign in again", () => {
  assert.equal(saveErrorMessage(401), "Please sign in again to save your trip.");
});

test("guard: a second call while one is pending is ignored; it works again after", async () => {
  const g = guard();
  let release, runs = 0;
  const first = g.run(() => { runs++; return new Promise((r) => (release = r)); });
  assert.equal(g.busy(), true);
  assert.equal(g.run(() => { runs++; return Promise.resolve(); }), null);
  release("a");
  assert.equal(await first, "a");
  assert.equal(g.busy(), false);
  await g.run(() => { runs++; return Promise.reject(new Error("x")); }).catch(() => {});
  assert.equal(g.busy(), false);
  await g.run(() => { runs++; throw new Error("sync"); }).catch(() => {});
  assert.equal(g.busy(), false);
  assert.equal(runs, 3);
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

// ---- Continue with Google ----
const jwt = (nonce) => "h." + Buffer.from(JSON.stringify({ nonce })).toString("base64url") + ".s";
const SAVED_G = { state: "S1", nonce: "N1" };

test("googleAuthUrl has the client id, the redirect, response_type id_token, the nonce and the state", () => {
  const u = new URL(googleAuthUrl("https://kiwiguide.app", "S1", "N1"));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), GOOGLE_WEB_CLIENT_ID);
  assert.match(GOOGLE_WEB_CLIENT_ID, /^317359472880-e6b6.*\.apps\.googleusercontent\.com$/);
  assert.equal(u.searchParams.get("redirect_uri"), "https://kiwiguide.app/plan/");
  assert.equal(u.searchParams.get("response_type"), "id_token");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("nonce"), "N1");
  assert.equal(u.searchParams.get("state"), "S1");
  assert.equal(u.searchParams.get("prompt"), "select_account");
});

test("readGoogleReturn reads id_token and state from the fragment; null without them", () => {
  assert.deepEqual(readGoogleReturn("#id_token=abc.d.e&state=S1&authuser=0"), { idToken: "abc.d.e", state: "S1" });
  assert.deepEqual(readGoogleReturn("#error=access_denied&state=S1"), { error: "access_denied", state: "S1" });
  assert.equal(readGoogleReturn("#7"), null);
  assert.equal(readGoogleReturn(""), null);
  assert.equal(readGoogleReturn("#id_token=abc"), null);
  assert.equal(readGoogleReturn("#state=S1"), null);
});

test("newToken is base64url of at least 16 random bytes, different each time", () => {
  const a = newToken(), b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{22,}$/);
  assert.notEqual(a, b);
});

test("a returned state that doesn't match the saved one is refused, with no network call", async () => {
  const f = fake(() => res(200, {}));
  for (const [ret, saved] of [[{ idToken: jwt("N1"), state: "OTHER" }, SAVED_G], [{ idToken: jwt("N1"), state: "S1" }, null], [{ idToken: jwt("N1"), state: "S1" }, { state: "", nonce: "N1" }], [{ idToken: jwt("WRONG"), state: "S1" }, SAVED_G]]) {
    await assert.rejects(completeGoogle(f, ret, saved, "https://kiwiguide.app/plan/"), (e) => typeof e.code === "string");
  }
  assert.equal(f.calls.length, 0);
});

test("a Google error (cancelled) with the right state ends with the cancel code, no network call", async () => {
  const f = fake(() => res(200, {}));
  await assert.rejects(completeGoogle(f, { error: "access_denied", state: "S1" }, SAVED_G, "x"), { code: "GOOGLE_CANCELLED" });
  await assert.rejects(completeGoogle(f, { error: "server_error", state: "S1" }, SAVED_G, "x"), { code: "" });
  assert.equal(f.calls.length, 0);
});

test("signInWithGoogle posts postBody with id_token and providerId google.com, and returns the idToken", async () => {
  const f = fake(() => res(200, { idToken: "FT", email: "g@x.co", localId: "u1", isNewUser: true }));
  assert.deepEqual(await signInWithGoogle(f, "G.T.K", "https://kiwiguide.app/plan/"), { idToken: "FT", email: "g@x.co", uid: "u1", isNew: true });
  assert.match(f.calls[0].url, /accounts:signInWithIdp\?key=/);
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), { postBody: "id_token=G.T.K&providerId=google.com", requestUri: "https://kiwiguide.app/plan/", returnSecureToken: true, returnIdpCredential: true });
});

test("signInWithGoogle: needConfirmation (the email has a password account) and api errors carry codes", async () => {
  await assert.rejects(signInWithGoogle(fake(() => res(200, { needConfirmation: true, email: "a@b.co" })), "t", "u"), { code: "NEED_CONFIRMATION" });
  await assert.rejects(signInWithGoogle(fake(() => res(400, { error: { message: "FEDERATED_USER_ID_ALREADY_LINKED" } })), "t", "u"), { code: "FEDERATED_USER_ID_ALREADY_LINKED" });
  await assert.rejects(signInWithGoogle(async () => { throw new Error("offline"); }, "t", "u"), { code: "" });
});

test("authErrorMessage: an email that already has a password account says to sign in with the password", () => {
  for (const c of ["NEED_CONFIRMATION", "FEDERATED_USER_ID_ALREADY_LINKED"]) assert.match(authErrorMessage(c), /password/i);
  assert.match(authErrorMessage("NEED_CONFIRMATION"), /sign in with your password/i);
  assert.equal(authErrorMessage("GOOGLE_CANCELLED"), "");
});

test("after Google sign-in the save flow runs as for email: list, then POST", async () => {
  const f = fake((u, o) => {
    if (u.includes("signInWithIdp")) return res(200, { idToken: "FT", email: "g@x.co" });
    if (o.method === "GET") return res(200, { ok: true, data: { itineraries: [] } });
    return res(200, { ok: true });
  });
  const s = await completeGoogle(f, { idToken: jwt("N1"), state: "S1" }, SAVED_G, "https://kiwiguide.app/plan/");
  assert.equal((await saveFlow(f, s.idToken, body)).result, "saved");
  assert.deepEqual(f.calls.map((c) => (c.opts.method || "") + " " + (c.url.includes("identity") ? "idp" : "api")), ["POST idp", "GET api", "POST api"]);
  assert.equal(f.calls[1].opts.headers.Authorization, "Bearer FT");
});

test("create account refuses a confirm that doesn't match, without calling signUp", async () => {
  const f = fake(() => res(200, { idToken: "T", email: "a@b.co" }));
  await assert.rejects(createAccount(f, "a@b.co", "pw1234", "pw12345"), { code: "PASSWORDS_DIFFER" });
  assert.equal(f.calls.length, 0);
  assert.match(authErrorMessage("PASSWORDS_DIFFER"), /^The passwords don't match\.$/);
  assert.equal((await createAccount(f, "a@b.co", "pw1234", "pw1234")).idToken, "T");
});

test("signInWithGoogle: Identity Toolkit's 200 with errorMessage and no idToken (returnIdpCredential) means a password account; the email is kept", async () => {
  for (const b of [{ needConfirmation: true, email: "a@b.co" }, { errorMessage: "EMAIL_EXISTS", email: "a@b.co" }, { errorMessage: "FEDERATED_USER_ID_ALREADY_LINKED", email: "a@b.co" }]) {
    await assert.rejects(signInWithGoogle(fake(() => res(200, b)), "t", "u"), { code: "NEED_CONFIRMATION", email: "a@b.co" });
  }
  await assert.rejects(signInWithGoogle(fake(() => res(200, { errorMessage: "SOMETHING_ELSE" })), "t", "u"), { code: "" });
});

// ---- Continue with Apple (owner, 2026-11-26) ----
const SAVED_A = { state: "S1", nonce: "N1", provider: "apple" };

test("appleAuthUrl: the website's Services ID, the worker's return, form_post with the email, the hashed nonce and the state", () => {
  const u = new URL(A.appleAuthUrl("https://kiwiguide.app", "S1", "H1"));
  assert.equal(u.origin + u.pathname, "https://appleid.apple.com/auth/authorize");
  assert.equal(A.APPLE_SERVICES_ID, "app.blacksands.southislandguide.web");
  assert.deepEqual(Object.fromEntries(u.searchParams), { client_id: A.APPLE_SERVICES_ID, redirect_uri: "https://kiwiguide.app/plan/apple", response_type: "code id_token", scope: "email", response_mode: "form_post", nonce: "H1", state: "S1" });
});

test("sha256Hex is the hex SHA-256 Apple's token carries", async () => {
  assert.equal(await A.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("Apple's return: the token's nonce must be the saved nonce's hash; Firebase gets apple.com and the nonce itself", async () => {
  const f = fake(() => res(200, { idToken: "FT", email: "a@privaterelay.appleid.com", localId: "u1", isNewUser: true }));
  // the raw nonce in the token (Google's check) is refused for Apple, with no network call
  await assert.rejects(completeGoogle(f, { idToken: jwt("N1"), state: "S1" }, SAVED_A, "u"), { code: "" });
  assert.equal(f.calls.length, 0);
  const s = await completeGoogle(f, { idToken: jwt(await A.sha256Hex("N1")), state: "S1" }, SAVED_A, "https://kiwiguide.app/plan/");
  assert.deepEqual(s, { idToken: "FT", email: "a@privaterelay.appleid.com", uid: "u1", isNew: true });
  const tok = jwt(await A.sha256Hex("N1"));
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), { postBody: "id_token=" + tok + "&providerId=apple.com&nonce=N1", requestUri: "https://kiwiguide.app/plan/", returnSecureToken: true, returnIdpCredential: true });
  // cancelled at Apple (the worker passes it on as access_denied): the cancel code, no message
  await assert.rejects(completeGoogle(f, { error: "access_denied", state: "S1" }, SAVED_A, "u"), { code: "GOOGLE_CANCELLED" });
});

test("signUp gives uid and isNew; sign-in isNew false; signInWithIdp passes isNewUser", async () => {
  const ok = fake(() => res(200, { idToken: "t", email: "a@b.nz", localId: "u1" }));
  assert.deepEqual(await A.signUp(ok, "a@b.nz", "pw1234"), { idToken: "t", email: "a@b.nz", uid: "u1", isNew: true });
  assert.deepEqual(await A.signIn(ok, "a@b.nz", "pw1234"), { idToken: "t", email: "a@b.nz", uid: "u1", isNew: false });
  const idp = fake(() => res(200, { idToken: "t", email: "a@b.nz", localId: "u1", isNewUser: true }));
  assert.deepEqual(await A.signInWithGoogle(idp, "g", "u"), { idToken: "t", email: "a@b.nz", uid: "u1", isNew: true });
});

test("saveEmailOptIn writes the app's record", async () => {
  for (const value of [true, false]) {
    const f = fake(() => res(200, {}));
    await A.saveEmailOptIn(f, "t", "u1", value);
    const c = f.calls[0];
    assert.equal(c.url, "https://firestore.googleapis.com/v1/projects/southislandguide/databases/(default)/documents:commit");
    assert.equal(c.opts.method, "POST");
    assert.equal(c.opts.headers.Authorization, "Bearer t");
    assert.deepEqual(JSON.parse(c.opts.body), { writes: [{ update: { name: "projects/southislandguide/databases/(default)/documents/users/u1",
      fields: { emailOptIn: { mapValue: { fields: { value: { booleanValue: value } } } } } },
      updateMask: { fieldPaths: ["emailOptIn.value"] },
      updateTransforms: [{ fieldPath: "emailOptIn.at", setToServerValue: "REQUEST_TIME" }] }] });
  }
});

test("saveEmailOptIn rejects on 403 and on a network error", async () => {
  await assert.rejects(A.saveEmailOptIn(fake(() => res(403, {})), "t", "u1", true));
  await assert.rejects(A.saveEmailOptIn(fake(() => { throw new TypeError("network"); }), "t", "u1", true));
});

test("the plan page CSP allows Firestore", () => {
  const h = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const conn = (path) => {
    const block = h.split(/\r?\n(?=\S)/).find((b) => b.startsWith(path + "\n") || b.startsWith(path + "\r"));
    return /connect-src[^;\r\n]*/.exec(block)[0];
  };
  assert.match(conn("/plan/*"), /https:\/\/firestore\.googleapis\.com/);
  assert.doesNotMatch(conn("/reset/*"), /firestore/);
  assert.doesNotMatch(h.split(/\r?\n(?=\S)/).find((b) => b.includes("/*\n") || /^\/\*\r?\n/.test(b)).match(/connect-src[^\r\n]*/)[0], /firestore/);
});
