# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Art Allergy is the website for an independent publishing house (artallergy.com, NY & London) that helps creators bring any creative work to market: books, zines, art prints, board games, video games, films, and merch. It is a static HTML site deployed to Cloudflare Pages, with one serverless function for a lightweight API endpoint.

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
functions/api/hello.js  # Cloudflare Pages Function — JSON API endpoint at /api/hello
img/                # All static images (book covers, icon, OG image, hero art)
```

- **Tailwind CSS** is loaded via CDN with custom config inline (`allergyRed: '#d7232e'`, `serif: Playfair Display`, `sans: Inter`)
- **Matter.js** (v0.19, CDN) powers a physics string (30 constrained bodies) on `hero-canvas` that responds to mouse velocity. Flicking a segment plays a pentatonic plucked-string note via Web Audio API with expanding ring flashes.
- **Painting reveal** on a separate `paint-canvas` sized to the painting area inside the red circle. 9px circular brush strokes reveal `painting_canvasonly.png` with `source-atop` tint (random color from 12-color palette, picked on logo mouseenter). Brush strokes persist directly on the canvas — no animation loop needed.
- **Google Fonts**: Playfair Display + Inter, loaded via the standard CSS API

## Cloudflare Functions

- `functions/api/hello.js` — JSON status at `/api/hello` (IP + timestamp)
- `functions/api/submit.js` — POST at `/api/submit`, validates + spam-checks pitches, then forwards to the email-relay Worker via service binding

### Pitch terminal email flow

```
Pages Function (submit.js) → Service Binding (EMAIL_RELAY) → email-relay Worker → EMAIL.send()
```

The Worker (`workers/email-relay.js`) owns the `send_email` binding since Pages doesn't support it. The Pages Function calls the Worker internally with a shared secret header. `wrangler.jsonc` in `workers/` configures the Worker; the Pages project bindings are managed via Cloudflare API (service binding + env vars set on the project).
