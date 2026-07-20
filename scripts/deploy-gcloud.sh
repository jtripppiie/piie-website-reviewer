#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID first.}"
REGION="${REGION:-us-east1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"
SERVICE="${SERVICE:-piie-web-reviewer}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-piie-reviewer-runner}"
BUCKET="${GCS_BUCKET:-${PROJECT_ID}-piie-reviewer-uploads}"
SA_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com

if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' --location="$FIRESTORE_LOCATION" --type=firestore-native --delete-protection
fi

if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
fi

if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT" --display-name="PIIE Reviewer Cloud Run"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA_EMAIL}" --role="roles/datastore.user" --quiet
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.objectAdmin" --quiet

upsert_secret() {
  local secret_name="$1"
  local prompt="$2"
  local value
  if ! gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" --replication-policy=automatic
  fi
  read -r -s -p "$prompt: " value
  printf '\n'
  if [[ -z "$value" ]]; then
    echo "$prompt cannot be empty." >&2
    exit 1
  fi
  printf '%s' "$value" | gcloud secrets versions add "$secret_name" --data-file=-
  gcloud secrets add-iam-policy-binding "$secret_name" --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --quiet
}

upsert_secret piie-admin-password "Admin password"
upsert_secret piie-review-username "Reviewer username"
upsert_secret piie-review-password "Reviewer password"

gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --execution-environment=gen2 \
  --allow-unauthenticated \
  --concurrency=1 \
  --max-instances=1 \
  --min-instances=0 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=900 \
  --set-env-vars="NODE_ENV=production,STORAGE_BACKEND=google,GCS_BUCKET=${BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-secrets="ADMIN_PASSWORD=piie-admin-password:latest,REVIEW_USERNAME=piie-review-username:latest,REVIEW_PASSWORD=piie-review-password:latest"

gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)'
