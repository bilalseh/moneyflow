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

The script creates the `github-deployer` service account, grants it Firebase
Hosting Admin, Firebase Rules Admin, API Keys Viewer and Cloud Run Viewer,
stores its key as the `FIREBASE_SERVICE_ACCOUNT` secret, and stores the
`VITE_FIREBASE_*` repository variables.

Manual deploy from a laptop:

```bash
pnpm --filter @moneyflow/web build
firebase deploy --only hosting,firestore:rules
```

## API (Cloud Run)

Automatic on pushes to `main` that touch `api/`, via
`.github/workflows/deploy-api.yml`. Prerequisites, done once the project is on
the Blaze plan:

1. Enable APIs: `gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com`
2. Create the image repository: `gcloud artifacts repositories create moneyflow --repository-format=docker --location=us-central1`
3. Store the Gemini key: `echo -n "$KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-`
4. Grant the `github-deployer` service account Cloud Run Admin, Artifact
   Registry Writer and Service Account User, and store its key as the
   `GCP_SERVICE_ACCOUNT` secret.
5. Add the Hosting rewrite to `firebase.json` so `/api/**` reaches the service
   (Hosting refuses the rewrite while the Cloud Run API is disabled, which is
   why it is not there yet):

   ```json
   { "source": "/api/**", "run": { "serviceId": "moneyflow-api", "region": "us-central1" } }
   ```

   Place it before the catch-all `**` rewrite. The web app then reaches the API
   same-origin without any frontend change.

## Budget

Set a budget alert on the billing account before enabling Blaze. Cloud Run
with `--min-instances 0` and `--max-instances 2` plus the Firestore and
Hosting free tiers keeps a portfolio app at zero cost under normal traffic.
