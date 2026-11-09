# Moneyflow

A personal money coach. Understand your money, plan for goals and build better
habits, with an AI coach that explains, plans and checks in every month.

> Educational tool, not financial advice.

**Live demo:** https://moneyflow-coach.web.app

## Status

Phase 1 of 10: monorepo, tooling, CI and the deployed empty shell. See
[docs/architecture.md](docs/architecture.md) for the system overview and
[docs/decisions](docs/decisions) for the decision records.

## What makes it more than a chat

- It keeps your numbers and tracks real spending against the plan.
- Every total, projection, goal timeline and debt payoff is computed by
  deterministic, unit-tested code. The AI only explains and suggests.
- It simulates what-if scenarios instantly and follows up month after month.
- No bank connections. You enter or import (CSV) your own data.

## Repository layout

```
web/      React 19 + TypeScript + Vite + Tailwind v4
api/      Python 3.12 + FastAPI, Docker, deployed to Cloud Run
shared/   Framework-free types, currency table, money primitives (Zod)
docs/     Architecture, finance rules, decision records
```

## Run locally

Requirements: Node 22, pnpm 10, uv, Java 21 (for the Firebase emulators).

```bash
pnpm install
cp web/.env.example web/.env.local      # fill in the Firebase web config
pnpm dev                                 # web on http://localhost:5173

cd api && uv sync && cp .env.example .env && cd ..
pnpm api:dev                             # API on http://localhost:8080/api/docs
```

Quality gates:

```bash
pnpm lint && pnpm typecheck && pnpm test     # web + shared
pnpm api:lint && pnpm api:test               # api
pnpm --filter @moneyflow/web e2e             # Playwright smoke
firebase emulators:exec --only firestore "pnpm rules:test"
```

## Deploy

Pushes to `main` run CI, then deploy the web app to Firebase Hosting and the
API to Cloud Run. See `.github/workflows/`.

## License

MIT
