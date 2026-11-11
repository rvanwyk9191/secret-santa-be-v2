#!/usr/bin/env bash
set -euo pipefail

phase="${1:-install}"
case "$phase" in
  --help|-h)
    printf 'Usage: bash bootstrap-ec2.sh [install|deploy|https]\nUbuntu 24.04 amd64 only. Run as root on the EC2 instance.\n'
    exit 0
    ;;
  install|deploy|https) ;;
  *) printf 'Unknown phase: %s\n' "$phase" >&2; exit 2 ;;
esac

if [[ "$(id -u)" != 0 ]]; then
  printf 'Run this script as root on the EC2 instance.\n' >&2
  exit 1
fi

source /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 || "$(uname -m)" != x86_64 ]]; then
  printf 'Ubuntu 24.04 amd64 is required for the t3.micro bootstrap.\n' >&2
  exit 1
fi

app_dir=/opt/secret-santa
config_dir=/etc/secret-santa
domain=secretsanta.reinhardtvanwyk.com
node_version=25.8.2

write_http_config() {
  cat <<EOF
server {
    listen 80;
    server_name $domain;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 308 https://\$host\$request_uri; }
}
EOF
}

case "$phase" in
  install)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates curl git nginx certbot openssl xz-utils unzip build-essential python3
    if ! id secret-santa >/dev/null 2>&1; then
      useradd --system --user-group --create-home --home-dir /var/lib/secret-santa --shell /usr/sbin/nologin secret-santa
    fi
    install -d -o secret-santa -g secret-santa -m 0750 "$app_dir"
    install -d -o root -g secret-santa -m 0750 "$config_dir"
    install -d -m 0755 /var/www/letsencrypt

    if [[ ! -f /swapfile ]]; then
      fallocate -l 2G /swapfile
      chmod 0600 /swapfile
      mkswap /swapfile
    fi
    if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile; then
      swapon /swapfile
    fi
    if ! grep -q '^/swapfile ' /etc/fstab; then
      printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
    fi

    if [[ "$(node --version 2>/dev/null || true)" != "v$node_version" ]]; then
      download_dir="$(mktemp -d)"
      trap 'rm -rf "$download_dir"' EXIT
      archive="node-v$node_version-linux-x64.tar.xz"
      curl --fail --silent --show-error --location "https://nodejs.org/dist/v$node_version/$archive" -o "$download_dir/$archive"
      curl --fail --silent --show-error --location "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" -o "$download_dir/SHASUMS256.txt"
      (cd "$download_dir" && grep "  $archive\$" SHASUMS256.txt | sha256sum --check -)
      tar -xJf "$download_dir/$archive" -C /usr/local --strip-components=1 --no-same-owner
    fi

    if [[ ! -x /usr/local/bin/aws ]]; then
      aws_download_dir="$(mktemp -d)"
      trap 'rm -rf "${download_dir:-}" "$aws_download_dir"' EXIT
      curl --fail --silent --show-error --location https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip \
        -o "$aws_download_dir/awscliv2.zip"
      unzip -q "$aws_download_dir/awscliv2.zip" -d "$aws_download_dir"
      "$aws_download_dir/aws/install" --install-dir /usr/local/aws-cli --bin-dir /usr/local/bin
    fi

    if [[ ! -f "$config_dir/localhost-key.pem" || ! -f "$config_dir/localhost.pem" ]]; then
      openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout "$config_dir/localhost-key.pem" -out "$config_dir/localhost.pem" \
        -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
    fi
    chown root:secret-santa "$config_dir/localhost-key.pem" "$config_dir/localhost.pem"
    chmod 0640 "$config_dir/localhost-key.pem" "$config_dir/localhost.pem"

    if [[ ! -f "$config_dir/app.env" ]]; then
      session_secret="$(openssl rand -hex 32)"
      (umask 0077; cat > "$config_dir/app.env" <<EOF
AWS_REGION=${AWS_REGION:-us-east-1}
BASE_URL=https://$domain
SESSION_SECRET=$session_secret
SSL_KEY_PATH=$config_dir/localhost-key.pem
SSL_CERT_PATH=$config_dir/localhost.pem
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=$domain
EOF
      )
      chown root:secret-santa "$config_dir/app.env"
      chmod 0640 "$config_dir/app.env"
    fi

    cat > /etc/systemd/system/secret-santa.service <<EOF
[Unit]
Description=Secret Santa frontend and backend
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=secret-santa
Group=secret-santa
WorkingDirectory=$app_dir
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile=$config_dir/app.env
ExecStart=/usr/local/bin/npm run start
Restart=on-failure
RestartSec=10
TimeoutStopSec=30
KillMode=control-group
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
    if [[ ! -f /etc/nginx/sites-available/secret-santa ]]; then
      write_http_config > /etc/nginx/sites-available/secret-santa
    fi
    ln -sfn /etc/nginx/sites-available/secret-santa /etc/nginx/sites-enabled/secret-santa
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl daemon-reload
    systemctl enable --now nginx certbot.timer
    systemctl reload nginx
    printf 'Installed Node %s. Stage the checkout in %s, then run this script with deploy.\n' "$node_version" "$app_dir"
    ;;
  deploy)
    for manifest in package.json package-lock.json frontend/package.json frontend/package-lock.json; do
      if [[ ! -f "$app_dir/$manifest" ]]; then
        printf 'Missing %s/%s; stage a complete release before deployment.\n' "$app_dir" "$manifest" >&2
        exit 1
      fi
    done
    test -r "$config_dir/app.env"
    systemctl stop secret-santa.service
    chown -R secret-santa:secret-santa "$app_dir"
    cd "$app_dir"
    runuser -u secret-santa -- /usr/local/bin/npm ci --include=dev --no-audit --no-fund
    runuser -u secret-santa -- /usr/local/bin/npm --prefix frontend ci --include=dev --no-audit --no-fund
    systemctl reset-failed secret-santa.service
    systemctl enable secret-santa.service
    systemctl restart secret-santa.service
    curl --fail --silent --show-error --retry 15 --retry-connrefused --retry-all-errors --retry-delay 2 \
      --cacert "$config_dir/localhost.pem" https://localhost:8080/api/health
    curl --fail --silent --show-error --retry 15 --retry-connrefused --retry-all-errors --retry-delay 2 \
      --cacert "$config_dir/localhost.pem" https://localhost:3000/ -o /dev/null
    ;;
  https)
    : "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL to an ACME contact email; DNS must already point to the assigned Elastic IP.}"
    certbot certonly --webroot -w /var/www/letsencrypt --non-interactive --agree-tos \
      --email "$CERTBOT_EMAIL" --domain "$domain" --keep-until-expiring
    {
      cat <<'EOF'
map $http_upgrade $secret_santa_connection {
    default upgrade;
    '' close;
}
EOF
      write_http_config
      cat <<EOF
server {
    listen 443 ssl;
    server_name $domain;
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass https://localhost:3000;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate $config_dir/localhost.pem;
        proxy_ssl_name localhost;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$secret_santa_connection;
        proxy_read_timeout 300s;
    }
}
EOF
    } > /etc/nginx/sites-available/secret-santa
    install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
    printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/secret-santa
    chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/secret-santa
    nginx -t
    systemctl reload nginx
    printf 'Public endpoint: https://%s\n' "$domain"
    ;;
esac