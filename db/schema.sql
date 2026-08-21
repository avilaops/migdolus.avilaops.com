-- Migdolus Monitor — esquema inicial (PostgreSQL 16 + PostGIS 3)
-- Aplicar: psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenant e usuários
-- ---------------------------------------------------------------------------
CREATE TABLE organizacao (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  tipo               text NOT NULL CHECK (tipo IN ('usina','consultoria','fazenda')),
  plano              text NOT NULL DEFAULT 'campo' CHECK (plano IN ('campo','usina','grupo')),
  -- parâmetros agronômicos (cada usina segue seu protocolo)
  dias_septo         int  NOT NULL DEFAULT 30,
  dias_septo_aviso   int  NOT NULL DEFAULT 20,
  espacamento_malha_m numeric(6,1) NOT NULL DEFAULT 30,
  faixa_media_min    int  NOT NULL DEFAULT 20,   -- adultos/armadilha → amarelo
  faixa_alta_min     int  NOT NULL DEFAULT 100,  -- adultos/armadilha → vermelho
  criado_em          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacao(id),
  nome            text NOT NULL,
  email           text UNIQUE,
  telefone        text,
  papel           text NOT NULL CHECK (papel IN ('pragueiro','agronomo','gestor','admin')),
  senha_hash      text,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cartografia
-- ---------------------------------------------------------------------------
CREATE TABLE fazenda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacao(id),
  nome            text NOT NULL,
  codigo          text,
  municipio       text,
  uf              char(2),
  limite          geometry(MultiPolygon, 4326),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fazenda_limite_gix ON fazenda USING gist (limite);

CREATE TABLE talhao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id      uuid NOT NULL REFERENCES fazenda(id),
  nome            text NOT NULL,
  variedade       text,
  corte           int,                      -- 1 = cana-planta, 2+ = soqueiras
  ano_programa    int CHECK (ano_programa BETWEEN 1 AND 3), -- ano do controle (3 anos)
  geom            geometry(MultiPolygon, 4326),
  area_ha         numeric(10,2) GENERATED ALWAYS AS
                    (CASE WHEN geom IS NULL THEN NULL
                          ELSE round((ST_Area(geom::geography) / 10000)::numeric, 2) END) STORED,
  origem          text NOT NULL DEFAULT 'desenho' CHECK (origem IN ('desenho','kml','geojson','shp','gps')),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX talhao_geom_gix ON talhao USING gist (geom);

CREATE TABLE safra (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacao(id),
  rotulo          text NOT NULL,            -- '2026/27'
  inicio          date NOT NULL,
  fim             date NOT NULL,
  UNIQUE (organizacao_id, rotulo)
);

-- ---------------------------------------------------------------------------
-- Armadilhas, septos e vistorias
-- ---------------------------------------------------------------------------
CREATE TABLE armadilha (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid UNIQUE,              -- gerado no aparelho (idempotência)
  device_id       text,
  talhao_id       uuid REFERENCES talhao(id),
  fazenda_id      uuid NOT NULL REFERENCES fazenda(id),
  codigo          text NOT NULL,
  finalidade      text NOT NULL DEFAULT 'monitoramento' CHECK (finalidade IN ('monitoramento','coleta_massal')),
  geom            geometry(Point, 4326) NOT NULL,
  precisao_m      numeric(6,1),
  instalada_em    timestamptz NOT NULL,
  instalada_por   uuid REFERENCES usuario(id),
  status          text NOT NULL DEFAULT 'ativa' CHECK (status IN ('planejada','ativa','removida','perdida')),
  observacoes     text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fazenda_id, codigo)
);
CREATE INDEX armadilha_geom_gix ON armadilha USING gist (geom);

CREATE TABLE ciclo_feromonio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid UNIQUE,
  armadilha_id    uuid NOT NULL REFERENCES armadilha(id),
  lote_septo      text,
  inicio          timestamptz NOT NULL,
  fim_previsto    timestamptz NOT NULL,
  trocado_em      timestamptz,
  trocado_por     uuid REFERENCES usuario(id),
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ciclo_feromonio_armadilha_idx ON ciclo_feromonio (armadilha_id, inicio DESC);

CREATE TABLE vistoria (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid UNIQUE,
  device_id           text,
  armadilha_id        uuid NOT NULL REFERENCES armadilha(id),
  usuario_id          uuid REFERENCES usuario(id),
  realizada_em        timestamptz NOT NULL,
  adultos             int NOT NULL CHECK (adultos >= 0),
  geom                geometry(Point, 4326),   -- posição real do pragueiro na vistoria
  precisao_m          numeric(6,1),
  distancia_m         numeric(8,1),             -- distância até o ponto cadastrado
  precisao_baixa      boolean NOT NULL DEFAULT false,
  troca_septo         boolean NOT NULL DEFAULT false,
  corrige_vistoria_id uuid REFERENCES vistoria(id),
  observacoes         text,
  completa            boolean NOT NULL DEFAULT false, -- true após upload das fotos
  criado_em           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vistoria_armadilha_idx ON vistoria (armadilha_id, realizada_em DESC);
CREATE INDEX vistoria_realizada_idx ON vistoria (realizada_em);

CREATE TABLE foto (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid UNIQUE,
  vistoria_id     uuid REFERENCES vistoria(id),
  armadilha_id    uuid REFERENCES armadilha(id),
  object_key      text NOT NULL,            -- chave no R2
  sha256          text,
  tirada_em       timestamptz,
  geom            geometry(Point, 4326),
  carimbo_aplicado boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Eficácia do controle (larvas e produtividade)
-- ---------------------------------------------------------------------------
CREATE TABLE trincheira (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid UNIQUE,
  talhao_id       uuid NOT NULL REFERENCES talhao(id),
  safra_id        uuid REFERENCES safra(id),
  usuario_id      uuid REFERENCES usuario(id),
  realizada_em    timestamptz NOT NULL,
  larvas          int NOT NULL CHECK (larvas >= 0),
  geom            geometry(Point, 4326),
  observacoes     text
);

CREATE TABLE producao_talhao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talhao_id       uuid NOT NULL REFERENCES talhao(id),
  safra_id        uuid NOT NULL REFERENCES safra(id),
  tch             numeric(6,1),
  testemunha      boolean NOT NULL DEFAULT false,
  fonte           text,                     -- 'manual' | 'erp' | 'importacao'
  UNIQUE (talhao_id, safra_id)
);

-- ---------------------------------------------------------------------------
-- Sincronização
-- ---------------------------------------------------------------------------
CREATE TABLE sync_evento (
  id              bigserial PRIMARY KEY,
  device_id       text NOT NULL,
  usuario_id      uuid REFERENCES usuario(id),
  recebido_em     timestamptz NOT NULL DEFAULT now(),
  registros       int NOT NULL,
  cursor_pull     timestamptz
);

-- ---------------------------------------------------------------------------
-- Views derivadas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_armadilha_status AS
WITH ultimo_septo AS (
  SELECT DISTINCT ON (armadilha_id) armadilha_id, inicio, fim_previsto
  FROM ciclo_feromonio WHERE trocado_em IS NULL
  ORDER BY armadilha_id, inicio DESC
), ultima_vistoria AS (
  SELECT DISTINCT ON (armadilha_id) armadilha_id, realizada_em, adultos
  FROM vistoria ORDER BY armadilha_id, realizada_em DESC
)
SELECT a.id, a.codigo, a.fazenda_id, a.talhao_id, a.finalidade, a.status, a.geom,
       s.inicio                                        AS septo_inicio,
       s.fim_previsto                                  AS septo_fim_previsto,
       EXTRACT(day FROM now() - s.inicio)::int         AS dias_septo,
       CASE
         WHEN s.inicio IS NULL THEN 'sem_septo'
         WHEN now() >= s.fim_previsto THEN 'critico'
         WHEN now() >= s.inicio + (o.dias_septo_aviso || ' days')::interval THEN 'aviso'
         ELSE 'ok' END                                 AS faixa_septo,
       v.realizada_em                                  AS ultima_vistoria_em,
       v.adultos                                       AS ultima_contagem,
       CASE
         WHEN v.adultos IS NULL THEN NULL
         WHEN v.adultos >= o.faixa_alta_min  THEN 'alto'
         WHEN v.adultos >= o.faixa_media_min THEN 'medio'
         ELSE 'baixo' END                              AS nivel_infestacao
FROM armadilha a
JOIN fazenda f ON f.id = a.fazenda_id
JOIN organizacao o ON o.id = f.organizacao_id
LEFT JOIN ultimo_septo s ON s.armadilha_id = a.id
LEFT JOIN ultima_vistoria v ON v.armadilha_id = a.id;

CREATE OR REPLACE VIEW v_talhao_indicadores AS
SELECT t.id AS talhao_id, t.fazenda_id, t.nome, t.area_ha,
       date_trunc('month', v.realizada_em) AS mes,
       count(DISTINCT a.id)       AS armadilhas,
       count(v.id)                AS vistorias,
       sum(v.adultos)             AS adultos_total,
       round(avg(v.adultos), 1)   AS adultos_media,
       max(v.adultos)             AS adultos_max
FROM talhao t
JOIN armadilha a ON a.talhao_id = t.id
JOIN vistoria v ON v.armadilha_id = a.id AND v.corrige_vistoria_id IS NULL
GROUP BY t.id, t.fazenda_id, t.nome, t.area_ha, date_trunc('month', v.realizada_em);

CREATE OR REPLACE VIEW v_safra_comparativo AS
SELECT s.organizacao_id, s.rotulo AS safra, f.id AS fazenda_id, f.nome AS fazenda,
       date_trunc('month', v.realizada_em) AS mes,
       round(avg(v.adultos), 1) AS machos_por_armadilha
FROM safra s
JOIN fazenda f ON f.organizacao_id = s.organizacao_id
JOIN armadilha a ON a.fazenda_id = f.id
JOIN vistoria v ON v.armadilha_id = a.id
               AND v.realizada_em >= s.inicio AND v.realizada_em < s.fim + 1
               AND v.corrige_vistoria_id IS NULL
GROUP BY s.organizacao_id, s.rotulo, f.id, f.nome, date_trunc('month', v.realizada_em);

-- ---------------------------------------------------------------------------
-- Gerador de malha de coleta massal (grade regular recortada pelo talhão)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gerar_malha(p_talhao uuid, p_espacamento_m numeric DEFAULT 30)
RETURNS TABLE (seq int, geom geometry(Point, 4326)) LANGUAGE sql STABLE AS $$
  WITH t AS (
    SELECT ST_Transform(geom, 3857) AS g FROM talhao WHERE id = p_talhao
  ), grade AS (
    SELECT (ST_SquareGrid(p_espacamento_m, g)).geom AS cel FROM t
  )
  SELECT row_number() OVER (ORDER BY ST_Y(ST_Centroid(cel)) DESC, ST_X(ST_Centroid(cel)))::int,
         ST_Transform(ST_Centroid(cel), 4326)::geometry(Point, 4326)
  FROM grade, t
  WHERE ST_Within(ST_Centroid(cel), t.g);
$$;
