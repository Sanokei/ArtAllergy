# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Art Allergy is the website for an independent publishing house (NY & London) that helps creators bring any creative work to market: books, zines, art prints, board games, video games, films, and merch. It is a static HTML site deployed to Cloudflare Pages, with one serverless function for a lightweight API endpoint.

The house tagline is: **"A publishing house for the immune."**

## Build & Run

There is no build step. The site is pure static HTML:

- **Preview locally**: Serve the repo root with any static file server, e.g. `npx serve .` or `python -m http.server 8000`
- **Deploy**: Push to `main` — Cloudflare Pages auto-deploys from the repo

No package.json, no bundler, no framework.

## Architecture

```
index.html          # Landing page (manifesto, catalog, submissions form)
404.html            # Custom 404 page
legal.html          # Terms, rights, privacy, submission policy
functions/hello.js  # Cloudflare Pages Function — JSON API endpoint at /api/hello
img/                # All static images (book covers, icon, OG image, hero art)
```

- **Tailwind CSS** is loaded via CDN with custom config inline (`allergyRed: '#d7232e'`, `serif: Playfair Display`, `sans: Inter`)
- **Matter.js** (v0.19, CDN) powers an interactive physics simulation on the homepage — a segmented string rendered on a `<canvas>` that responds to mouse velocity. The engine runs with zero gravity, constrained segments, and force applied to nearby bodies on mousemove.
- **Google Fonts**: Playfair Display + Inter, loaded via the standard CSS API

## Cloudflare Function

`functions/hello.js` exports `onRequest(context)`. It returns a JSON status response with the visitor's IP (from `CF-Connecting-IP` header) and server timestamp. This is a Cloudflare Pages Function (not a Worker) — it lives in `functions/` and is deployed as part of the Pages project. The route is `/api/hello` (derived from the filename).

## Adding Pages Functions

To add new API endpoints, create additional files in `functions/` with an `onRequest(context)` export. The route matches the filename. For example, `functions/submit.js` would serve at `/api/submit`.
