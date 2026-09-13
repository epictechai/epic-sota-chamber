# Epic SOTA Chamber

💯Epic Tech AI🔥™️ · [chamber.epictechai.app](https://chamber.epictechai.app/)

A capability atelier: drop a Make flow (Still, Motion, Voice, Music, Pack, Stitch), type the ask, Generate. Cyan OUT wires into magenta IN. Libraries keep the takes.

This repo is the source for the Cloudflare Worker `epic-sota-chamber` (Durable Objects + Workers AI + static assets). It is not Harness, Super App, Crew, AIgent, Bot OS, or Railway Epic OS.

## What you get

- **ChamberAgent** on Workers AI (GLM + Flux, with model fallbacks). Never returns an empty still — SVG mark if every model is busy.
- **BYOK or pay.** Paste xAI / OpenAI / Anthropic / Google keys in the browser (one-shot headers). No key → sign in and buy **$0.99 = 10 credits** via Stripe.
- Costs: Still / Voice / Music **1**, Motion **3**, Stitch **2**, Pack **5**.
- Email one-time codes + per-inbox Durable Object SQLite (graphs, library index, credits).
- In-tab club-track sequencer and frame→WebM stitch. Motion is a reel, not a silent 480-minute lie.

## Run locally

```bash
npm install
npm test
npm run dev
```

`--local` keeps Durable Objects and assets on this machine. Workers AI is remote-only, so Generate still completes with the SVG / WAV fallbacks unless you `wrangler login` and drop `--local`.

Wrangler serves the atelier at `http://127.0.0.1:43147`. Bind to `0.0.0.0` so preview works off-machine.

Without Cloudflare AI credentials, Generate still completes: stills fall back to a cyan/magenta SVG mark, music still writes a WAV, local Glyph/Folio/Pulse/Stitch keep working. Email codes and Stripe need the production bindings.

Copy `.dev.vars.example` to `.dev.vars` if you want local Stripe checkout.

## Deploy to Cloudflare

Production Worker: `epic-sota-chamber`  
Custom domain: `chamber.epictechai.app`  
Account: the Epic Tech Cloudflare account that already hosts this service.

```bash
npx wrangler login
npx wrangler secret put STRIPE_SECRET_KEY
npm run deploy
```

Keep these Durable Object class names — they already hold live sessions and credits:

- `ChamberAgent` bound as `CHAMBER`
- `ChamberGate` bound as `GATE`
- `ChamberUser` bound as `USERS`

Also required on the Worker: `AI`, `EMAIL` (Email Sending), `ASSETS`, secret `STRIPE_SECRET_KEY`.

## Protocol

- Health: `GET /api/v1/health`
- Caps: `GET /api/v1/caps`
- Run: `POST /api/v1/run` with optional `x-epic-key` / `x-byok-openai` / `x-byok-anthropic` / `x-byok-google`
- No BYOK and no credits → `402`
- Agent card: `/.well-known/agent.json`
- Legal: `/legal/terms.html` and the rest of `/legal/`

Brand: cyan `#00f3ff`, magenta `#ff00aa`, black `#0a0a0a`.
