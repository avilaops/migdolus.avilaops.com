#!/usr/bin/env bash
# Prepara o banco do Migdolus Monitor no Postgres do host (Hetzner).
# Idempotente: pode rodar de novo sem estragar nada.
#  - instala a extensão PostGIS do Postgres 18 (pacote Ubuntu)
#  - cria role + banco `migdolus`
#  - grava /etc/avilaops/migdolus.env (chmod 600) na primeira execução
#  - aplica db/schema.sql
set -euo pipefail

ENV_FILE=/etc/avilaops/migdolus.env
SCHEMA=${1:-/opt/migdolus/schema.sql}
PG_VERSION=$(ls /etc/postgresql | sort -n | tail -1)

export DEBIAN_FRONTEND=noninteractive
if ! dpkg -s "postgresql-${PG_VERSION}-postgis-3" >/dev/null 2>&1; then
  apt-get install -y -qq "postgresql-${PG_VERSION}-postgis-3" >/tmp/migdolus-postgis-install.log 2>&1
  echo "postgis instalado (postgresql-${PG_VERSION}-postgis-3)"
else
  echo "postgis já instalado"
fi

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  PW=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
  echo "env já existia, reaproveitando senha"
else
  PW=$(openssl rand -hex 24)
  JWT=$(openssl rand -hex 32)
  umask 077
  cat > "$ENV_FILE" <<EOF
# Migdolus Monitor — produção (gerado por deploy/setup-db.sh)
POSTGRES_DB=migdolus
POSTGRES_USER=migdolus
POSTGRES_PASSWORD=$PW
# 172.17.0.1 = host visto de dentro do Docker (Postgres do host escuta nesse IP)
DATABASE_URL=postgresql://migdolus:$PW@172.17.0.1:5432/migdolus
API_PORT=3070
API_PUBLIC_URL=https://migdolus.avilaops.com/api
JWT_SECRET=$JWT
JWT_TTL=15m
REFRESH_TTL=30d
NEXT_PUBLIC_API_URL=https://migdolus.avilaops.com/api
DIAS_SEPTO=30
DIAS_SEPTO_AVISO=20
ESPACAMENTO_MALHA_M=30
EOF
  chmod 600 "$ENV_FILE"
  echo "env criado em $ENV_FILE"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migdolus') THEN
    CREATE ROLE migdolus LOGIN PASSWORD '$PW';
  ELSE
    ALTER ROLE migdolus WITH PASSWORD '$PW';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'migdolus'" | grep -q 1; then
  sudo -u postgres createdb -O migdolus migdolus
  echo "banco migdolus criado"
fi

sudo -u postgres psql -d migdolus -v ON_ERROR_STOP=1 -q \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;" \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
echo "postgis $(sudo -u postgres psql -d migdolus -tAc 'select postgis_lib_version()')"

PGPASSWORD="$PW" psql -h 127.0.0.1 -U migdolus -d migdolus -v ON_ERROR_STOP=1 -q -f "$SCHEMA"
echo "schema aplicado: $(PGPASSWORD="$PW" psql -h 127.0.0.1 -U migdolus -d migdolus -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'") tabelas"

# Postgres do host precisa aceitar conexão vinda dos containers (172.17.0.0/16)
HBA=/etc/postgresql/${PG_VERSION}/main/pg_hba.conf
if ! grep -q "migdolus" "$HBA"; then
  echo "host    migdolus        migdolus        172.16.0.0/12           scram-sha-256" >> "$HBA"
  systemctl reload postgresql
  echo "pg_hba: acesso do Docker liberado para o banco migdolus"
fi
