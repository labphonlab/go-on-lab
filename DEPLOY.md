# Deployment guide

This system is designed to run as a single Next.js application backed by a
pluggable storage layer. Two storage backends ship with the codebase:

| `STORAGE_BACKEND` | Use case |
|---|---|
| `filesystem` (default) | Local development, single-host VPS, university lab server |
| `firestore` | Google Cloud Run / App Engine / GKE, multi-host |

## Environment variables

| Name | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Researcher login password (≥ 6 chars; use ≥ 16 in production). |
| `ADMIN_SECRET` | recommended | 32+ char secret for cookie HMAC. Auto-generated and persisted to the storage backend on first run if absent — set this explicitly when you have more than one instance. |
| `STORAGE_BACKEND` | no | `filesystem` (default) or `firestore`. |
| `EXPERIMENT_DATA_DIR` | no | (`filesystem` only) Path to persistent volume. Defaults to `./data`. |
| `GOOGLE_CLOUD_PROJECT` | no | (`firestore` only) Inferred automatically on Cloud Run. |
| `FIRESTORE_DATABASE_ID` | no | (`firestore` only) Defaults to `(default)`. |
| `FIRESTORE_COLLECTION_PREFIX` | no | (`firestore` only) Defaults to `go_on_lab_`. Use to share one Firestore DB between staging and prod. |

## Recommended cloud deployment: Google Cloud Run + Firestore (asia-northeast1 / Tokyo)

This is the recommended setup for university research targeting Japanese
students. Data residency is in Japan, encryption at rest and IAM are
default-on, audit logs are available, and the per-row delete model maps
cleanly to APPI / GDPR right-to-erasure requests.

### One-time setup

```bash
# 1. Create / select a project in Tokyo
gcloud projects create go-on-lab-prod
gcloud config set project go-on-lab-prod

# 2. Enable the APIs you need
gcloud services enable \
    run.googleapis.com \
    firestore.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com

# 3. Create Firestore in the Tokyo region (one-time, irreversible)
gcloud firestore databases create \
    --location=asia-northeast1 \
    --type=firestore-native

# 4. Store the admin password and cookie secret in Secret Manager
printf "%s" "$(openssl rand -base64 32)" | \
    gcloud secrets create go-on-lab-admin-password --data-file=-
printf "%s" "$(openssl rand -hex 32)" | \
    gcloud secrets create go-on-lab-admin-secret --data-file=-

# 5. Create a runtime service account and grant Firestore access
gcloud iam service-accounts create go-on-lab-runner \
    --display-name="Go-on Lab Cloud Run runtime"

PROJECT=$(gcloud config get-value project)
SA=go-on-lab-runner@${PROJECT}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$SA" \
    --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding go-on-lab-admin-password \
    --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding go-on-lab-admin-secret \
    --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

### Build and deploy

```bash
# Build & push the image to Artifact Registry
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/$PROJECT/app/go-on-lab .

# Deploy to Cloud Run, asia-northeast1, with secrets injected
gcloud run deploy go-on-lab \
    --image asia-northeast1-docker.pkg.dev/$PROJECT/app/go-on-lab \
    --region asia-northeast1 \
    --platform managed \
    --service-account $SA \
    --set-env-vars STORAGE_BACKEND=firestore,NODE_ENV=production \
    --set-secrets ADMIN_PASSWORD=go-on-lab-admin-password:latest,ADMIN_SECRET=go-on-lab-admin-secret:latest \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --allow-unauthenticated \
    --port 8080
```

Cloud Run will return a URL like
`https://go-on-lab-xxxxxx-an.a.run.app`. Participants visit `/e/<id>`;
researchers log in at `/admin`.

### Custom domain

```bash
gcloud run domain-mappings create \
    --service go-on-lab \
    --domain experiments.your-lab.example.jp \
    --region asia-northeast1
```

### Recommended hardening

- **Tighten IAM**: the only roles the runtime SA needs are
  `roles/datastore.user` and `roles/secretmanager.secretAccessor`. Do
  not grant project-owner.
- **VPC egress none / private**: this app does not call out to anything
  except Firestore. Configure egress to "private ranges only" on
  Cloud Run.
- **Log retention**: keep Cloud Run access logs to the minimum needed.
  IP addresses appear in `httpRequest.remoteIp` — if your IRB forbids
  this, exclude that field with a log sink filter or set log
  retention to 7–30 days.
- **Backups**: Firestore has point-in-time recovery (PITR); enable it
  for a 7-day window:
  ```bash
  gcloud firestore databases update --enable-pitr
  ```
- **Soft-deletes**: the admin UI's "撤回" button sets `deletedAt` instead
  of erasing. For genuine erasure requests, delete the document in the
  Firestore console — `collectionPrefix__results__<expId>/<docId>` —
  and document the action in your audit log.

## Alternative: single-host (VPS / lab workstation)

For a small lab study you can run the same image on a single Linux host:

```bash
docker build -t go-on-lab .
docker run -d \
    --name go-on-lab \
    -p 80:8080 \
    -v /var/lib/go-on-lab:/app/data \
    -e ADMIN_PASSWORD="$(cat /etc/go-on-lab/password)" \
    -e ADMIN_SECRET="$(cat /etc/go-on-lab/secret)" \
    -e STORAGE_BACKEND=filesystem \
    -e EXPERIMENT_DATA_DIR=/app/data \
    --restart=unless-stopped \
    go-on-lab
```

Put a TLS terminator in front (Cloudflare Tunnel, Caddy, or nginx).

## What is logged where

| Surface | Contains | Retention |
|---|---|---|
| Cloud Run request log | timestamp, path, status, IP, UA | configurable; default 30 days |
| App stdout/stderr | no PII; idempotency keys are opaque | configurable |
| Firestore results | participantId (opaque `P-…`), trial data, demographics | until manual deletion |
| Firestore admin secrets | HMAC secret only | until manual deletion |
| Cookie | HMAC token (no user data) | 12 h |

The application never logs participant identifiers, IP addresses, or
demographic fields to stdout. If you need an IP-free deployment, exclude
`httpRequest.remoteIp` in the Cloud Run log router.

## Scientific-rigor guarantees (what the system enforces)

- **Server-set `receivedAt`** on every result. Client clocks are also
  preserved (`startedAt`, `completedAt`) but the server clock is the
  authoritative one for ordering.
- **SHA-256 hash** of the canonical payload is computed by the server,
  echoed in the response, and stored alongside the record. Researchers
  can verify integrity later by re-hashing.
- **Idempotency**: clients send an `Idempotency-Key` header (UUID derived
  from `participantId__startedAt`). A retry returns
  `{ duplicated: true }` with the original `sha256`/`filename`; no
  duplicate row is created.
- **localStorage backup**: if the network fails on submit, the result is
  written to `localStorage` under `go_on_lab__queued_result__<pid>`. The
  client retries with exponential backoff (≤ 5 attempts, ≤ 30 s each).
- **Append-only writes**: the storage layer uses `create` (not `set`)
  with idempotency-key dedup; an existing record cannot be silently
  overwritten.
- **Soft-deletes**: row deletion via the admin UI sets `deletedAt` and
  hides the row from listings/exports but keeps the data for audit.

## Cost guidance (Cloud Run + Firestore @ Tokyo, ~100 participants/month)

- Cloud Run: scales to zero; expected billable usage well under the
  monthly free tier (180k vCPU-s, 360k GiB-s).
- Firestore: ~1 doc/participant + ~20 reads/admin visit; comfortably
  under the 50k reads/20k writes/day free tier.
- Secret Manager: 6 active secret versions, $0.06/month.
- Egress: trivial for this workload.

Realistic monthly bill for a research lab: **¥0–500**.
