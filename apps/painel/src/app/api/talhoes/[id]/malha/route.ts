import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo, ApiError } from "@/lib/api";
import { one, transaction } from "@/lib/db";

// Gera a malha de coleta massal (grade regular, padrão 30 m) dentro do talhão
// e grava as armadilhas como `planejadas`. O app de campo as recebe no pull e
// o pragueiro confirma cada ponto com o GPS real ao instalar.
const Schema = z.object({
  espacamento_m: z.number().min(5).max(500).optional(),
  prefixo: z.string().max(20).optional(),
  finalidade: z.enum(["monitoramento", "coleta_massal"]).default("coleta_massal"),
  substituir_planejadas: z.boolean().default(true),
});

export const POST = comSessao<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, sessao }) => {
  const { id } = await params;
  const d = await lerCorpo(req, Schema);
  const talhao = await one<{ id: string; nome: string; fazenda_id: string; espacamento_malha_m: string }>(
    `SELECT t.id, t.nome, t.fazenda_id, o.espacamento_malha_m
       FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id JOIN organizacao o ON o.id = f.organizacao_id
      WHERE t.id = $1 AND f.organizacao_id = $2 AND t.geom IS NOT NULL`,
    [id, sessao.organizacaoId],
  );
  if (!talhao) throw new ApiError(404, "Talhão não encontrado ou sem polígono");
  const espacamento = d.espacamento_m ?? Number(talhao.espacamento_malha_m) ?? 30;
  const prefixo = d.prefixo ?? talhao.nome.replace(/\s+/g, "").slice(0, 8).toUpperCase();

  const total = await transaction(async (q) => {
    if (d.substituir_planejadas) {
      await q(`DELETE FROM armadilha WHERE talhao_id = $1 AND status = 'planejada'`, [id]);
    }
    const rows = await q<{ n: string }>(
      `WITH pts AS (SELECT seq, geom FROM gerar_malha($1, $2))
       INSERT INTO armadilha (talhao_id, fazenda_id, codigo, finalidade, geom, instalada_em, status)
       SELECT $3, $4, $5 || '-' || lpad(seq::text, 3, '0'), $6, geom, now(), 'planejada' FROM pts
       ON CONFLICT (fazenda_id, codigo) DO NOTHING
       RETURNING 1 AS n`,
      [id, espacamento, id, talhao.fazenda_id, prefixo, d.finalidade],
    );
    return rows.length;
  });

  return json({ talhao_id: id, espacamento_m: espacamento, prefixo, armadilhas_planejadas: total });
}, ["admin", "gestor", "agronomo"]);
