# Migration Plan: Vercel → Railway

**Date:** 2026-06-17
**Goal:** Fully host the Telesales Dashboard on Railway instead of Vercel, with no loss of functionality and a safe rollback path.

---

## 1. Why this is low-risk

The app is a standard **Next.js 16.2.6 App Router** server. The Vercel coupling is shallow:

| Vercel artifact | Location | Impact on Railway |
|---|---|---|
| `export const maxDuration = …` | `app/api/customer/analyze/route.ts` (300), `call-summary/generate` (60), `product-knowledge` (30), `extraction-rules/test` (60) | **Ignored** when self-hosting with `next start`. Railway has no per-request function timeout, so the 5-min Whisper transcription actually runs *more* reliably than on Vercel. Keep or delete — harmless. |
| `outputFileTracingIncludes` | `next.config.ts` | Only affects serverless function bundling. Running the full Node server (`next start`) ships the whole repo, so `content/product-knowledge/**` is always present. Harmless — leave it. |
| `.vercelignore` | repo root | No effect on Railway. Optional cleanup. |
| `public/vercel.svg`, README "Deploy on Vercel" | cosmetic | Optional cleanup. |

There is **no** `vercel.json`, no Cron Jobs, no Edge runtime, no Vercel Blob/KV/Postgres usage. All stateful dependencies are external:

- **Supabase** (DB + Auth) — external SaaS, unaffected.
- **OpenAI** (`OPENAI_API_KEY` / `KIMI_API_KEY`) — external API.
- **dtac OneCall / Oreka** (`OREKA_*`) — external API, **outbound** only.

→ The migration is essentially: run the same `next build && next start` on Railway, move the env vars, repoint the domain, and update Supabase Auth URLs.

---

## 2. Target architecture on Railway

- **One Railway service** running the Next.js Node server.
- Build with **Nixpacks** (Railway default, zero config) — auto-detects Next.js, runs `npm ci && npm run build`, starts with `npm run start`.
- `next start` binds to `process.env.PORT`, which Railway injects automatically — no code change needed.
- **Node 20** pinned (Next 16 requires Node ≥ 20.9; Nixpacks may otherwise pick an unsupported version).
- Supabase stays as-is (separate managed service).

Dockerfile is an available alternative (more control, reproducible) but **not recommended** for the first cut — Nixpacks is simpler and this app needs nothing special.

---

## 3. Migration steps

### Phase A — Repo prep (PR on a branch)
1. **Pin Node version** so Railway/Nixpacks builds with a supported runtime. Add to `package.json`:
   ```json
   "engines": { "node": ">=20.9.0 <23" }
   ```
   (and optionally a `.nvmrc` with `20` for local parity).
2. **Add `railway.json`** (or `nixpacks.toml`) at repo root to make build/start explicit and set a healthcheck:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": { "builder": "NIXPACKS" },
     "deploy": {
       "startCommand": "npm run start",
       "healthcheckPath": "/login",
       "healthcheckTimeout": 120,
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```
   (Pick a lightweight always-200 path for the healthcheck; `/login` is public. Optionally add a tiny `/api/health` route.)
3. **Optional cleanup** (cosmetic, can defer): remove `.vercelignore`, `public/vercel.svg`, and the "Deploy on Vercel" section of `README.md`; replace with Railway notes.
4. Verify locally: `npm run build && npm run start`, hit the app on the printed port. Run `npx tsc --noEmit` and `npm run lint`.

### Phase B — Provision Railway
5. Create a Railway project, **deploy from the GitHub repo** (connect repo → auto-deploy on push to chosen branch). Use a non-production branch first for a staging deploy.
6. **Set environment variables** in Railway (Variables tab). Copy from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (and `KIMI_API_KEY` if used)
   - `OREKA_BASE_URL`, `OREKA_USER`, `OREKA_PASSWORD`, `OREKA_HOPEFUL_USER`, `OREKA_HOPEFUL_PASSWORD`
   - `SUPERVISOR_INVITE_CODE`
   - Legacy/unused but present — copy only if still referenced: `SESSION_SECRET`, `GOOGLE_*`, `NOTION_TOKEN`.
   - Do **not** set `PORT` (Railway manages it).
   - `NEXT_PUBLIC_*` vars are inlined at **build time** — they must exist in Railway *before/at* build, not just runtime.
7. Confirm the first build succeeds and the service boots.

### Phase C — External-service config
8. **Supabase Auth:** add the new Railway URL (e.g. `https://<service>.up.railway.app` and the final custom domain) to **Auth → URL Configuration → Site URL / Redirect URLs**, and to allowed origins/CORS if any. Without this, login/session cookies break on the new domain.
9. **Oreka/dtac egress allowlist (CHECK THIS):** if the dtac OneCall portal restricts API access by source IP, the Railway egress IP differs from Vercel's. Confirm whether Oreka calls succeed from Railway; if IP-whitelisted, get Railway's egress IP whitelisted (may require a static-egress setup). This is the single most likely surprise.

### Phase D — Verify on Railway (staging URL)
10. Smoke test against the Railway URL:
    - Login / registration (Supabase auth + fake-email pattern).
    - My-Desk pages load per-agent data.
    - War Room renders.
    - **AI customer analyze** (`/api/customer/analyze`) — confirms product-knowledge files are readable (proves `outputFileTracingIncludes` is moot) and the long-running OpenAI call completes (no function timeout).
    - **Talk Time** (`/supervisor/talk-time`) — confirms Oreka reachability from Railway egress.
    - Call-summary / transcription path (the 300s job).

### Phase E — Cutover
11. Add the **custom domain** in Railway and update DNS (CNAME to Railway target). Update Supabase Auth URLs to the final domain.
12. Keep the Vercel deployment live until Railway is verified in production (rollback = repoint DNS back).
13. After a stable window, decommission the Vercel project and remove its env vars/secrets.

---

## 4. Things that are explicitly NOT a problem
- **PORT binding** — `next start` reads `PORT`; Railway sets it. No change.
- **`maxDuration`** — Vercel-only hint; ignored on self-host. Railway has no platform request timeout, so long transcriptions are fine.
- **`outputFileTracingIncludes`** — only matters for serverless tracing; the full server has the files.
- **Supabase / OpenAI / Oreka** — external; only env vars + (for Supabase) auth URLs + (for Oreka) possibly egress IP need attention.

## 5. Open decisions to confirm before executing
1. **Builder:** Nixpacks (recommended) vs Dockerfile. Default Nixpacks.
2. **Oreka IP allowlisting** — does dtac restrict by source IP? (Determines whether static egress is needed.)
3. **Domain** — which custom domain moves to Railway, and DNS access to change it.
4. **Plan/resources** — AI + transcription are memory-spiky; pick a Railway plan with adequate RAM for `next build` and runtime.

## 6. Rollback
At every stage Vercel stays deployed. Cutover is DNS-only, so rollback is repointing DNS to Vercel (and reverting Supabase Auth URLs). No data migration is involved — Supabase is shared and untouched.
