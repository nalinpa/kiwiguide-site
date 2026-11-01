# Kiwi Guide website

One static page for the Kiwi Guide iPhone app. Plain HTML and CSS with no build step. Everything served lives in `public/`.

## Before launch

Replace every `TODO-` in `public/index.html` (`grep -rn TODO- public` should find nothing afterwards):

| Placeholder | Where to find it |
|---|---|
| `TODO-APP-ID` | App Store Connect, App Information, Apple ID (digits only). Used in the badge links and the Smart App Banner. |
| `TODO-PROVIDER-TOKEN` | App Store Connect, Analytics, Acquisition, Campaigns, "Generate a campaign link". |

Canonical, Open Graph, `robots.txt` and `sitemap.xml` already point at `https://guide.kiwi/`.

## Run locally

    python -m http.server 8000 -d public

## Images

`public/img` is built from the app repo's `store/` art:

    npm i --no-save sharp
    node scripts/images.mjs ../south-island

Only use photos recorded in `docs/photo-sources.md`.

## Deploy (Cloudflare Workers static assets)

    npx wrangler deploy

The first deploy creates the `kiwiguide` Worker on `*.workers.dev`. Attaching guide.kiwi is done in the Cloudflare dashboard (Worker, Settings, Domains & Routes).
