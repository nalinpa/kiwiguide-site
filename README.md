# Kiwi Guide website

A static site for the Kiwi Guide iPhone app: the home page plus `/privacy/` and `/terms/`. Plain HTML and CSS with no build step. Everything served lives in `public/`.

## At launch

Until the app is approved the site says "Coming soon to the App Store" and has no download link. When it's live:

1. Get the app id (App Store Connect, App Information, Apple ID, digits only) and a provider token (Analytics, Acquisition, Campaigns, "Generate a campaign link").
2. In `public/index.html`, replace both `<p class="soon">` labels with Apple's badge, linked through the campaign link so site downloads show in App Store Connect. The official badges are in `launch/`; copy them to `public/img/`. Keep the badge at least 40px high with clear space a quarter of its height around it.

        <a class="badge" href="https://apps.apple.com/app/apple-store/id<APP_ID>?pt=<PROVIDER_TOKEN>&amp;ct=website&amp;mt=8">
          <picture>
            <source srcset="/img/app-store-badge-white.svg" media="(prefers-color-scheme: dark)">
            <img src="/img/app-store-badge-black.svg" alt="Download Kiwi Guide on the App Store" width="162" height="54">
          </picture>
        </a>

3. Add the Smart App Banner to the `<head>`: `<meta name="apple-itunes-app" content="app-id=<APP_ID>">`.
4. Update the "coming soon" wording in the meta descriptions and the "Free at launch" lines.

Canonical, Open Graph, `robots.txt` and `sitemap.xml` already point at `https://guide.kiwi/`.

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

The first deploy creates the `kiwiguide` Worker on `*.workers.dev`. Attaching guide.kiwi is done in the Cloudflare dashboard (Worker, Settings, Domains & Routes).
