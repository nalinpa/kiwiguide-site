# Kiwi Guide website

A static site for the Kiwi Guide iPhone app: the home page plus `/privacy/` and `/terms/`. Plain HTML and CSS with no build step. Everything served lives in `public/`.

## App Store links

Kiwi Guide is live: app id **6818057796**. The badges (hero and closing band), the footer link and the Smart App Banner use it.

- Site links carry `ct=website`, the QR redirect `ct=qr`, so App Store Connect can split installs by source.
- Every App Store link carries the provider token `pt=128674950` (App Store Connect, Analytics, Acquisition, Campaigns), which App Store Connect needs to report the campaigns. Keep it on any new App Store link.
- The badge is Apple's official black badge, unchanged; keep it at least 40px high with clear space a quarter of its height.

**The site lives at https://kiwiguide.app/** (registered at Porkbun, DNS on Cloudflare). Canonical, Open Graph, `robots.txt` and `sitemap.xml` point there. www.kiwiguide.app and the first home, kiwiguide.blacksands.app, serve the same site so earlier links keep working.

## QR code address: kiwiguide.app/app

Posters and stickers point at **https://kiwiguide.app/app**. It's a redirect set in `public/_redirects`, so where it goes can change without reprinting anything. Never rename or remove it. It opens Kiwi Guide on the App Store (`ct=qr`). Test locally with `npx wrangler dev` (Python's server ignores `_redirects`).

## Campaign links: /go/<name>

Each campaign (post, ad, flyer, email) gets a short link such as https://kiwiguide.blacksands.app/go/insta-nov that redirects to a chosen page and records the click. Apple's `ct=` report only counts App Store visits; these count every click, wherever the link goes.

- **Add a campaign:** one line in `src/campaigns.js` (lowercase name, destination, a comment saying what it's for), then `npx wrangler deploy`. A destination starting with `/` is a page on this site. App Store links get `ct=<name>` set automatically so Apple's report lines up with ours.
- Links forgive capitals and a trailing slash. Unknown names go to the home page and are logged as unknown, so typos in printed links show up.
- `src/worker.js` runs only for `/go/*` (`run_worker_first` in `wrangler.jsonc`); everything else, `_redirects` included, is served from `public/` as before. Test locally with `npx wrangler dev` after `npx wrangler d1 migrations apply kiwiguide-clicks --local`. Checks: `node --test`.
- Clicks go to the D1 database `kiwiguide-clicks`, table `clicks`: time, campaign, known, country, referring host, device type and a bot flag (link-preview fetchers like facebookexternalhit, Slackbot and WhatsApp open every link pasted into a chat, so they're marked, not dropped). No IP address, user agent or cookies are stored.

Clicks per campaign over the last 30 days, bots left out:

    npx wrangler d1 execute kiwiguide-clicks --remote --command "SELECT campaign, COUNT(*) AS clicks FROM clicks WHERE known = 1 AND bot = 0 AND at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days') GROUP BY campaign ORDER BY clicks DESC"

Unknown names (typos) over the same 30 days:

    npx wrangler d1 execute kiwiguide-clicks --remote --command "SELECT campaign, COUNT(*) AS clicks FROM clicks WHERE known = 0 AND bot = 0 AND at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days') GROUP BY campaign ORDER BY clicks DESC"

One campaign's clicks per day (UTC):

    npx wrangler d1 execute kiwiguide-clicks --remote --command "SELECT substr(at, 1, 10) AS day, COUNT(*) AS clicks FROM clicks WHERE campaign = 'insta-nov' AND bot = 0 GROUP BY day ORDER BY day"

Installs per campaign are Apple's to count: App Store Connect, Analytics, Acquisition, Campaigns. They only show once `pt=` is on the App Store links (see "Still to add" above).

## Privacy policy and terms

`public/privacy/` and `public/terms/` were copied from https://blacksands.app/kiwi-guide on 1 Nov 2026. The app and App Store Connect still point there, so change both copies together until those links are moved here.

## Run locally

    python -m http.server 8000 -d public

## Images

`public/img` is built from the app repo's `store/` art and the owner's photo folder:

    npm i --no-save sharp
    node scripts/images.mjs ../south-island

Only use photos recorded in `docs/photo-sources.md`.

## Deploy (Cloudflare Workers static assets)

    npx wrangler deploy

The Worker serves kiwiguide.app, www.kiwiguide.app and kiwiguide.blacksands.app (custom domains in `wrangler.jsonc`). A custom domain only attaches once its zone is **active** on this Cloudflare account; Cloudflare then creates the DNS records and HTTPS certificates itself.
