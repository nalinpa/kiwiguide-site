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
