import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { readLink, messageFor } = createRequire(import.meta.url)("../public/reset/reset.js");

const EXPIRED = "This link has expired or was already used. Open Kiwi Guide and ask for a new one from the sign-in screen.";

test("readLink reads mode, oobCode and apiKey", () => {
  assert.deepEqual(readLink("?mode=resetPassword&oobCode=abc&apiKey=key&lang=en"), {
    mode: "resetPassword", oobCode: "abc", apiKey: "key",
  });
});

test("readLink is null when one is missing", () => {
  assert.equal(readLink("?mode=resetPassword&oobCode=abc"), null);
  assert.equal(readLink("?oobCode=abc&apiKey=key"), null);
  assert.equal(readLink("?mode=resetPassword&apiKey=key"), null);
  assert.equal(readLink(""), null);
});

test("readLink returns the mode as it is; the page checks it", () => {
  assert.equal(readLink("?mode=verifyEmail&oobCode=a&apiKey=k").mode, "verifyEmail");
});

test("messageFor: expired and invalid codes ask for a new link", () => {
  assert.equal(messageFor("EXPIRED_OOB_CODE"), EXPIRED);
  assert.equal(messageFor("INVALID_OOB_CODE"), EXPIRED);
});

test("messageFor: weak password gives the app's rule, with or without a suffix", () => {
  const rule = "Choose a password with at least 6 characters.";
  assert.equal(messageFor("WEAK_PASSWORD"), rule);
  assert.equal(messageFor("WEAK_PASSWORD : Password should be at least 6 characters"), rule);
});

test("messageFor matches a code with a suffix", () => {
  assert.equal(messageFor("EXPIRED_OOB_CODE : something"), EXPIRED);
});

test("messageFor: anything else is the generic message", () => {
  const generic = "Something went wrong. Check your connection and try again.";
  assert.equal(messageFor("TOO_MANY_ATTEMPTS_TRY_LATER"), generic);
  assert.equal(messageFor(""), generic);
  assert.equal(messageFor(undefined), generic);
});
