# Kiwi Guide website

A static site for the Kiwi Guide iPhone app: the home page plus `/privacy/` and `/terms/`. Plain HTML and CSS with no build step. Everything served lives in `public/`.

## App Store links

Kiwi Guide is live: app id **6818057796**. The badges (hero and closing band), the footer link and the Smart App Banner use it.

- Site links carry `ct=website`, the QR redirect `ct=qr`, so App Store Connect can split installs by source.
- **Still to add:** the provider token (App Store Connect, Analytics, Acquisition, Campaigns, "Generate a campaign link"). Add `&pt=<token>` to every `apps.apple.com/app/apple-store/id6818057796` link in `public/index.html` and `public/_redirects`. Without it the links work but the campaigns aren't reported.
- The badge is Apple's official black badge, unchanged; keep it at least 40px high with clear space a quarter of its height.

**For now the site lives at https://kiwiguide.blacksands.app/** while guide.kiwi is registered. Canonical, Open Graph, `robots.txt` and `sitemap.xml` point there. To move to guide.kiwi: replace `https://kiwiguide.blacksands.app` with `https://guide.kiwi` across `public/`, uncomment the guide.kiwi routes in `wrangler.jsonc`, and deploy. Keep the blacksands.app route a while so old links still work.

## QR code address: guide.kiwi/app

Posters and stickers point at **https://guide.kiwi/app**. It's a redirect set in `public/_redirects`, so where it goes can change without reprinting anything. Never rename or remove it. It opens Kiwi Guide on the App Store (`ct=qr`). Test locally with `npx wrangler dev` (Python's server ignores `_redirects`).

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

The first deploy creates the `kiwiguide` Worker and attaches guide.kiwi and www.guide.kiwi (set in `wrangler.jsonc`). That only works once guide.kiwi is an **active** zone on the Cloudflare account:

1. Cloudflare dashboard, Add a domain: `guide.kiwi` (Free plan). Cloudflare gives you two nameservers.
2. At the registrar, set guide.kiwi's nameservers to those two. Wait for Cloudflare to show the zone as Active (minutes to a day).
3. Remove any old A, AAAA or CNAME records for `guide.kiwi` and `www` in Cloudflare DNS, or the custom domains can't be created.
4. `npx wrangler deploy`. Cloudflare creates the DNS records and HTTPS certificates. Check https://guide.kiwi/ loads.

www.guide.kiwi serves the same page; the canonical tag points search engines at https://guide.kiwi/. A redirect from www can be added later as a Cloudflare Redirect Rule.
