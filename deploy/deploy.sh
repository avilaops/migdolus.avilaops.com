#!/usr/bin/env bash
# Deploy do painel/API no Hetzner. Roda na máquina local (Git Bash / WSL).
#   deploy/deploy.sh            → build + envio + up
#   deploy/deploy.sh --no-build → só envio + up (imagem já buildada)
set -euo pipefail

HOST=root@178.105.82.48
KEY=~/.ssh/hetzner_avilaops
AQUI=$(cd "$(dirname "$0")/.." && pwd)
IMG=migdolus-painel:latest

if [ "${1:-}" != "--no-build" ]; then
  echo "▶ build da imagem ($IMG)"
  docker build --platform linux/amd64 -t "$IMG" "$AQUI/apps/painel"
fi

echo "▶ enviando imagem para o servidor"
docker save "$IMG" | gzip -1 | ssh -i "$KEY" "$HOST" 'gunzip | docker load'

echo "▶ compose + Caddy"
scp -q -i "$KEY" "$AQUI/deploy/docker-compose.yml" "$AQUI/deploy/Caddyfile.migdolus" "$AQUI/deploy/setup-db.sh" "$AQUI/db/schema.sql" "$HOST:/opt/migdolus/"
ssh -i "$KEY" "$HOST" bash -s <<'REMOTO'
set -euo pipefail
cd /opt/migdolus
sed -i "s/\r$//" docker-compose.yml Caddyfile.migdolus setup-db.sh schema.sql
# SETUP_TOKEN só é usado no primeiro acesso (POST /api/setup); some depois do setup.
if ! grep -q '^SETUP_TOKEN=' /etc/avilaops/migdolus.env; then
  echo "SETUP_TOKEN=$(openssl rand -hex 16)" >> /etc/avilaops/migdolus.env
fi
docker compose up -d --remove-orphans
# Caddy: inclui o bloco uma única vez
if ! grep -q 'migdolus.avilaops.com' /etc/caddy/Caddyfile; then
  printf '\n' >> /etc/caddy/Caddyfile
  cat Caddyfile.migdolus >> /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null && systemctl reload caddy
  echo "Caddy atualizado"
fi
sleep 3
docker ps --filter name=migdolus-painel --format '{{.Names}} {{.Status}}'
curl -s -o /dev/null -w "painel local: HTTP %{http_code}\n" http://127.0.0.1:3070/entrar
docker image prune -f >/dev/null || true
REMOTO
echo "✔ deploy concluído — https://migdolus.avilaops.com"
