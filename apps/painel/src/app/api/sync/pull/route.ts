import type { NextRequest } from "next/server";
import { comSessao, json, param } from "@/lib/api";
import { query, one } from "@/lib/db";

// Pull incremental para o app: tudo que mudou desde `since` (ISO) na organização.
// Sem `since`, devolve o estado completo (primeira sincronização / reinstalação).
export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const org = sessao.organizacaoId;
  const since = param(req, "since");
  const cursor = new Date().toISOString();
  const desde = since && !Number.isNaN(Date.parse(since)) ? since : "1970-01-01T00:00:00Z";

  const [organizacao, fazendas, talhoes, armadilhas, ciclos, vistorias] = await Promise.all([
    one(`SELECT id, nome, tipo, dias_septo, dias_septo_aviso, espacamento_malha_m, faixa_media_min, faixa_alta_min FROM organizacao WHERE id = $1`, [org]),
    query(
      `SELECT id, nome, codigo, municipio, uf, ST_AsGeoJSON(limite)::json AS limite, atualizado_em
         FROM fazenda WHERE organizacao_id = $1 AND atualizado_em > $2 ORDER BY nome`,
      [org, desde],
    ),
    query(
      `SELECT t.id, t.fazenda_id, t.nome, t.variedade, t.corte, t.ano_programa, t.area_ha,
              ST_AsGeoJSON(t.geom)::json AS geom, t.atualizado_em
         FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
        WHERE f.organizacao_id = $1 AND t.atualizado_em > $2 ORDER BY t.nome`,
      [org, desde],
    ),
    query(
      `SELECT a.id, a.client_id, a.fazenda_id, a.talhao_id, a.codigo, a.finalidade, a.status,
              ST_Y(a.geom) AS lat, ST_X(a.geom) AS lon, a.precisao_m, a.instalada_em, a.observacoes, a.atualizado_em,
              s.septo_inicio, s.septo_fim_previsto, s.dias_septo, s.faixa_septo, s.ultima_vistoria_em, s.ultima_contagem, s.nivel_infestacao
         FROM armadilha a
         JOIN fazenda f ON f.id = a.fazenda_id
         LEFT JOIN v_armadilha_status s ON s.id = a.id
        WHERE f.organizacao_id = $1 AND a.atualizado_em > $2 AND a.status <> 'removida'
        ORDER BY a.codigo`,
      [org, desde],
    ),
    query(
      `SELECT c.id, c.client_id, c.armadilha_id, c.lote_septo, c.inicio, c.fim_previsto, c.trocado_em
         FROM ciclo_feromonio c JOIN armadilha a ON a.id = c.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
        WHERE f.organizacao_id = $1 AND c.criado_em > $2 ORDER BY c.inicio DESC`,
      [org, desde],
    ),
    // últimas 5 vistorias por armadilha, para o app mostrar histórico curto
    query(
      `SELECT id, client_id, armadilha_id, realizada_em, adultos, troca_septo, usuario_id
         FROM (
           SELECT v.*, row_number() OVER (PARTITION BY v.armadilha_id ORDER BY v.realizada_em DESC) AS rn
             FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
            WHERE f.organizacao_id = $1 AND v.criado_em > $2
         ) x WHERE rn <= 5 ORDER BY realizada_em DESC`,
      [org, desde],
    ),
  ]);

  return json({ cursor, organizacao, fazendas, talhoes, armadilhas, ciclos, vistorias });
});
