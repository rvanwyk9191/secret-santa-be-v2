# Deployment Data Model

No application entities or DynamoDB schemas change.

| Entity | Fields And Validation | Relationships |
|--------|-----------------------|---------------|
| ApplicationHost | Exactly one `t3.micro`; Canonical Ubuntu 24.04 amd64 AMI; existing VPC/subnet; IMDSv2 required; encrypted gp3 root 16 GiB | Instance profile, security group, Elastic IP, release |
| PublicEndpoint | `secretsanta.reinhardtvanwyk.com`; HTTPS 443; HTTP 80 for redirect/ACME; EIP allocation ID/address | A record targets EIP; EIP associates with host |
| DnsOwnership | Default external; optional Terraform-managed after import; existing hosted-zone ID; A record TTL 300 proposed | Exactly one owner per record; review conflicting CNAME/AAAA |
| RuntimeEnvironment | AWS_REGION; public HTTPS BASE_URL; persistent SESSION_SECRET; absolute SSL paths; optional SNS_TOPIC_ARN; explicit Vite hostname | Root-owned `/etc/secret-santa/app.env`, readable by service group; no Terraform secret values |
| InstanceRole | EC2 trust; scoped DynamoDB/SSM/SNS actions; conditional KMS decrypt; SSM managed-instance permissions | Host obtains temporary credentials through IMDSv2 |
| Release | Reviewed revision; complete root/frontend manifests and lockfiles; application files; dependencies installed on instance | Staged at `/opt/secret-santa`; owned by unprivileged service account |
| InternalCertificate | Self-signed localhost/127.0.0.1 SANs; protected key; 10-year bootstrap validity | Shared by both local servers; trusted by Nginx upstream; not presented publicly |
| PublicCertificate | ACME certificate covering public hostname; renewal timer; Nginx reload hook | Separate from local certificate; private key readable by Nginx master only |
| ReleaseArtifact | Exact commit SHA; SHA-256; private S3 key `releases/{sha}/{run_id}-{attempt}/release.tar.gz`; server-side encryption; bucket retention lifecycle | Uploaded by GitHub OIDC role; downloaded by EC2 instance role |
| DeploymentRun | Main push/manual main run; production environment; SSM command ID/status; internal/public health result | Serialized by workflow concurrency and host lock; retains previous release for rollback |

## State Transitions

`unprovisioned -> host created -> tools installed -> reviewed release staged -> dependencies installed -> internal health passing -> DNS ready -> public TLS enabled -> externally verified`

Initial user data stops at tools installed. Missing IAM/SSM or an unhealthy process fails deployment rather than claiming readiness. HTTPS issuance failures retain the HTTP ACME/redirect configuration for a retry. Installer reruns preserve environment secrets and public TLS configuration. Runtime crashes restart the service; repeated failures are rate-limited by systemd and require log inspection.

For GitHub delivery: `validated commit -> packaged artifact -> S3 upload -> checksum verified -> previous release retained -> release switched -> npm install/start -> internal health -> SSM success -> public HTTPS health`. Install/internal-health failure restores the previous release and fails the run. A public-health failure fails the run without automatic rollback. Initial deployment has no prior working release; a failed initial release remains stopped for inspection.

## Existing AWS Data Dependencies

- `Parties`, key `party_id`.
- `PartyMembers`, keys `email`/`party_id`, plus `party_id-index`.
- `Invitations`, keys `party_id`/`email`, existing stream retained for emailer.
- `Assignments`, keys `party_id`/`giver_email`.
- `NotificationEvents`, keys `party_id`/`created_at`.
- Auth0 SSM parameters `/secret-santa/auth0/domain`, `/audience`, `/client_id`, `/client_secret` under the same prefix; decrypt the secret as already implemented.

The region must match the existing resources. Bootstrap neither creates tables nor copies production data.