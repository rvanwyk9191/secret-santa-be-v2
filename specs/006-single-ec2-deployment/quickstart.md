# Single-EC2 Deployment Runbook

## Status And Prerequisites

The spec, plan, bootstrap, release helper, GitHub Actions workflow, and Terraform compute/CI IAM/artifact resources are implemented locally. They have **not been applied to AWS**. Existing Terraform continues to manage databases/emailer resources; the deployment resources do not recreate or import those tables.

Target: one Ubuntu 24.04 LTS amd64 `t3.micro`, 16 GiB encrypted gp3 root disk, IMDSv2, instance profile, Elastic IP, existing public subnet/Internet Gateway route and public TCP 80/443 only. Cloud-init installs/enables the SSM agent and runs only the bootstrap `install` phase. Do not open SSH/application ports. Supply `vpc_id`, `public_subnet_id`, and a reviewed Canonical `ec2_ami_id`; the selected region must match the existing tables and SSM parameters. The GitHub Actions OIDC provider for `token.actions.githubusercontent.com` must already exist in the account.

After initializing Terraform using the repository's approved state procedure, review a plan before applying. Required values are the three VPC/subnet/AMI inputs; optional values are `sns_topic_arn`, `auth0_kms_key_arn`, and DNS ownership settings. Terraform outputs `instance_id`, `elastic_ip`, `application_url`, `deployment_bucket`, and `github_deployment_role_arn`. Applying creates billable AWS resources; this implementation session did not apply them.

Verify the existing Auth0 SSM values are populated and the instance profile can read them and use the existing DynamoDB tables/index. Add conditional KMS decrypt and topic-scoped SNS publish if needed. No static AWS keys are required. The installer needs repository/package HTTPS egress and Ubuntu package repository/DNS access.

## 1. Install Tools On The Instance

Cloud-init delivers `terraform/scripts/bootstrap-ec2.sh` and invokes only `install`; no repository checkout, app secret, or certificate issuance is included in user data. Once the instance is ready, the script is available at `/usr/local/sbin/secret-santa-bootstrap-ec2.sh`.

```bash
sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service --no-pager
sudo systemctl status nginx --no-pager
```

The install phase provisions Node 25.8.2/npm, Nginx, certbot, Git, OpenSSL, native build tools/Python and 2 GiB swap. It creates `/etc/secret-santa/app.env`, internal TLS files and `secret-santa.service`, but does not clone code or require DNS to be ready. Node 25 matches the existing mandate but is non-LTS/EOL; a supported-LTS upgrade remains a separate maintenance decision.

## 2. Stage A Reviewed Release And Start Both Apps

Place a complete reviewed release archive at `/tmp/secret-santa-release.tar.gz`, containing the repository contents directly, including both lockfiles and frontend/backend source. Do not include node_modules, `.env`, private keys or repository credentials. Use the existing release-delivery process; never place private Git tokens in user data or URLs.

For subsequent deployments, retain a copy of the previous release before staging a new one. Stop the service before replacing application files; preserve `/etc/secret-santa`.

```bash
sudo systemctl stop secret-santa.service
sudo tar -xzf /tmp/secret-santa-release.tar.gz -C /opt/secret-santa
sudoedit /etc/secret-santa/app.env
sudo bash /tmp/bootstrap-ec2.sh deploy
sudo systemctl status secret-santa.service --no-pager
sudo journalctl -u secret-santa.service -n 100 --no-pager
```

Confirm `AWS_REGION`, `BASE_URL=https://secretsanta.reinhardtvanwyk.com`, generated persistent `SESSION_SECRET` and SSL paths. Add `SNS_TOPIC_ARN` only if used; Auth0 credentials remain in SSM. Do not paste the session secret into chat/logs.

Deploy installs root/frontend dependencies sequentially with development dependencies included, starts the existing repository-root `npm run start` as `secret-santa`, and checks backend/frontend HTTPS internally. No alternate application start command is introduced. If startup fails, inspect IAM/SSM/session/TLS settings in journald; do not use static keys as a workaround.

## 3. Connect The Existing Route 53 Record

Obtain the Terraform Elastic IP output. Inspect the existing record for `secretsanta.reinhardtvanwyk.com` in the public `reinhardtvanwyk.com` zone. Update it explicitly to an **A record containing that Elastic IP**, with a suggested TTL of 300 seconds. A CNAME cannot hold an IP address. Review/remove stale conflicting CNAME/AAAA records through a deliberate migration; do not duplicate or blindly overwrite records.

DNS remains manually managed by default (`manage_dns = false`). If Terraform ownership is desired, first inspect and resolve conflicting CNAME/AAAA records, set `manage_dns = true`, and import the existing A record before applying. The Route 53 import ID is `<HOSTED_ZONE_ID>_secretsanta.reinhardtvanwyk.com_A`; the Terraform resource is `aws_route53_record.application[0]`. Its `allow_overwrite = false` prevents silently replacing an unmanaged record. Review the plan before applying; do not allow unrelated database/resource replacement.

Check from a separate machine after propagation:

```bash
dig +short A secretsanta.reinhardtvanwyk.com
dig +short AAAA secretsanta.reinhardtvanwyk.com
```

The A response must match the instance EIP; no stale AAAA should route users elsewhere. The EIP remains stable through stop/start and must be reassociated if the instance is replaced.

## 4. Enable Public HTTPS And Auth0

With DNS pointing at the instance and TCP 80 reachable, run on the instance:

```bash
sudo CERTBOT_EMAIL=operator@example.com bash /tmp/bootstrap-ec2.sh https
sudo certbot renew --dry-run
sudo systemctl status certbot.timer --no-pager
```

Replace the example contact email. Public certificate issuance is intentionally separate from bootstrap. Nginx retains HTTP ACME validation, redirects other HTTP requests and proxies HTTPS/WebSockets to the frontend. The public certificate renews via certbot; the deploy hook reloads Nginx. Node processes retain their separate internal certificate, so ACME renewal needs no application restart.

In Auth0, register:

- Allowed callback: `https://secretsanta.reinhardtvanwyk.com/api/auth/callback`.
- Allowed logout URL and web origin: `https://secretsanta.reinhardtvanwyk.com`.

Set the existing Terraform `invitation_base_url` input to `https://secretsanta.reinhardtvanwyk.com/api` in the environment configuration and review/apply that change during authorized deployment. Keep any local Auth0 callback entries still needed for development.

## 5. Acceptance And Recovery

From a separate machine:

```bash
curl --fail --head https://secretsanta.reinhardtvanwyk.com/
curl --fail https://secretsanta.reinhardtvanwyk.com/api/health
curl --head http://secretsanta.reinhardtvanwyk.com/
```

Expect trusted TLS, frontend HTML, health JSON and an HTTPS redirect respectively. Complete browser login/logout, create/read a party and exercise member/assignment flows to verify real DynamoDB/index access. Health alone does not prove database authorization. Confirm the role is denied access to unrelated tables and that ports 22/3000/8080 cannot be reached externally.

During an approved maintenance window, reboot and repeat health/login/data checks. Rerun `install`, verify the session secret and HTTPS site were preserved without printing the secret, and repeat health checks. Monitor CPU credits, disk/swap and memory; `t3.micro` is not a throughput or free-tier guarantee. Root npm start uses Vite's development server by explicit request; static frontend serving is a separate hardening option.

If a release fails, stop the service, restore the previous release contents (including removing files absent from that release), preserve `/etc/secret-santa`, and rerun `deploy`. There is downtime and no automatic blue/green rollback on one host. If DNS/ACME fails, correct routing/records and rerun `https`. Replace local certificates before their 10-year bootstrap validity expires; restart the app and reload Nginx after deliberate replacement.

## Local Verification Performed During Planning

Bash syntax, safe help/invalid-phase guards, planning consistency and local-link checks can run on macOS without installation. Ubuntu package installation, systemd/Nginx syntax, cloud-init execution, AWS/DNS/TLS/Auth0/DynamoDB access, renewal and reboot checks require the target instance and remain deployment acceptance gates.

## 6. Enable Merge-To-Main Deployment

The workflow at `.github/workflows/deploy-ec2.yml` validates PRs/main, packages the exact commit and deploys main through S3/SSM. Complete the instance/DNS/TLS setup above before enabling production delivery. No Terraform apply, initial package installation or certificate issuance runs inside this application workflow.

1. Use the Terraform outputs to set the GitHub production environment variables `AWS_REGION`, `AWS_ROLE_ARN`, `EC2_INSTANCE_ID` and `DEPLOY_BUCKET`. Terraform creates the private artifact bucket, scoped instance read access, exact repository/environment OIDC trust, and scoped S3/SSM permissions for the CI role. The account-level GitHub OIDC provider must exist before planning.
2. In GitHub Settings -> Environments, create `production`, restrict deployment branches to `main` and optionally require approval. Do not add long-lived AWS credentials.
4. Require the `Test, Build And Package` status check in main branch protection and require pull requests if direct pushes must not deploy. A merge creates a main push and triggers production delivery. PRs cannot deploy. Manual dispatch can redeploy main after setup or for recovery.
5. After merging, inspect the Actions run: tests/builds -> exact source archive -> OIDC role -> S3 upload -> checksum verification on EC2 -> SSM release switch/internal health -> public HTTPS checks. Failed install/internal health restores the previous release and still marks the run failed. A first deployment has no prior working release. An external DNS/TLS health failure fails the run without automatic rollback.

The instance keeps the previous checkout and at most one failed checkout; monitor available disk on the 16 GiB root volume and retain S3 history separately. Deployment briefly stops both applications. Do not manually deploy concurrently with Actions; the release helper has a host lock, while manual bootstrap deploy commands bypass it.

### Current Validation Blockers

Root tests pass (127 tests), but existing application issues block this workflow's required gates:

- Backend build: `backend/src/controllers/pendingInvitesController.ts` assigns possibly undefined `party_date` to an exact optional string property.
- Frontend tests/build: `HostedPartyPanel.test.tsx` and `MainPage.test.tsx` fixtures omit required `pendingInvitees`; `PartyMemberCard.tsx` has an unused `displayName` import.
- Frontend coverage currently fails its existing 80 percent thresholds; the constitution's 90 percent coverage goal is additional existing coverage work, not waived by this workflow.

These are not bypassed or changed by deployment automation. Fix the application failures before expecting a merge to deploy. Workflow syntax/local release checks do not prove AWS OIDC/IAM/SSM access; verify the first authorized production run end to end.