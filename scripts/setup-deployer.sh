#!/usr/bin/env bash
# One-time setup of the service account that GitHub Actions uses to deploy
# Firebase Hosting and Firestore rules. Run it as the project owner:
#
#   bash scripts/setup-deployer.sh
#
# It grants least-privilege roles, creates a JSON key, stores it as the
# FIREBASE_SERVICE_ACCOUNT secret on the GitHub repo, and deletes the local
# copy of the key. Requires gcloud and gh to be logged in.
set -euo pipefail

PROJECT="${PROJECT:-moneyflow-coach}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
SA_NAME="github-deployer"
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Project: ${PROJECT}"
echo "Repo:    ${REPO}"

if ! gcloud iam service-accounts describe "${SA}" --project "${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name "GitHub Actions deployer" --project "${PROJECT}"
fi

# Roles needed by FirebaseExtended/action-hosting-deploy for hosting + rules.
for role in \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/serviceusage.apiKeysViewer \
  roles/run.viewer; do
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member "serviceAccount:${SA}" --role "${role}" --condition=None --quiet >/dev/null
  echo "granted ${role}"
done

KEY_FILE="$(mktemp)"
trap 'rm -f "${KEY_FILE}"' EXIT
gcloud iam service-accounts keys create "${KEY_FILE}" --iam-account "${SA}" --project "${PROJECT}"

gh secret set FIREBASE_SERVICE_ACCOUNT --repo "${REPO}" < "${KEY_FILE}"
echo "stored FIREBASE_SERVICE_ACCOUNT secret on ${REPO}"

# Public Firebase web config used at build time (not secret).
APP_ID="$(firebase apps:list WEB --project "${PROJECT}" --json | python -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["appId"])')"
CONFIG="$(firebase apps:sdkconfig WEB "${APP_ID}" --project "${PROJECT}" --json | python -c 'import json,sys;print(json.dumps(json.load(sys.stdin)["result"]["sdkConfig"]))')"
set_var() { gh variable set "$1" --repo "${REPO}" --body "$(echo "${CONFIG}" | python -c "import json,sys;print(json.load(sys.stdin)['$2'])")"; }
set_var VITE_FIREBASE_API_KEY apiKey
set_var VITE_FIREBASE_AUTH_DOMAIN authDomain
set_var VITE_FIREBASE_PROJECT_ID projectId
set_var VITE_FIREBASE_STORAGE_BUCKET storageBucket
set_var VITE_FIREBASE_MESSAGING_SENDER_ID messagingSenderId
set_var VITE_FIREBASE_APP_ID appId
echo "stored VITE_FIREBASE_* repository variables"

echo "Done. Push to main to trigger the Deploy web workflow."
