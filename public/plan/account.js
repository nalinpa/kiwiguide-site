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
      return { idToken: data.idToken, email: data.email };
    });
  }, function () { throw { code: "" }; });
}
function signUp(fetchFn, email, password) { return authCall(fetchFn, "signUp", email, password); }
function signIn(fetchFn, email, password) { return authCall(fetchFn, "signInWithPassword", email, password); }

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
// Newest update first; the api already sorts that way, but the page does not rely on it.
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
// (the list is newest-updated first, so the first one is the one to replace).
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

if (typeof module !== "undefined") module.exports = { FIREBASE_WEB_KEY: FIREBASE_WEB_KEY, tripBody: tripBody, signUp: signUp, signIn: signIn, resetPassword: resetPassword, listTrips: listTrips, saveTrip: saveTrip, replaceTrip: replaceTrip, tripDates: tripDates, saveFlow: saveFlow, guard: guard, newestFirst: newestFirst, authErrorMessage: authErrorMessage, saveErrorMessage: saveErrorMessage };
