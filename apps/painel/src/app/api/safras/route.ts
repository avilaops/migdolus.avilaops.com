import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo, ApiError, param } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = comSessao(async (_req: NextRequest, { sessao }) => {
  const rows = await query(
    `SELECT s.id, s.rotulo, s.inicio, s.fim,
            (SELECT count(*) FROM producao_talhao p WHERE p.safra_id = s.id)::int AS talhoes_com_tch,
            (SELECT count(*) FROM trincheira t WHERE t.safra_id = s.id)::int AS trincheiras
       FROM safra s WHERE s.organizacao_id = $1 ORDER BY s.inicio DESC`,
    [sessao.organizacaoId],
  );
  return json(rows);
});

const Schema = z.object({
  rotulo: z.string().min(4).max(20),            // "2026/27"
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  if (d.fim <= d.inicio) throw new ApiError(400, "Fim deve ser depois do início");
  try {
    const [row] = await query(
      `INSERT INTO safra (organizacao_id, rotulo, inicio, fim) VALUES ($1, $2, $3, $4) RETURNING id, rotulo, inicio, fim`,
      [sessao.organizacaoId, d.rotulo, d.inicio, d.fim],
    );
    return json(row, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ApiError(409, "Já existe safra com esse rótulo");
    throw e;
  }
}, ["admin", "gestor", "agronomo"]);

export const DELETE = comSessao(async (req: NextRequest, { sessao }) => {
  const id = param(req, "id");
  if (!id) throw new ApiError(400, "id obrigatório");
  const rows = await query(`DELETE FROM safra WHERE id = $1 AND organizacao_id = $2 RETURNING id`, [id, sessao.organizacaoId]);
  if (!rows.length) throw new ApiError(404, "Safra não encontrada");
  return json({ ok: true });
}, ["admin", "gestor"]);
