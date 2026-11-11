#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == --help ]]; then
  printf 'Usage: bash deploy-release.sh STAGED_RELEASE_DIRECTORY COMMIT_SHA\nRun as root on the bootstrapped EC2 instance.\n'
  exit 0
fi
if [[ "$#" != 2 || ! "$2" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Supply a staged release directory and a full lowercase commit SHA.\n' >&2
  exit 2
fi
if [[ "$(id -u)" != 0 ]]; then
  printf 'Run this script as root on the EC2 instance.\n' >&2
  exit 1
fi

staged_dir="$(realpath "$1")"
revision="$2"
app_dir=/opt/secret-santa
previous_dir=/opt/secret-santa.previous
incoming_dir=/opt/secret-santa.incoming
failed_dir=/opt/secret-santa.failed

for manifest in package.json package-lock.json frontend/package.json frontend/package-lock.json terraform/scripts/bootstrap-ec2.sh REVISION; do
  test -f "$staged_dir/$manifest"
done
test "$(cat "$staged_dir/REVISION")" = "$revision"
test -r /etc/secret-santa/app.env
test -x /usr/local/bin/npm
exec 9>/var/lock/secret-santa-deploy.lock
flock -w 10 9

rm -rf "$incoming_dir"
install -d -m 0750 "$incoming_dir"
cp -a "$staged_dir/." "$incoming_dir/"
had_previous=false
if [[ -f "$app_dir/package.json" && -d "$app_dir/node_modules" ]]; then
  had_previous=true
fi
systemctl stop secret-santa.service
rm -rf "$previous_dir"
if [[ -d "$app_dir" ]]; then
  mv "$app_dir" "$previous_dir"
fi

rollback() {
  exit_code="$?"
  trap - ERR
  systemctl stop secret-santa.service || true
  if [[ -d "$app_dir" ]]; then
    rm -rf "$failed_dir"
    mv "$app_dir" "$failed_dir"
  fi
  if [[ -d "$previous_dir" ]]; then
    mv "$previous_dir" "$app_dir"
  fi
  if [[ "$had_previous" == true ]]; then
    systemctl reset-failed secret-santa.service || true
    systemctl start secret-santa.service || true
    printf 'Deployment failed; restored the previous release. Verify service health in journald.\n' >&2
  else
    printf 'Initial deployment failed; no previous running release is available.\n' >&2
  fi
  exit "$exit_code"
}

trap rollback ERR
mv "$incoming_dir" "$app_dir"
bash "$app_dir/terraform/scripts/bootstrap-ec2.sh" deploy
trap - ERR
printf 'Deployed commit %s\n' "$revision"