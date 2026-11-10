# Deployment

Everything runs in the Firebase / Google Cloud project `moneyflow-coach`.

## Web (Firebase Hosting)

Automatic on every push to `main` that touches `web/`, `shared/` or the
Firebase config, via `.github/workflows/deploy-web.yml`. The workflow builds
the SPA with the public Firebase web config from repository variables and
deploys hosting plus Firestore rules with a service account.

One-time setup (project owner, with `gcloud`, `gh` and `firebase` logged in):

```bash
bash scripts/setup-deployer.sh
```

The script is safe to re-run. It creates the `github-deployer` service
account and grants it only what the two deploy workflows need:

| Role                     | Scope                        | Why                                       |
| ------------------------ | ---------------------------- | ----------------------------------------- |
| Firebase Hosting Admin   | project                      | Release Hosting versions                  |
| Firebase Rules Admin     | project                      | Release Firestore rules                   |
| API Keys Viewer          | project                      | Firebase CLI reads the web API key        |
| Service Usage Consumer   | project                      | Firebase CLI checks which APIs are on     |
| Cloud Run Viewer         | project                      | Hosting validates the `/api/**` rewrite   |
| Cloud Run Developer      | project                      | Deploy new API revisions                  |
| Artifact Registry Writer | `moneyflow` repository only  | Push API images                           |
| Service Account User     | `moneyflow-api-runtime` only | Run revisions as the API runtime identity |

It also makes the `moneyflow-api` service publicly invokable, which Hosting
rewrites require. The rule for the API is that every route except
`/api/health` verifies a Firebase ID token itself. Finally it stores the deployer key as the
`FIREBASE_SERVICE_ACCOUNT` secret (only when missing, `FORCE_KEY=1` rotates
it), stores the `VITE_FIREBASE_*` repository variables, and re-runs both
deploy workflows.

Manual deploy from a laptop:

```bash
pnpm --filter @moneyflow/web build
firebase deploy --only hosting,firestore:rules
```

## API (Cloud Run)

Automatic on pushes to `main` that touch `api/`, via
`.github/workflows/deploy-api.yml`. The workflow builds the image on the
runner, pushes it to Artifact Registry, deploys a new revision and curls
`/api/health`.

| Resource         | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Service          | `moneyflow-api`, region `us-central1`                               |
| Runtime identity | `moneyflow-api-runtime` (no roles yet; Firestore access in phase 6) |
| Image repository | `us-central1-docker.pkg.dev/moneyflow-coach/moneyflow`              |
| Image retention  | Cleanup policy keeps the 5 most recent images                       |
| Scaling          | 0 to 2 instances, concurrency 40, 512 MiB                           |

Firebase Hosting rewrites `/api/**` to the service, so the web app reaches it
same-origin. The direct `run.app` URL also works.

### Runtime access and secrets (one time)

```bash
bash scripts/setup-runtime.sh
```

The script prompts for each value without echoing it (or reads it from the
environment) and is safe to re-run.

| Grant or secret                        | Why                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Runtime: Cloud Datastore User          | Daily usage counter, plan record, account deletion                       |
| Runtime: Firebase Authentication Admin | Delete the sign-in when a user deletes their account                     |
| Secret `GEMINI_API_KEY`                | Gemini free tier. Create it in AI Studio under a project without billing |
| Secret `STRIPE_SECRET_KEY`             | Stripe test key; anything not starting with `sk_test_` is refused        |
| Secret `STRIPE_WEBHOOK_SECRET`         | Optional; checkout is confirmed server-side without it                   |

Each secret is readable only by the runtime identity; the deployer can see it
exists but not its value. The script binds the secrets to the service, and the
deploy workflow uses `--update-env-vars`, so later deploys keep the bindings.

Until the runtime roles exist, the API cannot read the quota or plan, so AI
requests fail; the web app then shows its built-in tips, keeps keyword
categories, and deletes accounts from the browser. With the roles but no
Gemini key, the API serves deterministic fallback text. Without a Stripe test
key, checkout shows "not configured".

## Cost guardrails

A Google Cloud budget sends alerts; it does not stop spending. The real caps
are in the configuration:

- Cloud Run scales to zero and never runs more than 2 instances.
- The image cleanup policy keeps Artifact Registry inside its free storage.
- Hosting, Firestore and Auth stay on their free quotas at portfolio traffic.
