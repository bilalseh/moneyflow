#!/usr/bin/env bash
# Grants the access that the GitHub Actions deploy workflows need. Run it as the
# project owner, with gcloud, gh and firebase logged in:
#
#   bash scripts/setup-deployer.sh
#
# Safe to re-run. It:
#   1. creates the github-deployer service account if missing,
#   2. grants least-privilege roles for Hosting, Firestore rules and Cloud Run,
#   3. makes the moneyflow-api Cloud Run service publicly invokable, which
#      Firebase Hosting rewrites require (the API authenticates every request
#      itself with Firebase ID tokens),
#   4. stores a key as the FIREBASE_SERVICE_ACCOUNT secret, only if it is not
#      set yet (set FORCE_KEY=1 to rotate it),
#   5. stores the public Firebase web config as repository variables,
#   6. re-runs both deploy workflows.
set -euo pipefail

PROJECT="${PROJECT:-moneyflow-coach}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
SA="github-deployer@${PROJECT}.iam.gserviceaccount.com"
RUNTIME_SA="moneyflow-api-runtime@${PROJECT}.iam.gserviceaccount.com"

echo "Project: ${PROJECT}"
echo "Repo:    ${REPO}"

retry() {
  local label="$1"
  shift
  for attempt in $(seq 1 6); do
    if "$@" >/dev/null 2>&1; then
      echo "ok: ${label}"
      return 0
    fi
    echo "retrying: ${label} (${attempt}/6)"
    sleep 5
  done
  echo "failed: ${label}" >&2
  return 1
}

# ---- 1. deployer service account -------------------------------------------
if ! gcloud iam service-accounts describe "${SA}" --project "${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create github-deployer \
    --display-name "GitHub Actions deployer" --project "${PROJECT}"
fi
# A new service account takes a few seconds to reach the IAM policy backend.
retry "deployer account visible" gcloud iam service-accounts describe "${SA}" --project "${PROJECT}"

# ---- 2. roles ---------------------------------------------------------------
project_role() {
  retry "project ${1}" gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member "serviceAccount:${SA}" --role "$1" --condition=None --quiet
}
project_role roles/firebasehosting.admin
project_role roles/firebaserules.admin
project_role roles/serviceusage.apiKeysViewer
project_role roles/serviceusage.serviceUsageConsumer
project_role roles/run.viewer
project_role roles/run.developer

retry "artifact registry writer on moneyflow repo" \
  gcloud artifacts repositories add-iam-policy-binding moneyflow \
  --location "${REGION}" --project "${PROJECT}" \
  --member "serviceAccount:${SA}" --role roles/artifactregistry.writer

retry "act as the API runtime account" \
  gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" --project "${PROJECT}" \
  --member "serviceAccount:${SA}" --role roles/iam.serviceAccountUser

# ---- 3. public invoke on the API --------------------------------------------
retry "public invoker on moneyflow-api" \
  gcloud run services add-iam-policy-binding moneyflow-api \
  --region "${REGION}" --project "${PROJECT}" \
  --member allUsers --role roles/run.invoker

# ---- 4. deployer key as a GitHub secret ---------------------------------------
if [[ "${FORCE_KEY:-0}" == "1" ]] || ! gh secret list --repo "${REPO}" | grep -q '^FIREBASE_SERVICE_ACCOUNT\b'; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "${KEY_FILE}"' EXIT
  gcloud iam service-accounts keys create "${KEY_FILE}" --iam-account "${SA}" --project "${PROJECT}"
  gh secret set FIREBASE_SERVICE_ACCOUNT --repo "${REPO}" < "${KEY_FILE}"
  echo "ok: stored FIREBASE_SERVICE_ACCOUNT secret"
else
  echo "ok: FIREBASE_SERVICE_ACCOUNT already set (FORCE_KEY=1 to rotate)"
fi

# ---- 5. public Firebase web config as repository variables ---------------------
APP_ID="$(firebase apps:list WEB --project "${PROJECT}" --json \
  | python -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["appId"])')"
CONFIG="$(firebase apps:sdkconfig WEB "${APP_ID}" --project "${PROJECT}" --json \
  | python -c 'import json,sys;print(json.dumps(json.load(sys.stdin)["result"]["sdkConfig"]))')"
set_var() {
  local value
  value="$(echo "${CONFIG}" | python -c "import json,sys;print(json.load(sys.stdin)['$2'])")"
  gh variable set "$1" --repo "${REPO}" --body "${value}"
}
set_var VITE_FIREBASE_API_KEY apiKey
set_var VITE_FIREBASE_AUTH_DOMAIN authDomain
set_var VITE_FIREBASE_PROJECT_ID projectId
set_var VITE_FIREBASE_STORAGE_BUCKET storageBucket
set_var VITE_FIREBASE_MESSAGING_SENDER_ID messagingSenderId
set_var VITE_FIREBASE_APP_ID appId
echo "ok: stored VITE_FIREBASE_* repository variables"

# ---- 6. re-run the deploys -------------------------------------------------------
gh workflow run "Deploy API" --repo "${REPO}"
gh workflow run "Deploy web" --repo "${REPO}"
echo "Triggered Deploy API and Deploy web. Follow them with: gh run list --limit 3"
