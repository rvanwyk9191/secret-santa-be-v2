# Research: Single-EC2 Deployment

Design questions are resolved below using repository evidence and established platform behavior. No live AWS configuration has been inspected.

## Compute And OS

- **Decision**: One `t3.micro`, Ubuntu 24.04 LTS amd64, 16 GiB encrypted gp3 disk, 2 GiB swap and existing public subnet with Internet Gateway routing. Require IMDSv2 and SSM administration.
- **Rationale**: The requested instance has 1 GiB RAM and burstable CPU. Swap/sequential installs reduce install-time OOM risk. Public routing avoids a NAT gateway for SDK calls, Auth0, downloads and ACME.
- **Alternatives considered**: ECS/ALB adds infrastructure beyond the request. Larger instances violate the requested size. Amazon Linux needs a different installer. A DynamoDB gateway endpoint is an optional later optimization, not a prerequisite for HTTPS access to regional endpoints.

## Runtime And Bootstrap

- **Decision**: Preserve root `npm run start`: `tsx backend/src/controllers/index.ts` plus frontend Vite through `concurrently`. Install both tracked lockfiles with `--include=dev`. Pin Node 25.8.2 per the constitution and verify the archive checksum.
- **Rationale**: tsx/Vite/concurrently are required runtime development dependencies. The backend needs a persistent session secret, Auth0 SSM values and TLS files. Systemd explicitly loads the environment file; npm does not load it itself.
- **Alternatives considered**: Node 24 LTS is preferable for maintenance but changes the mandated version. Node 25 is non-LTS and end-of-life by this deployment date; a repository-wide upgrade is a separate follow-up. Nginx static frontend serving reduces runtime memory but changes the requested existing command. This deployment is not a production-hardening endorsement of Vite's development server.

## DNS And HTTPS

- **Decision**: Elastic IP plus Route 53 A record for `secretsanta.reinhardtvanwyk.com`. External DNS ownership by default; Terraform ownership requires explicit import. Nginx handles public ACME TLS and proxies to Vite HTTPS on loopback; Vite retains its `/api` HTTPS backend proxy.
- **Rationale**: EIP survives stop/start and can be reassociated on replacement. CNAME cannot contain an IP. Both existing servers read `SSL_KEY_PATH`/`SSL_CERT_PATH`; a local certificate covering `localhost`/`127.0.0.1` satisfies them without sharing public private keys. Nginx verifies that upstream certificate. Vite's existing backend proxy uses `secure: false` for loopback self-signed TLS; this preserved behavior is not full upstream certificate validation.
- **Alternatives considered**: ALB/ACM adds a load balancer. A non-exported ACM certificate cannot simply be installed on Nginx. Exposing 3000/8080 or using an ephemeral public IP breaks the stable HTTPS origin. DNS-01 needs extra Route 53 write permissions; HTTP-01 only needs port 80.

## AWS Access

- **Decision**: SDK default credentials use the instance profile. Scope DynamoDB actions to the five existing tables and required indexes; SSM reads to four Auth0 parameters; SNS to the configured topic. Include conditional customer-key KMS decrypt and SSM managed-instance administration.
- **Rationale**: `backend/src/utils/dynamodb.ts` and `config.ts` already use `AWS_REGION` and SDK clients. Services use item reads/writes, queries, scans and PartyMembers `party_id-index`. A valid role also requires network egress to regional endpoints.
- **Alternatives considered**: Static IAM keys add secret storage. Broad DynamoDB/KMS permissions violate least privilege. AWS CLI is unnecessary for npm start because the app uses the SDK.

## Lifecycle

- **Decision**: Separate install, staged-release deploy/health-check and DNS-dependent HTTPS phases. Preserve the environment file and public TLS config on reruns. Use systemd/journald and certbot renewal hooks.
- **Rationale**: User data runs before manual DNS updates. Private repository transport must not embed credentials in user data. Explicit health failures expose missing IAM/SSM/runtime configuration.
- **Alternatives considered**: Monolithic user data waiting for DNS is fragile. Automatic Git clones assume repository visibility and unreviewed branch state. Infrastructure apply/DNS replacement is outside planning scope.

## Merge-To-Main Delivery

- **Decision**: PR/main build-and-test checks, exact-commit source archive for the existing tsx/Vite runtime, GitHub production environment, Terraform-created repository-scoped OIDC role, private encrypted S3 transport and SSM Run Command. AWS CLI on the instance downloads artifacts with instance-profile credentials. Verify SHA-256 before extraction and serialize release switches with workflow concurrency and a host lock.
- **Rationale**: OIDC avoids long-lived credentials and SSM avoids port 22/SSH keys. Git archive excludes untracked build certificates/dependencies. Build validation precedes packaging even though the preserved npm start command still consumes source. The remote result and public HTTPS checks must pass before GitHub reports success. A retained previous checkout permits automatic rollback of failed internal deployment without changing configuration/secrets.
- **Alternatives considered**: SCP requires SSH access/keys. Git pull directly on EC2 needs repository credentials and risks unreviewed working-tree state. A self-hosted runner on the 1 GiB application server adds trust/resource concerns. CodeDeploy is possible but adds an agent/deployment model beyond the existing bootstrap contract. Public-health failures do not trigger automatic rollback because DNS/TLS failures may be independent of the release.