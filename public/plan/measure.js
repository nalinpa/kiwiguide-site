// Google Analytics (GA4) with Consent Mode v2: consent defaults are set before the tag loads.
// Self-hosted so the CSP needs no inline script. The pure parts are tested (test/measure.test.js).

var GA_ID = "G-BVVBTV575Q";
var GA_PLACEHOLDER = "G-XXXXXXXXXX";
var GA_HOSTS = ["kiwiguide.app", "www.kiwiguide.app", "kiwiguide.blacksands.app"]; // live; any other host is a test copy
// EU 27, Iceland, Liechtenstein, Norway, UK, Switzerland: analytics and ad storage start denied here.
var CONSENT_DENIED_REGIONS = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];

function consentDefaults() {
  var keys = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"];
  var denied = { region: CONSENT_DENIED_REGIONS.slice() }, granted = {};
  keys.forEach(function (k) { denied[k] = "denied"; granted[k] = "granted"; });
  return [denied, granted];
}

function isTestHost(loc) { return !!loc && GA_HOSTS.indexOf(loc.hostname) < 0; }

// No-op when the tag isn't there (placeholder id, blocked, or a test).
// On a test copy every event carries debug_mode: gtag only marks hits for DebugView from an event-level param.
function track(name, params) {
  if (typeof globalThis.gtag !== "function") return;
  var p = Object.assign({}, params);
  if (isTestHost(globalThis.location)) p.debug_mode = true;
  globalThis.gtag("event", name, p);
}

// win is the browser window (or a stand-in in tests). Loads nothing for a missing or placeholder id.
function measureInit(id, win) {
  if (!id || id === GA_PLACEHOLDER) return false;
  win.dataLayer = win.dataLayer || [];
  win.gtag = function () { win.dataLayer.push(arguments); };
  var d = consentDefaults();
  win.gtag("consent", "default", d[0]);
  win.gtag("consent", "default", d[1]);
  win.gtag("set", "ads_data_redaction", true);
  win.gtag("set", "url_passthrough", false);
  win.gtag("js", new Date());
  // test copies show in DebugView and can be filtered out of reports as developer traffic
  // page_location never carries the hash: the Google sign-in return puts a token there
  var cfg = { page_location: win.location.origin + win.location.pathname + win.location.search };
  var test = isTestHost(win.location);
  if (test) { cfg.debug_mode = true; cfg.send_page_view = false; }
  win.gtag("config", id, cfg);
  // the automatic page view can't carry the debug flag, so a test copy sends its own (one, not two)
  if (test) win.gtag("event", "page_view", { page_location: cfg.page_location, debug_mode: true });
  // the tag is added once the page has settled, after quiz.js has cleared any Google return from the address bar
  var doc = win.document;
  function add() {
    var s = doc.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    doc.head.appendChild(s);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", add); else add();
  return true;
}

if (typeof window !== "undefined") measureInit(GA_ID, window);
if (typeof module !== "undefined") module.exports = { GA_ID: GA_ID, GA_PLACEHOLDER: GA_PLACEHOLDER, CONSENT_DENIED_REGIONS: CONSENT_DENIED_REGIONS, consentDefaults: consentDefaults, track: track, measureInit: measureInit };
