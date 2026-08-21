import type { NextRequest } from "next/server";
import { comSessao, json, param } from "@/lib/api";
import { query } from "@/lib/db";

// Lista de armadilhas com status de septo e última contagem (v_armadilha_status).
export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const fazenda = param(req, "fazenda");
  const faixa = param(req, "faixa"); // ok | aviso | critico | sem_septo
  const rows = await query(
    `SELECT s.id, s.codigo, s.fazenda_id, f.nome AS fazenda, s.talhao_id, t.nome AS talhao, s.finalidade, s.status,
            ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon,
            s.septo_inicio, s.septo_fim_previsto, s.dias_septo, s.faixa_septo,
            s.ultima_vistoria_em, s.ultima_contagem, s.nivel_infestacao
       FROM v_armadilha_status s
       JOIN fazenda f ON f.id = s.fazenda_id
       LEFT JOIN talhao t ON t.id = s.talhao_id
      WHERE f.organizacao_id = $1
        AND ($2::uuid IS NULL OR s.fazenda_id = $2)
        AND ($3::text IS NULL OR s.faixa_septo = $3)
        AND s.status <> 'removida'
      ORDER BY CASE s.faixa_septo WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 WHEN 'sem_septo' THEN 2 ELSE 3 END, s.codigo`,
    [sessao.organizacaoId, fazenda, faixa],
  );
  return json(rows);
});
