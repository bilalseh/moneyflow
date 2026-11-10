#!/usr/bin/env bash
# Gives the API's Cloud Run runtime identity what it needs, and stores the API
# secrets in Secret Manager. Run once as the project owner (safe to re-run):
#
#   GEMINI_API_KEY=... STRIPE_SECRET_KEY=sk_test_... bash scripts/setup-runtime.sh
#
# Every variable is optional; leave one out to skip that secret. Values are
# read from the environment (or prompted for without echo) and never printed.
#
#   GEMINI_API_KEY         Google AI Studio key. Create it in a project WITHOUT
#                          billing so it stays on the free tier.
#   STRIPE_SECRET_KEY      Stripe TEST key (sk_test_...). Live keys are refused.
#   STRIPE_WEBHOOK_SECRET  Optional whsec_... for the /api/billing/webhook route.
set -euo pipefail

PROJECT="${PROJECT:-moneyflow-coach}"
REGION="${REGION:-us-central1}"
SERVICE="moneyflow-api"
RUNTIME_SA="moneyflow-api-runtime@${PROJECT}.iam.gserviceaccount.com"
DEPLOYER_SA="github-deployer@${PROJECT}.iam.gserviceaccount.com"

gcloud services enable secretmanager.googleapis.com --project "${PROJECT}" >/dev/null
echo "ok: Secret Manager API enabled"

# Firestore reads and writes (usage counter, plan, account deletion) and
# deleting the Firebase Auth user when someone deletes their account.
for role in roles/datastore.user roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member "serviceAccount:${RUNTIME_SA}" --role "${role}" --condition=None --quiet >/dev/null
  echo "ok: runtime ${role}"
done

if [[ -z "${GEMINI_API_KEY:-}" && -t 0 ]]; then read -r -s -p "Gemini API key (enter to skip): " GEMINI_API_KEY; echo; fi
if [[ -z "${STRIPE_SECRET_KEY:-}" && -t 0 ]]; then read -r -s -p "Stripe TEST secret key (enter to skip): " STRIPE_SECRET_KEY; echo; fi
if [[ -n "${STRIPE_SECRET_KEY:-}" && "${STRIPE_SECRET_KEY}" != sk_test_* ]]; then
  echo "Refusing: STRIPE_SECRET_KEY must be a test key starting with sk_test_" >&2
  exit 1
fi

bindings=()
store_secret() {
  local name="$1" env_var="$2" value="$3"
  [[ -z "${value}" ]] && { echo "skip: ${name} (not provided)"; return; }
  if gcloud secrets describe "${name}" --project "${PROJECT}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project "${PROJECT}" >/dev/null
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --replication-policy=automatic --project "${PROJECT}" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "${name}" --project "${PROJECT}" \
    --member "serviceAccount:${RUNTIME_SA}" --role roles/secretmanager.secretAccessor >/dev/null
  # The deployer only needs to see that the secret exists, never its value.
  gcloud secrets add-iam-policy-binding "${name}" --project "${PROJECT}" \
    --member "serviceAccount:${DEPLOYER_SA}" --role roles/secretmanager.viewer >/dev/null
  bindings+=("${env_var}=${name}:latest")
  echo "ok: secret ${name}"
}

store_secret GEMINI_API_KEY MONEYFLOW_GEMINI_API_KEY "${GEMINI_API_KEY:-}"
store_secret STRIPE_SECRET_KEY MONEYFLOW_STRIPE_SECRET_KEY "${STRIPE_SECRET_KEY:-}"
store_secret STRIPE_WEBHOOK_SECRET MONEYFLOW_STRIPE_WEBHOOK_SECRET "${STRIPE_WEBHOOK_SECRET:-}"

if [[ ${#bindings[@]} -gt 0 ]]; then
  joined="$(IFS=,; echo "${bindings[*]}")"
  gcloud run services update "${SERVICE}" --region "${REGION}" --project "${PROJECT}" \
    --update-secrets "${joined}" --quiet >/dev/null
  echo "ok: ${SERVICE} now reads ${joined%%=*} and friends from Secret Manager"
fi

echo "Done. Check: curl -s https://${PROJECT}.web.app/api/health"
