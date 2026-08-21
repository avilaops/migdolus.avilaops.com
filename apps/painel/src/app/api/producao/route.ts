import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo, ApiError, param } from "@/lib/api";
import { query, one } from "@/lib/db";

// Produtividade (TCH) e larvas por trincheira lançadas pelo escritório.
// O app de campo também manda trincheiras pelo /sync/push.

export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const safra = param(req, "safra");
  const rows = await query(
    `SELECT t.id AS talhao_id, t.nome AS talhao, f.nome AS fazenda, t.area_ha, t.ano_programa,
            p.id AS producao_id, p.tch, p.testemunha, p.fonte,
            (SELECT round(avg(tr.larvas), 1) FROM trincheira tr WHERE tr.talhao_id = t.id AND ($2::uuid IS NULL OR tr.safra_id = $2)) AS larvas_media,
            (SELECT count(*) FROM trincheira tr WHERE tr.talhao_id = t.id AND ($2::uuid IS NULL OR tr.safra_id = $2))::int AS trincheiras
       FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
       LEFT JOIN producao_talhao p ON p.talhao_id = t.id AND p.safra_id = $2
      WHERE f.organizacao_id = $1 ORDER BY f.nome, t.nome`,
    [sessao.organizacaoId, safra],
  );
  return json(rows);
});

const Tch = z.object({
  tipo: z.literal("tch"),
  talhao_id: z.string().uuid(),
  safra_id: z.string().uuid(),
  tch: z.number().min(0).max(400).nullable(),
  testemunha: z.boolean().default(false),
  fonte: z.string().max(40).default("manual"),
});
const Trincheira = z.object({
  tipo: z.literal("trincheira"),
  talhao_id: z.string().uuid(),
  safra_id: z.string().uuid().nullable().optional(),
  realizada_em: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  larvas: z.number().int().min(0).max(10000),
  observacoes: z.string().max(500).optional(),
});
const Schema = z.discriminatedUnion("tipo", [Tch, Trincheira]);

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  const talhao = await one(`SELECT t.id FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id WHERE t.id = $1 AND f.organizacao_id = $2`, [d.talhao_id, sessao.organizacaoId]);
  if (!talhao) throw new ApiError(404, "Talhão não encontrado");

  if (d.tipo === "tch") {
    const safra = await one(`SELECT id FROM safra WHERE id = $1 AND organizacao_id = $2`, [d.safra_id, sessao.organizacaoId]);
    if (!safra) throw new ApiError(404, "Safra não encontrada");
    if (d.tch === null) {
      await query(`DELETE FROM producao_talhao WHERE talhao_id = $1 AND safra_id = $2`, [d.talhao_id, d.safra_id]);
      return json({ ok: true, removido: true });
    }
    const [row] = await query(
      `INSERT INTO producao_talhao (talhao_id, safra_id, tch, testemunha, fonte) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (talhao_id, safra_id) DO UPDATE SET tch = EXCLUDED.tch, testemunha = EXCLUDED.testemunha, fonte = EXCLUDED.fonte
       RETURNING id, tch, testemunha`,
      [d.talhao_id, d.safra_id, d.tch, d.testemunha, d.fonte],
    );
    return json(row);
  }

  const [row] = await query(
    `INSERT INTO trincheira (client_id, talhao_id, safra_id, usuario_id, realizada_em, larvas, observacoes)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) RETURNING id`,
    [d.talhao_id, d.safra_id ?? null, sessao.usuarioId, d.realizada_em, d.larvas, d.observacoes ?? null],
  );
  return json(row, { status: 201 });
}, ["admin", "gestor", "agronomo"]);
