# Nomikos Frontend (`NO-MI-KOS-FRONT`)

> **Live:** https://no-mi-kos-front.onrender.com/detect-errors · *Render free tier: first request after idle takes ~10–20 s.*

React + Vite single-page app that drives the Nomikos PDF toolkit. The UI
is single-purpose — page numbering with optional annexure and signature
steps. No PDF logic lives here; everything routes through the backend's
streaming endpoint.

Pairs with [`NO-MO-KOS-BACK`](https://github.com/shashankjohri07/NO-MO-KOS-BACK).
See the [project-level README](../README.md) for the full picture.

---

## What lives where

```
src/
├── pages/
│   ├── ErrorReport.tsx       Main flow. State machine across 6 steps:
│   │                         pick-main → processing → annex-ask →
│   │                         pick-annex → sig-ask → pick-sig → done.
│   ├── HomePage.tsx          Marketing landing.
│   └── UserOptions.tsx       (legacy form)
│
├── services/
│   └── documentApi.ts        fetch wrapper for the streaming POST
│                             /api/write-pagination, plus a warmUp()
│                             helper that pings /api/health on mount.
│
├── routes/AppRoutes.tsx      Three routes: /, /options, /detect-errors.
│
├── components/               Marketing landing-page components.
│
└── styles/                   Plain CSS modules (no Tailwind).
```

---

## The state machine (ErrorReport.tsx)

```
pick-main → processing → annex-ask
                          ├─ "Nahi — download & done"  → download stored Blob, reset
                          └─ "Haan, annexures upload" → pick-annex
                                                         ↓
                                                       processing → sig-ask
                                                                     ├─ "Nahi — download & done"
                                                                     └─ "Haan, signatures upload" → pick-sig
                                                                                                      ↓
                                                                                                    processing → done
                                                                                                    (auto-download)
```

Each successful submit stores the resulting Blob in `pendingBlob`
state without triggering a download; the file only goes to the user
when they opt out of the next step or finish the last step. So a
session yields exactly one file, reflecting whichever optional steps
were completed.

---

## Local development

```bash
npm install
npm run dev                     # Vite → http://localhost:5173 (auto-bumps if busy)
```

`vite.config.ts` proxies `/api` to `http://localhost:3001`, so the dev
build talks to a locally running backend out of the box. Nothing else
to configure.

The `.env` for local dev sets `VITE_API_BASE_URL=/api` (proxy form).
Production builds inline the full backend URL at build time.

---

## API client (services/documentApi.ts)

```ts
documentApi.writePagination(files, indexEndPage, annexures?, signatures?)
  // Streaming POST → returns { blob, filename }
  // signatures: { client?: File; advocate?: File }

documentApi.warmUp()
  // GET /api/health — fire and forget, used on page mount

documentApi.detectErrors(...)
  // Legacy JSON path for detect/both modes. UI doesn't currently use it.
```

The `apiUrl(path)` helper inside this module tolerates `VITE_API_BASE_URL`
with or without a trailing slash, so the same code works against the
local Vite proxy (`/api`) and the production backend URL (`/api/`).

---

## Deployment

`render.yaml` declares a Docker web service. The Dockerfile builds the
Vite bundle and serves it through nginx. Render auto-deploys on push to
`main`; if it doesn't pick up, trigger a manual deploy in the dashboard.

Live URL: https://no-mi-kos-front.onrender.com

The page mounts a `/api/health` ping so the backend dyno wakes up while
the user is still selecting their files. Cuts the first-submit wait by
~30 s on a cold backend.

---

## Known dead weight (refactor queued)

- `ErrorReport.tsx` is ~620 lines. The next refactor pass will split it
  into per-step components (`MainFileStep`, `AnnexAskStep`, `AnnexPickStep`,
  `SigAskStep`, `SigPickStep`, `DonePanel`) and a shared `FileList`.
- `styles/ErrorReport.css` carries ~400 lines of dead rules from the
  original detect-mode UI (rule cards, tabs, stat boxes, badges). The
  refactor will purge them.

Both deferred to keep the current commit a pure feature ship; see the
[project README's roadmap section](../README.md#roadmap).
