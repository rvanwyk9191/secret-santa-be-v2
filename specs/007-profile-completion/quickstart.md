# Quickstart: Verify Profile Completion

Use test identities and a dev deployment; never write test profiles to production. Jest suites mock network dependencies.

## Local checks after implementation

Use Node 25.8.2 and Terraform 1.14.8. Set `BASE_URL` to the browser-facing HTTPS URL (for example `https://localhost:3000` with Vite), not the internal Express listener. Profile saves compare the browser's `Origin` with `new URL(BASE_URL).origin`.

```sh
npm run build
npm test -- --coverage
npm --prefix frontend run build
npm --prefix frontend test -- --coverage
terraform -chdir=terraform fmt -check main.tf compute.tf
terraform -chdir=terraform validate
```

Use initialized Terraform providers for validation. Cover exact profile payloads and status codes, cookie identity and rejected cross-origin writes, whitespace and Unicode names, paginated legacy agreement/conflicts, concurrent completion, storage failures, and unaffected party-member authorization. Component tests should cover loading, modal visibility, duplicate-submit prevention, retry, successful dismissal/header update, and the two host card labels and fallbacks.

## Dev smoke test and release order

1. Use an approved non-production target; the checked-in EC2 deploy job is production-only. Provision the new table and narrowly scoped EC2 permissions with the reviewed infrastructure deployment. Verify AWS access with the existing instance profile, not static keys.
2. Deploy the API and frontend through the approved non-production HTTPS release path. The API and table must be ready before serving the new UI. Verify `/api/health`. Before merging to `main`, confirm the production table and IAM are ready for automatic application deployment.
3. Sign in as a test user with no parties or saved names. Verify the dialog opens only after loading; blanks are rejected. Save both names, verify the dialog closes and greeting changes without a page reload, then sign out and back in to verify there is no prompt.
4. Repeat with one known legacy name and verify the field is prefilled. Simulate a failed save in the local mocked UI, verify the input remains visible, and retry successfully. Simulate a failed read and verify no completion dialog opens until a successful incomplete response.
5. View a joined-party card and pending invitation hosted by another test user. Confirm both show that host's name if complete and the host email otherwise. Verify invitation acceptance and party actions still use the existing identifiers.
6. If rollback is needed, redeploy the previous app release and preserve the `UserProfiles` table and saved names. Do not destroy the table during an application rollback.
