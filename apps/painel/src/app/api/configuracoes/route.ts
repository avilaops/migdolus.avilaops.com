import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo } from "@/lib/api";
import { one, query } from "@/lib/db";

export const GET = comSessao(async (_req: NextRequest, { sessao }) => {
  const org = await one(
    `SELECT id, nome, tipo, plano, dias_septo, dias_septo_aviso, espacamento_malha_m, faixa_media_min, faixa_alta_min, criado_em
       FROM organizacao WHERE id = $1`,
    [sessao.organizacaoId],
  );
  return json(org);
});

const Schema = z.object({
  nome: z.string().min(2).max(120).optional(),
  dias_septo: z.number().int().min(7).max(120).optional(),
  dias_septo_aviso: z.number().int().min(1).max(119).optional(),
  espacamento_malha_m: z.number().min(5).max(500).optional(),
  faixa_media_min: z.number().int().min(1).optional(),
  faixa_alta_min: z.number().int().min(2).optional(),
});

export const PATCH = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  const [row] = await query(
    `UPDATE organizacao SET
        nome = COALESCE($2, nome),
        dias_septo = COALESCE($3, dias_septo),
        dias_septo_aviso = COALESCE($4, dias_septo_aviso),
        espacamento_malha_m = COALESCE($5, espacamento_malha_m),
        faixa_media_min = COALESCE($6, faixa_media_min),
        faixa_alta_min = COALESCE($7, faixa_alta_min)
      WHERE id = $1
      RETURNING id, nome, dias_septo, dias_septo_aviso, espacamento_malha_m, faixa_media_min, faixa_alta_min`,
    [sessao.organizacaoId, d.nome ?? null, d.dias_septo ?? null, d.dias_septo_aviso ?? null, d.espacamento_malha_m ?? null, d.faixa_media_min ?? null, d.faixa_alta_min ?? null],
  );
  return json(row);
}, ["admin", "gestor"]);
