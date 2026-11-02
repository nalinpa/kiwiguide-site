import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseName, resolve, device, isBot, referrerHost } from "../src/links.js";

const base = "https://kiwiguide.blacksands.app/go/x";
const campaigns = {
  test: "/",
  store: "https://apps.apple.com/app/apple-store/id6818057796?ct=old&mt=8",
  blog: "https://blacksands.app/blog/?ct=keep",
};

test("normaliseName lowercases and drops a trailing slash", () => {
  assert.equal(normaliseName("TEST/"), "test");
  assert.equal(normaliseName("Insta-Nov"), "insta-nov");
  assert.equal(normaliseName(""), "");
});

test("resolve", () => {
  assert.deepEqual(resolve("test", campaigns, base), { url: "https://kiwiguide.blacksands.app/", known: 1 });
  assert.deepEqual(resolve("nope", campaigns, base), { url: "https://kiwiguide.blacksands.app/", known: 0 });
  assert.equal(resolve("constructor", campaigns, base).known, 0);
  assert.equal(
    resolve("store", campaigns, base).url,
    "https://apps.apple.com/app/apple-store/id6818057796?ct=store&mt=8"
  );
  assert.equal(resolve("blog", campaigns, base).url, "https://blacksands.app/blog/?ct=keep");
});

test("device", () => {
  assert.equal(device("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "iphone");
  assert.equal(device("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), "ipad");
  assert.equal(device("Mozilla/5.0 (Linux; Android 15; Pixel 9)"), "android");
  assert.equal(device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
  assert.equal(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), "desktop");
  assert.equal(device("curl/8.0"), "other");
  assert.equal(device(), "other");
});

test("isBot marks link-preview fetchers", () => {
  for (const ua of [
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0",
    "WhatsApp/2.23.20.0",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
    "LinkedInBot/1.0",
    "Mozilla/5.0 (Macintosh) Applebot/0.1",
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "SomeCrawler/1.0",
    "random-spider",
  ]) assert.equal(isBot(ua), 1, ua);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"), 0);
  assert.equal(isBot(), 0);
});

test("referrerHost keeps the host only", () => {
  assert.equal(referrerHost("https://l.instagram.com/?u=secret&e=abc"), "l.instagram.com");
  assert.equal(referrerHost(null), null);
  assert.equal(referrerHost("not a url"), null);
});
