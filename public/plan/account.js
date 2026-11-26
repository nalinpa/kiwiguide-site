// Account and saved trip: Firebase email sign-up, then the same POST the app's Create Trip sheet sends.
// The pure/network functions are tested (test/account.test.js); the screens live in quiz.js.

var FIREBASE_WEB_KEY = "AIzaSyByez1QO-Xc1omwtvV0EZTyTuhW2gTWxn0"; // the app's public web key
var IDT = "https://identitytoolkit.googleapis.com/v1/accounts:";
var API = "https://api.blacksands.app/v1/southislandguide/itineraries";
var GENERIC = "Something went wrong. Check your connection and try again.";

function addDays(iso, n) {
  var p = iso.split("-");
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.toISOString().slice(0, 10);
}

function tripBody(trip, startDate, uuid) {
  var days = trip.days.map(function (d, i) {
    return {
      id: "day_" + (i + 1),
      date: addDays(startDate, i),
      items: d.items.map(function (it) {
        return { id: "item_" + uuid(), siteId: it.siteId, siteName: it.siteName, slotIndex: it.slotIndex, durationSlots: it.durationSlots, timeLabel: it.timeLabel, durationLabel: it.durationLabel };
      }),
    };
  });
  return { title: trip.label, startDate: startDate, endDate: days[days.length - 1].date, days: days };
}

function authCall(fetchFn, method, email, password) {
  return fetchFn(IDT + method + "?key=" + encodeURIComponent(FIREBASE_WEB_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
  }).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) throw { code: String((data && data.error && data.error.message) || "") };
      return { idToken: data.idToken, email: data.email, uid: data.localId, isNew: method === "signUp" };
    });
  }, function () { throw { code: "" }; });
}
function signUp(fetchFn, email, password) { return authCall(fetchFn, "signUp", email, password); }
// Create account: the confirm field must match before anything is sent.
function createAccount(fetchFn, email, password, confirm) {
  if (password !== confirm) return Promise.reject({ code: "PASSWORDS_DIFFER" });
  return signUp(fetchFn, email, password);
}
function signIn(fetchFn, email, password) { return authCall(fetchFn, "signInWithPassword", email, password); }

// The app's setDoc(users/{uid}, { emailOptIn: { value, at: serverTimestamp() } }, { merge: true }) as a Firestore REST commit; the ID token is the Bearer.
var FS_DB = "projects/southislandguide/databases/(default)";
function saveEmailOptIn(fetchFn, idToken, uid, value) {
  return fetchFn("https://firestore.googleapis.com/v1/" + FS_DB + "/documents:commit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
    body: JSON.stringify({ writes: [{
      update: { name: FS_DB + "/documents/users/" + uid, fields: { emailOptIn: { mapValue: { fields: { value: { booleanValue: !!value } } } } } },
      updateMask: { fieldPaths: ["emailOptIn.value"] },
      updateTransforms: [{ fieldPath: "emailOptIn.at", setToServerValue: "REQUEST_TIME" }],
    }] }),
  }).then(function (r) { if (!r.ok) throw { status: r.status }; }, function () { throw { status: 0 }; });
}

// Same email the app sends today.
function resetPassword(fetchFn, email) {
  return fetchFn(IDT + "sendOobCode?key=" + encodeURIComponent(FIREBASE_WEB_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email: email }),
  }).then(function (r) {
    if (r.ok) return;
    // an unknown email looks the same as a known one, so the page never says which emails have accounts
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!/^EMAIL_NOT_FOUND/.test(String(d && d.error && d.error.message))) throw { code: "" };
    });
  }, function () { throw { code: "" }; });
}

// ---- Continue with Google: OpenID Connect redirect, no Google script ----
var GOOGLE_WEB_CLIENT_ID = "317359472880-e6b6ncp7fjpjmbradr7am1kumbnjgrts.apps.googleusercontent.com"; // the app's public web OAuth client id

function googleAuthUrl(origin, state, nonce) {
  var q = { client_id: GOOGLE_WEB_CLIENT_ID, redirect_uri: origin + "/plan/", response_type: "id_token", scope: "openid email profile", nonce: nonce, state: state, prompt: "select_account" };
  return "https://accounts.google.com/o/oauth2/v2/auth?" + Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&");
}

// 16 random bytes as base64url
function newToken() {
  var b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode.apply(null, b)).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=+$/, "");
}

// { idToken, state } or { error, state } from Google's fragment; null when it isn't a Google return.
function readGoogleReturn(hash) {
  var p = new URLSearchParams(String(hash).replace(/^#/, ""));
  var state = p.get("state");
  if (!state) return null;
  if (p.get("id_token")) return { idToken: p.get("id_token"), state: state };
  if (p.get("error")) return { error: p.get("error"), state: state };
  return null;
}

function jwtNonce(t) {
  try { return JSON.parse(atob(String(t).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).nonce; } catch (e) { return undefined; }
}

// ---- Continue with Apple: Apple posts its answer to the worker (/plan/apple, response_mode form_post, needed for the
// email), which sends it on to /plan/ in the same fragment shape as Google's. Apple gets the nonce's SHA-256, Firebase the
// nonce itself.
var APPLE_SERVICES_ID = "app.blacksands.southislandguide.web"; // the website's Services ID (owner, Apple Developer)

function appleAuthUrl(origin, state, hashedNonce) {
  var q = { client_id: APPLE_SERVICES_ID, redirect_uri: origin + "/plan/apple", response_type: "code id_token", scope: "email", response_mode: "form_post", nonce: hashedNonce, state: state };
  return "https://appleid.apple.com/auth/authorize?" + Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&");
}

function sha256Hex(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  });
}

function signInWithGoogle(fetchFn, googleIdToken, requestUri) { return signInWithIdp(fetchFn, "id_token=" + googleIdToken + "&providerId=google.com", requestUri); }
function signInWithApple(fetchFn, appleIdToken, rawNonce, requestUri) { return signInWithIdp(fetchFn, "id_token=" + appleIdToken + "&providerId=apple.com&nonce=" + encodeURIComponent(rawNonce), requestUri); }

function signInWithIdp(fetchFn, postBody, requestUri) {
  return fetchFn(IDT + "signInWithIdp?key=" + encodeURIComponent(FIREBASE_WEB_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postBody: postBody, requestUri: requestUri, returnSecureToken: true, returnIdpCredential: true }),
  }).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) throw { code: String((data && data.error && data.error.message) || "") };
      // the email already has a password account: Firebase asks to confirm instead of linking
      if (data.idToken && !data.needConfirmation) return { idToken: data.idToken, email: data.email, uid: data.localId, isNew: !!data.isNewUser };
      // with returnIdpCredential Firebase answers 200 with errorMessage and no idToken
      var m = String(data.errorMessage || "").split(/[ :]/)[0];
      throw { code: data.needConfirmation || m === "EMAIL_EXISTS" || m === "FEDERATED_USER_ID_ALREADY_LINKED" ? "NEED_CONFIRMATION" : "", email: data.email };
    });
  }, function () { throw { code: "" }; });
}

// The state is checked first (and the nonce inside the token); nothing goes to the network unless both match what the page saved before leaving.
// Google's or Apple's (saved.provider "apple") return: both come back in the same fragment shape.
function completeGoogle(fetchFn, ret, saved, requestUri) {
  if (!ret || !saved || !saved.state || ret.state !== saved.state) return Promise.reject({ code: "" });
  if (ret.error) return Promise.reject({ code: ret.error === "access_denied" ? "GOOGLE_CANCELLED" : "" });
  if (!saved.nonce) return Promise.reject({ code: "" });
  if (saved.provider === "apple") {
    return sha256Hex(saved.nonce).then(function (h) {
      if (jwtNonce(ret.idToken) !== h) throw { code: "" };
      return signInWithApple(fetchFn, ret.idToken, saved.nonce, requestUri);
    });
  }
  if (jwtNonce(ret.idToken) !== saved.nonce) return Promise.reject({ code: "" });
  return signInWithGoogle(fetchFn, ret.idToken, requestUri);
}

function api(fetchFn, idToken, method, payload, id) {
  var opts = { method: method, headers: { Authorization: "Bearer " + idToken } };
  if (payload) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(payload); }
  return fetchFn(API + (id ? "/" + encodeURIComponent(id) : ""), opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (data) {
      if (!r.ok) throw { status: r.status, error: data && typeof data.error === "string" ? data.error : "" };
      return data;
    });
  }, function () { throw { status: 0, error: "" }; });
}

function listTrips(fetchFn, idToken) {
  return api(fetchFn, idToken, "GET").then(function (d) { return (d.data && d.data.itineraries) || []; });
}
function saveTrip(fetchFn, idToken, body) {
  return api(fetchFn, idToken, "POST", body).then(function () {});
}

// Replaces a trip in place (the app's Create Trip sheet does the same with replaceId). Never deletes.
function replaceTrip(fetchFn, idToken, id, body) {
  return api(fetchFn, idToken, "PUT", body, id).then(function () {});
}

function stamp(t) {
  var u = t && t.updatedAt;
  return typeof u === "number" ? u : Date.parse(u) || 0;
}
// Newest update first. The page sorts by updatedAt itself (the api also returns updatedAt DESC) so it never depends on the api's order.
function newestFirst(list) {
  return list.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return stamp(b.t) - stamp(a.t) || a.i - b.i; }).map(function (x) { return x.t; });
}

// One write at a time: run() returns null while another call is pending, else the call's promise.
function guard() {
  var busy = false;
  return {
    busy: function () { return busy; },
    run: function (fn) {
      if (busy) return null;
      busy = true;
      var p;
      try { p = Promise.resolve(fn()); } catch (e) { busy = false; return Promise.reject(e); }
      return p.then(function (v) { busy = false; return v; }, function (e) { busy = false; throw e; });
    },
  };
}

// The app keeps one trip per person. No trip: save. A trip: hand it back so the page can ask before replacing it
// (newestFirst puts the most recently updated first, so that is the one to replace).
function saveFlow(fetchFn, idToken, body) {
  return listTrips(fetchFn, idToken).then(function (existing) {
    if (existing.length) return { result: "has-trip", existing: newestFirst(existing)[0] };
    return saveTrip(fetchFn, idToken, body).then(function () { return { result: "saved" }; });
  });
}

var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "1–10 Mar 2027", or "28 Feb – 3 Mar 2027" across months.
function tripDates(start, end) {
  var a = String(start).split("-"), b = String(end).split("-");
  if (a.length !== 3 || b.length !== 3) return "";
  var ad = +a[2], bd = +b[2], am = MON[+a[1] - 1], bm = MON[+b[1] - 1];
  if (!am || !bm) return "";
  if (start === end) return bd + " " + bm + " " + b[0];
  if (a[0] === b[0] && a[1] === b[1]) return ad + "–" + bd + " " + bm + " " + b[0];
  return ad + " " + am + (a[0] === b[0] ? "" : " " + a[0]) + " – " + bd + " " + bm + " " + b[0];
}

// Firebase may put text after the code, so match the start.
function authErrorMessage(code) {
  var c = String(code || "").split(/[\s:]/)[0];
  if (c === "EMAIL_EXISTS") return "That email already has an account. Sign in instead.";
  if (c === "WEAK_PASSWORD") return "Choose a password with at least 6 characters.";
  if (c === "INVALID_LOGIN_CREDENTIALS" || c === "INVALID_PASSWORD" || c === "EMAIL_NOT_FOUND") return "The email or password is wrong.";
  if (c === "NEED_CONFIRMATION" || c === "FEDERATED_USER_ID_ALREADY_LINKED") return "That email already has a password account. Sign in with your password instead.";
  if (c === "PASSWORDS_DIFFER") return "The passwords don't match.";
  if (c === "GOOGLE_CANCELLED") return "";
  if (c === "INVALID_EMAIL") return "Check the email address.";
  if (c === "TOO_MANY_ATTEMPTS_TRY_LATER") return "Too many tries. Wait a few minutes and try again.";
  return GENERIC;
}

function saveErrorMessage(status, error) {
  if (status === 401) return "Please sign in again to save your trip.";
  if (status === 409 && error === "date_overlap") return "Those dates overlap your trip in Kiwi Guide. Go back and pick another month.";
  if (status === 0) return "No signal, so the trip was not saved. Your account is kept. Try again when you are back online.";
  return "The trip could not be saved. Your account is kept. Try again.";
}

if (typeof module !== "undefined") module.exports = { FIREBASE_WEB_KEY: FIREBASE_WEB_KEY, GOOGLE_WEB_CLIENT_ID: GOOGLE_WEB_CLIENT_ID, googleAuthUrl: googleAuthUrl, newToken: newToken, readGoogleReturn: readGoogleReturn, signInWithGoogle: signInWithGoogle, completeGoogle: completeGoogle, APPLE_SERVICES_ID: APPLE_SERVICES_ID, appleAuthUrl: appleAuthUrl, sha256Hex: sha256Hex, signInWithApple: signInWithApple, createAccount: createAccount, tripBody: tripBody, signUp: signUp, signIn: signIn, resetPassword: resetPassword, saveEmailOptIn: saveEmailOptIn, listTrips: listTrips, saveTrip: saveTrip, replaceTrip: replaceTrip, tripDates: tripDates, saveFlow: saveFlow, guard: guard, newestFirst: newestFirst, authErrorMessage: authErrorMessage, saveErrorMessage: saveErrorMessage };
