#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-${PROJECT_ID:-}}"
RUNTIME_SA="${2:-${RUNTIME_SA:-}}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <PROJECT_ID> [RUNTIME_SERVICE_ACCOUNT_EMAIL]"
  echo "Example: $0 my-gcp-project my-cloud-run-sa@my-gcp-project.iam.gserviceaccount.com"
  exit 1
fi

SECRETS=(
  GEMINI_API_KEY
  JWT_SECRET
  ADMIN_API_KEY
  CAPTCHA_SECRET_KEY
  CAPTCHA_BYPASS_TOKEN
)

create_secret_if_missing() {
  local secret_name="$1"
  if gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "Secret exists: $secret_name"
  else
    echo "Creating secret: $secret_name"
    gcloud secrets create "$secret_name" \
      --project "$PROJECT_ID" \
      --replication-policy="automatic" >/dev/null
  fi
}

add_secret_version() {
  local secret_name="$1"
  local value="${!secret_name:-}"

  if [[ -z "$value" ]]; then
    read -r -s -p "Enter value for $secret_name (leave empty to skip): " value
    echo
  fi

  if [[ -z "$value" ]]; then
    echo "Skipped version add for $secret_name"
    return
  fi

  printf "%s" "$value" | gcloud secrets versions add "$secret_name" \
    --project "$PROJECT_ID" \
    --data-file=- >/dev/null

  echo "Added new version for $secret_name"
}

grant_runtime_access_if_requested() {
  local secret_name="$1"

  if [[ -z "$RUNTIME_SA" ]]; then
    return
  fi

  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project "$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" >/dev/null

  echo "Granted secret access on $secret_name to $RUNTIME_SA"
}

echo "Using project: $PROJECT_ID"
if [[ -n "$RUNTIME_SA" ]]; then
  echo "Runtime service account: $RUNTIME_SA"
else
  echo "Runtime service account not provided; skipping IAM grants."
fi

echo
for secret in "${SECRETS[@]}"; do
  create_secret_if_missing "$secret"
  add_secret_version "$secret"
  grant_runtime_access_if_requested "$secret"
  echo
 done

echo "Secret setup complete."
echo "Next: gcloud builds submit --config cloudbuild.private.yaml --substitutions _SERVICE=chromasnap-server,_REGION=us-central1,_GCP_LOCATION=us-central1"
