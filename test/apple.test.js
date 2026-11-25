import { test } from "node:test";
import assert from "node:assert/strict";
import { appleReturn } from "../src/apple.js";

const post = (fields) => new Request("https://kiwiguide.app/plan/apple", { method: "POST", body: new URLSearchParams(fields) });
const where = (r) => [r.status, r.headers.get("Location")];

test("Apple's form_post goes on to /plan/ with the token and state in the fragment, Google's shape", async () => {
  assert.deepEqual(where(await appleReturn(post({ id_token: "h.p.s", state: "S1", code: "c", user: "{}" }))), [303, "https://kiwiguide.app/plan/#id_token=h.p.s&state=S1"]);
});

test("a cancel at Apple is access_denied; any other error is server_error", async () => {
  assert.deepEqual(where(await appleReturn(post({ error: "user_cancelled_authorize", state: "S1" }))), [303, "https://kiwiguide.app/plan/#error=access_denied&state=S1"]);
  assert.deepEqual(where(await appleReturn(post({ error: "invalid_request", state: "S1" }))), [303, "https://kiwiguide.app/plan/#error=server_error&state=S1"]);
});

test("a GET, no state, or a state or token that isn't plain base64url goes to /plan/ with nothing", async () => {
  assert.deepEqual(where(await appleReturn(new Request("https://kiwiguide.app/plan/apple"))), [303, "https://kiwiguide.app/plan/"]);
  assert.deepEqual(where(await appleReturn(post({ id_token: "h.p.s" }))), [303, "https://kiwiguide.app/plan/"]);
  assert.deepEqual(where(await appleReturn(post({ id_token: "h.p.s", state: "S1&id_token=x" }))), [303, "https://kiwiguide.app/plan/"]);
  assert.deepEqual(where(await appleReturn(post({ id_token: "h.p.s&state=EVIL", state: "S1" }))), [303, "https://kiwiguide.app/plan/#error=server_error&state=S1"]);
});
