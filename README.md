# Secret Santa v2 — Backend API

Party-based gift exchange platform. Users create parties, invite participants by email, manage gift wish-lists, lock the party, and trigger automatic or manual gift assignments. Authentication is handled through Auth0 OIDC; email delivery is fully event-driven via AWS SES.

---

## Architecture

```
Browser
  │
  ├─── HTTPS ──► ALB
  │                └─► ECS (Express API — this repo)
  │                      ├── Auth0 OIDC (login / callback / logout)
  │                      ├── DynamoDB (Parties, PartyMembers, Invitations, Assignments)
  │                      └── SSM Parameter Store (Auth0 credentials)
  │
  └─── invitation email ──► SES
                              ▲
                    DynamoDB Invitations stream
                      └─► EventBridge Pipe
                            └─► Emailer Lambda (lambdas/emailer/)
                                  ├── S3 (email content templates)
                                  └── SES
```

### Key design decisions

- **Cookie-based JWT** — After login, Auth0 issues an `access_token` that is stored as an `HttpOnly Secure SameSite=None` cookie. All protected routes validate this cookie via the Auth0 JWKS endpoint. Bearer header auth is not supported.
- **Custom claim** — An Auth0 Post-Login Action sets `registered_user_email` as a custom claim in the access token. All routes read the caller's identity from this claim.
- **Self-authorization** — All `/members/{member_id}` routes enforce that the caller's JWT email matches the URL-encoded `member_id`. Mismatches return HTTP 403.
- **Event-driven email** — The web API never sends emails directly. Creating an invitation writes to DynamoDB; the DynamoDB Stream triggers EventBridge Pipes which invokes the Emailer Lambda.
- **HTTPS required** — `BASE_URL` must use `https://` in all environments, including local development. Auth0 does not allow `localhost` as a redirect URI; use `127.0.0.1`.

---

## Project structure

```
.
├── src/
│   ├── auth/           # Auth0 OIDC middleware and JWT cookie validation
│   ├── controllers/    # Express route handlers (one file per resource)
│   ├── models/         # TypeScript interfaces for domain objects
│   ├── services/       # Business logic (DynamoDB, SNS)
│   └── utils/          # Config (SSM), DynamoDB client, logger, error handler
├── lambdas/
│   └── emailer/        # Standalone Lambda + its own package.json and tests
├── terraform/          # AWS infrastructure (DynamoDB, S3, EventBridge, Lambda, IAM)
├── tests/
│   ├── unit/           # Unit tests (mocked AWS / Auth0)
│   ├── integration/    # Integration tests (real AWS resources)
│   └── contract/       # Contract / acceptance tests
├── docs/
│   └── openapi.yaml    # OpenAPI 3.0 spec for all API endpoints
└── specs/              # Feature specifications, plans, and task lists
```

---

## Prerequisites

- Node.js ≥ 22 (`nvm use 22`)
- AWS credentials configured (`~/.aws/credentials` or environment variables)
- AWS SSM parameters provisioned (see [SSM Parameters](#ssm-parameters))
- Auth0 tenant with an API and a Post-Login Action that sets `registered_user_email`
- For local HTTPS: a self-signed certificate (see [Local development](#local-development))

---

## SSM Parameters

The API reads all Auth0 credentials from AWS SSM Parameter Store at startup. Provision these before running the server:

| SSM Path | Type | Description |
|---|---|---|
| `/secret-santa/auth0/domain` | String | Auth0 tenant domain (e.g. `your-tenant.auth0.com`) |
| `/secret-santa/auth0/client_id` | String | OAuth client ID |
| `/secret-santa/auth0/client_secret` | SecureString | OAuth client secret |
| `/secret-santa/auth0/audience` | String | API audience identifier |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | Yes | — | Cookie session encryption secret (min 32 chars) |
| `BASE_URL` | Yes | `https://127.0.0.1:8080` | Application base URL. Must use `https://`. |
| `SSL_KEY_PATH` | Yes (HTTPS) | — | Path to TLS private key (PEM) |
| `SSL_CERT_PATH` | Yes (HTTPS) | — | Path to TLS certificate (PEM) |
| `AWS_REGION` | No | `us-east-1` | AWS region for DynamoDB/SSM/SNS |

---

## Local development

### Install dependencies

```sh
nvm use 22
npm install
```

### Generate a self-signed TLS certificate

The frontend dev server runs on `localhost`. Generate a cert with `localhost` as the CN and SAN:

```sh
openssl req -x509 -newkey rsa:2048 -keyout localhost-key.pem -out localhost.pem -days 365 -nodes \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"
```

Then trust it in the macOS keychain so browsers accept it without a warning:

```sh
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db localhost.pem
```

### Register the Auth0 callback URL

In the [Auth0 dashboard](https://manage.auth0.com/) → Applications → your application → Settings:

- **Allowed Callback URLs**: add `https://localhost:3000/api/auth/callback`
- **Allowed Logout URLs**: add `https://localhost:3000`

### Set environment variables

```sh
export SESSION_SECRET="<at-least-32-random-characters>"
export BASE_URL="https://localhost:3000"
export SSL_KEY_PATH="$(pwd)/localhost-key.pem"
export SSL_CERT_PATH="$(pwd)/localhost.pem"
export AWS_REGION="us-east-1"
```

### Start the API server

```sh
npm start
```

The server starts on `https://127.0.0.1:8080`. All routes are mounted under `/api`.

---

## Build

Compile TypeScript to `dist/`:

```sh
npm run build
```

---

## Testing

### Unit tests

```sh
npm test
```

Coverage is reported to `coverage/`. The project targets ≥ 90% statement and branch coverage.

### Emailer Lambda tests

```sh
cd lambdas/emailer
npm test
```

### Integration tests

Integration tests run against real AWS resources and require valid credentials and provisioned infrastructure:

```sh
npm test -- --testPathPattern=tests/integration
```

### Contract tests

```sh
npm test -- --testPathPattern=tests/contract
```

---

## API reference

The full OpenAPI 3.0 specification is at [docs/openapi.yaml](docs/openapi.yaml).

### Endpoint summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check |
| `GET` | `/api/auth/login` | None | Initiate Auth0 login |
| `GET` | `/api/auth/callback` | None | Auth0 OIDC callback |
| `GET` | `/api/auth/logout` | None | Logout |
| `GET` | `/api/parties/:party_id/invitations/:token` | OIDC session | Accept invitation magic link |
| `POST` | `/api/parties` | Cookie JWT | Create a party |
| `POST` | `/api/parties/:party_id/invitations` | Cookie JWT | Send an invitation |
| `GET` | `/api/parties/:party_id/members/:member_id/profile` | Cookie JWT (self) | Get member profile |
| `PUT` | `/api/parties/:party_id/members/:member_id/profile` | Cookie JWT (self) | Update member profile |
| `POST` | `/api/parties/:party_id/members/:member_id/gifts` | Cookie JWT (self) | Submit gift wish-list |
| `POST` | `/api/parties/:party_id/lock` | Cookie JWT (admin) | Lock the party |
| `POST` | `/api/parties/:party_id/assignments` | Cookie JWT (admin) | Create gift assignments |

---

## Emailer Lambda

See [lambdas/emailer/README.md](lambdas/emailer/README.md) for setup, environment variables, packaging, and deployment instructions.

---

## Infrastructure (Terraform)

Terraform configuration is in `terraform/`. State is stored in S3 (`secret-santa-rvw-tfstate`).

### First-time setup — provision state backend

Before using the main Terraform config for the first time, bootstrap the remote state resources:

```sh
cd terraform/bootstrap
terraform init
terraform apply
```

This creates the `secret-santa-rvw-tfstate` S3 bucket (versioned, encrypted) and the `secret-santa-tfstate-lock` DynamoDB table used for state locking.

### Migrate existing local state

If you have an existing `terraform/terraform.tfstate`, migrate it to S3:

```sh
cd terraform
terraform init -migrate-state
```

### Resources provisioned

- DynamoDB tables: `Parties`, `PartyMembers`, `Invitations`, `Assignments`
- S3 bucket for email content templates
- EventBridge Pipe (`secret-santa-new-invitation-record`)
- Emailer Lambda (`secret-santa-emailer`) with IAM role and SES permissions

### Deploy

```sh
cd terraform
terraform init
terraform plan \
  -var="ses_from_address=<verified-sender@example.com>" \
  -var="invitation_base_url=https://<your-api-domain>/api"
terraform apply \
  -var="ses_from_address=<verified-sender@example.com>" \
  -var="invitation_base_url=https://<your-api-domain>/api"
```

### Variables

| Variable | Default | Description |
|---|---|---|
| `aws_region` | `us-east-1` | AWS region |
| `environment` | `dev` | Deployment environment (`dev`, `prod`) |
| `ses_from_address` | — | SES-verified sender email address |
| `invitation_base_url` | `https://127.0.0.1:8080/api` | Base URL prepended to invitation magic links |
