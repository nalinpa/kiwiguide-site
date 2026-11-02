// Runs only for /go/* (run_worker_first in wrangler.jsonc); everything else is served from public/.
import campaigns from "./campaigns.js";
import { normaliseName, resolve, device, isBot, referrerHost } from "./links.js";

export default {
  async fetch(request, env, ctx) {
    const name = normaliseName(new URL(request.url).pathname.slice("/go/".length));
    const { url, known } = resolve(name, campaigns, request.url);
    // Logging must never slow or break the redirect: run it after responding and drop any error.
    ctx.waitUntil(log(request, env, name, known).catch(() => {}));
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  },
};

// Anonymous: no IP address, no full user agent, no cookies.
async function log(request, env, campaign, known) {
  const ua = request.headers.get("User-Agent") ?? "";
  await env.DB.prepare(
    "INSERT INTO clicks (at, campaign, known, country, referrer, device, bot) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      new Date().toISOString(),
      campaign,
      known,
      request.cf?.country ?? null,
      referrerHost(request.headers.get("Referer")),
      device(ua),
      isBot(ua)
    )
    .run();
}
