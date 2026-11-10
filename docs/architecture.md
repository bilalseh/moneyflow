# Architecture

Moneyflow is a monorepo with four top-level areas.

| Area      | Stack                                          | Responsibility                                                            |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `shared/` | TypeScript, Zod                                | Finance module, document schemas, API contract types, demo data generator |
| `web/`    | React 19, TypeScript strict, Vite, Tailwind v4 | UI, Firestore reads and writes under the user's uid, coach tool execution |
| `api/`    | Python 3.12, FastAPI, Pydantic v2              | Token verification, quotas, Gemini calls with validation, Stripe          |
| `docs/`   | Markdown                                       | Architecture, finance rules, API contract, deployment, decision records   |

## Request flow in production

```
Browser ──► Firebase Hosting (moneyflow-coach.web.app)
              ├── /api/**  ──► Cloud Run: moneyflow-api (FastAPI) ──► Gemini, Stripe (test)
              └── /**      ──► web/dist (static SPA)
Browser ──► Firebase Auth (Google, anonymous guest and demo)
Browser ──► Firestore (users/{uid}/...) guarded by firestore.rules
```

The web app and the API share one origin, so there is no CORS in production
and the Firebase ID token travels as a normal `Authorization: Bearer` header.

## Web app

- `src/data/` is the typed Firestore layer. Every document is validated against
  its Zod schema on read and write. `financeView.ts` derives everything a
  screen shows (main-currency ledger, monthly summaries, three-month averages,
  health score, simulator baseline) in one pure function that is unit-tested.
- `src/features/` has one folder per product area: onboarding, dashboard,
  health, plan, transactions, import, subscriptions, check-in, coach, billing,
  settings and reports. Routes are lazy-loaded; the landing page never loads
  Firestore.
- Server state is managed with TanStack Query (optimistic saves), and UI
  state with Zustand. The wizard answers and coach conversation are persisted
  in sessionStorage.
- Translations live in `src/locales/{en,ar}/*.json`. A test fails when a key
  is missing in either language or used in code but not defined. Direction
  switches with the language; charts mirror their x-axis in RTL.

## Where the math lives

All finance calculations are in `shared/src/finance/` and covered by unit
tests; the rules are written down in [finance-rules.md](finance-rules.md). The
API passes computed results to the AI as structured context; the AI returns
JSON that Pydantic validates, or text. Coach calculations run in the browser:
the model asks for a tool, the browser runs it with the finance module and
returns formatted results for the model to explain.

## Data model (Firestore)

| Path                                                      | Written by | Contents                                                                 |
| --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `users/{uid}`                                             | owner      | Profile: name, main currency, manual rates, locale, budget method, flags |
| `users/{uid}/incomes, fixedCosts, debts, accounts, goals` | owner      | The household's setup                                                    |
| `users/{uid}/transactions`                                | owner      | Integer minor units only (enforced by rules)                             |
| `users/{uid}/recurring`                                   | owner      | Recurring rules with their next date                                     |
| `users/{uid}/budgets/{YYYY-MM}`                           | owner      | Budget lines per month                                                   |
| `users/{uid}/scores/{YYYY-MM}`                            | owner      | Score history, net worth, cached AI tips                                 |
| `users/{uid}/checkins/{YYYY-MM}`                          | owner      | Check-in text, answers, adjustment decisions                             |
| `users/{uid}/subscriptionPrefs/{key}`                     | owner      | "I use this" flags                                                       |
| `billing/{uid}`                                           | API only   | Plan and Stripe ids (owner can read)                                     |
| `usage/{uid}`                                             | API only   | Daily AI request counter (owner can read)                                |

## Local development

- `pnpm dev` runs the web app on :5173 and proxies `/api` to :8080.
- `pnpm api:dev` runs FastAPI on :8080 with reload.
- `pnpm emulators` starts the Auth and Firestore emulators; set
  `VITE_USE_EMULATORS=true` in `web/.env.local` to use them.
- `web/.env.e2e` builds the app against the emulators for Playwright.
