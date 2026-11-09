# Architecture

Moneyflow is a monorepo with four top-level areas.

| Area      | Stack                                          | Responsibility                                                   |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `web/`    | React 19, TypeScript strict, Vite, Tailwind v4 | UI, local state, Firestore reads and writes under the user's uid |
| `api/`    | Python 3.12, FastAPI, Pydantic v2              | Firebase token verification, rate limiting, Gemini calls         |
| `shared/` | TypeScript, Zod                                | Framework-free types, currency table, money primitives           |
| `docs/`   | Markdown                                       | Architecture, finance rules, decision records                    |

## Request flow in production

```
Browser ──► Firebase Hosting (moneyflow-coach.web.app)
              ├── /api/**  ──► Cloud Run: moneyflow-api (FastAPI)  ──► Gemini
              └── /**      ──► web/dist (static SPA)
Browser ──► Firebase Auth (Google, anonymous demo)
Browser ──► Firestore (users/{uid}/...) guarded by firestore.rules
```

The web app and the API share one origin, so there is no CORS in production
and the Firebase ID token travels as a normal `Authorization: Bearer` header.

## Where the math lives

All finance calculations are in the pure finance module (added in phase 3) and
covered by unit tests. The API passes computed results to the AI as structured
context; the AI returns text or JSON that Pydantic validates. The AI never
produces a number that the app relies on.

## Data model (Firestore)

Everything lives under `users/{uid}`. Subcollections: `accounts`,
`transactions`, `budgets`, `goals`, `debts`, `checkins`, `scores`. Money is
stored as integer minor units together with its currency code.

## Local development

- `pnpm dev` runs the web app on :5173 and proxies `/api` to :8080.
- `pnpm api:dev` runs FastAPI on :8080 with reload.
- `pnpm emulators` starts the Auth and Firestore emulators; set
  `VITE_USE_EMULATORS=true` in `web/.env.local` to use them.
