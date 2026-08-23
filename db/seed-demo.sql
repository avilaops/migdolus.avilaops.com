-- Dados de demonstração para apresentação a clientes.
-- Uso: psql "$DATABASE_URL" -v org=<uuid da organizacao> -v senha_demo='<senha>' -f db/seed-demo.sql
-- Idempotente por nome: remove a "Fazenda Santa Rita (demo)" da organização e recria tudo.
\set ON_ERROR_STOP on
BEGIN;

-- limpeza da demo anterior (só o que pertence à fazenda demo)
DELETE FROM fazenda WHERE organizacao_id = :'org'::uuid AND nome = 'Fazenda Santa Rita (demo)';
DELETE FROM safra WHERE organizacao_id = :'org'::uuid AND rotulo IN ('2024/25', '2025/26');

-- usuário de demonstração (só leitura prática: agrônomo)
INSERT INTO usuario (organizacao_id, nome, email, papel, senha_hash)
VALUES (:'org'::uuid, 'Convidado (demo)', 'demo@migdolus.avilaops.com', 'agronomo', crypt(:'senha_demo', gen_salt('bf', 10)))
ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, ativo = true;

-- pragueiros fictícios para assinar as vistorias
INSERT INTO usuario (organizacao_id, nome, email, papel, senha_hash)
VALUES (:'org'::uuid, 'João Pragueiro', 'joao.demo@migdolus.avilaops.com', 'pragueiro', crypt(:'senha_demo', gen_salt('bf', 10))),
       (:'org'::uuid, 'Maria Silva', 'maria.demo@migdolus.avilaops.com', 'pragueiro', crypt(:'senha_demo', gen_salt('bf', 10)))
ON CONFLICT (email) DO NOTHING;

-- safras
INSERT INTO safra (organizacao_id, rotulo, inicio, fim) VALUES
  (:'org'::uuid, '2024/25', '2024-11-01', '2025-05-31'),
  (:'org'::uuid, '2025/26', '2025-11-01', '2026-05-31');

-- fazenda (região de Sertãozinho/SP)
INSERT INTO fazenda (organizacao_id, nome, codigo, municipio, uf, limite)
VALUES (:'org'::uuid, 'Fazenda Santa Rita (demo)', 'FSR', 'Sertãozinho', 'SP',
  ST_Multi(ST_GeomFromText('POLYGON((-47.998 -21.128, -47.982 -21.128, -47.982 -21.142, -47.998 -21.142, -47.998 -21.128))', 4326)));

-- talhões
INSERT INTO talhao (fazenda_id, nome, variedade, corte, ano_programa, origem, geom)
SELECT f.id, t.nome, t.variedade, t.corte, t.ano, 'desenho', ST_Multi(ST_GeomFromText(t.wkt, 4326))
FROM fazenda f, (VALUES
  ('T-01', 'RB867515', 4, 2, 'POLYGON((-47.997 -21.129, -47.991 -21.129, -47.991 -21.1345, -47.997 -21.1345, -47.997 -21.129))'),
  ('T-02', 'CTC4',     3, 1, 'POLYGON((-47.990 -21.129, -47.983 -21.129, -47.983 -21.1345, -47.990 -21.1345, -47.990 -21.129))'),
  ('T-07', 'RB966928', 4, NULL, 'POLYGON((-47.997 -21.1355, -47.989 -21.1355, -47.989 -21.141, -47.997 -21.141, -47.997 -21.1355))')
) AS t(nome, variedade, corte, ano, wkt)
WHERE f.organizacao_id = :'org'::uuid AND f.nome = 'Fazenda Santa Rita (demo)';

-- armadilhas: malha de 90 m nos talhões de coleta massal (T-01, T-02) e 150 m no monitoramento (T-07)
INSERT INTO armadilha (talhao_id, fazenda_id, codigo, finalidade, geom, precisao_m, instalada_em, instalada_por, status)
SELECT t.id, t.fazenda_id,
       replace(t.nome, '-', '') || '-' || lpad(m.seq::text, 3, '0'),
       CASE WHEN t.nome = 'T-07' THEN 'monitoramento' ELSE 'coleta_massal' END,
       m.geom, 4 + random() * 6,
       now() - ((120 + (random() * 200)::int) || ' days')::interval,
       (SELECT id FROM usuario WHERE email = 'joao.demo@migdolus.avilaops.com'),
       'ativa'
FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
CROSS JOIN LATERAL gerar_malha(t.id, CASE WHEN t.nome = 'T-07' THEN 150 ELSE 90 END) m
WHERE f.organizacao_id = :'org'::uuid AND f.nome = 'Fazenda Santa Rita (demo)';

-- alguns pontos planejados (malha recém-gerada, ainda não instalada) em T-02
UPDATE armadilha a SET status = 'planejada'
FROM talhao t WHERE a.talhao_id = t.id AND t.nome = 'T-02' AND a.codigo >= 'T02-030';

-- ciclos de septo: trocas a cada 30 dias desde a instalação; o último ciclo começou entre 0 e 40 dias atrás
INSERT INTO ciclo_feromonio (armadilha_id, lote_septo, inicio, fim_previsto, trocado_em)
SELECT a.id, 'L' || to_char(g.inicio, 'YYMM') || '-' || (7 + (random()*20)::int),
       g.inicio, g.inicio + interval '30 days',
       CASE WHEN g.inicio + interval '30 days' < a.ultimo THEN g.inicio + interval '30 days' ELSE NULL END
FROM (
  SELECT id, instalada_em, now() - ((random() * 40)::int || ' days')::interval AS ultimo
  FROM armadilha WHERE status = 'ativa' AND fazenda_id IN (SELECT id FROM fazenda WHERE organizacao_id = :'org'::uuid AND nome = 'Fazenda Santa Rita (demo)')
) a
CROSS JOIN LATERAL (
  SELECT a.ultimo - (n * interval '30 days') AS inicio FROM generate_series(0, 6) n
  WHERE a.ultimo - (n * interval '30 days') >= a.instalada_em
) g;

-- vistorias semanais desde nov/2024 com curva de revoada (pico em março) e queda de ~60 % na 2ª safra
INSERT INTO vistoria (armadilha_id, usuario_id, realizada_em, adultos, geom, precisao_m, distancia_m, troca_septo, completa)
SELECT a.id,
       (SELECT id FROM usuario WHERE email = CASE WHEN (hashtext(a.id::text || d.dia::text) % 10) < 6 THEN 'joao.demo@migdolus.avilaops.com' ELSE 'maria.demo@migdolus.avilaops.com' END),
       d.dia + ((7 + (random()*8)::int) || ' hours')::interval,
       GREATEST(0, round(
         (CASE EXTRACT(month FROM d.dia)
            WHEN 11 THEN 4 WHEN 12 THEN 12 WHEN 1 THEN 25 WHEN 2 THEN 60 WHEN 3 THEN 140 WHEN 4 THEN 90 WHEN 5 THEN 30
            ELSE 1 END)
         * (CASE WHEN d.dia < '2025-08-01' THEN 1.0 ELSE 0.4 END)
         * (CASE t.nome WHEN 'T-01' THEN 1.3 WHEN 'T-02' THEN 0.9 ELSE 0.6 END)
         * (0.5 + random())
       ))::int,
       ST_Translate(a.geom, (random()-0.5) * 0.00015, (random()-0.5) * 0.00015),
       3 + random()*7, round((random()*12)::numeric, 1),
       random() < 0.08, true
FROM armadilha a
JOIN talhao t ON t.id = a.talhao_id
CROSS JOIN generate_series('2024-11-04'::date, now()::date, '7 days') AS d(dia)
WHERE a.status = 'ativa'
  AND a.fazenda_id IN (SELECT id FROM fazenda WHERE organizacao_id = :'org'::uuid AND nome = 'Fazenda Santa Rita (demo)')
  AND (EXTRACT(month FROM d.dia) BETWEEN 11 AND 12 OR EXTRACT(month FROM d.dia) BETWEEN 1 AND 5 OR d.dia > now() - interval '45 days')
  AND random() < 0.85;

-- trincheiras (larvas/trincheira): 2024/25 ≈ 8, 2025/26 ≈ 1,5
INSERT INTO trincheira (client_id, talhao_id, safra_id, usuario_id, realizada_em, larvas, geom)
SELECT gen_random_uuid(), t.id, s.id,
       (SELECT id FROM usuario WHERE email = 'joao.demo@migdolus.avilaops.com'),
       s.inicio + interval '150 days' + (n || ' days')::interval,
       CASE WHEN s.rotulo = '2024/25' THEN 5 + (random()*6)::int ELSE (random()*3)::int END,
       ST_Centroid(t.geom)
FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
CROSS JOIN safra s
CROSS JOIN generate_series(1, 4) n
WHERE f.organizacao_id = :'org'::uuid AND f.nome = 'Fazenda Santa Rita (demo)' AND s.organizacao_id = :'org'::uuid AND t.nome <> 'T-07';

-- TCH por talhão e safra (T-07 = testemunha sem controle)
INSERT INTO producao_talhao (talhao_id, safra_id, tch, testemunha, fonte)
SELECT t.id, s.id,
       CASE WHEN t.nome = 'T-07' THEN (CASE s.rotulo WHEN '2024/25' THEN 27 ELSE 26 END)
            WHEN t.nome = 'T-01' THEN (CASE s.rotulo WHEN '2024/25' THEN 38 ELSE 51 END)
            ELSE (CASE s.rotulo WHEN '2024/25' THEN 35 ELSE 47 END) END,
       t.nome = 'T-07', 'manual'
FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id CROSS JOIN safra s
WHERE f.organizacao_id = :'org'::uuid AND f.nome = 'Fazenda Santa Rita (demo)' AND s.organizacao_id = :'org'::uuid;

-- evento de sync para a visão geral
INSERT INTO sync_evento (device_id, usuario_id, registros)
VALUES ('moto-g54-demo', (SELECT id FROM usuario WHERE email = 'joao.demo@migdolus.avilaops.com'), 42);

COMMIT;

SELECT (SELECT count(*) FROM armadilha a JOIN fazenda f ON f.id = a.fazenda_id WHERE f.nome = 'Fazenda Santa Rita (demo)') AS armadilhas,
       (SELECT count(*) FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id WHERE f.nome = 'Fazenda Santa Rita (demo)') AS vistorias,
       (SELECT count(*) FROM v_armadilha_status s JOIN fazenda f ON f.id = s.fazenda_id WHERE f.nome = 'Fazenda Santa Rita (demo)' AND s.faixa_septo = 'critico') AS septo_critico;
