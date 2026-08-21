import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = comSessao(async (_req: NextRequest, { sessao }) => {
  const rows = await query(
    `SELECT f.id, f.nome, f.codigo, f.municipio, f.uf, ST_AsGeoJSON(f.limite)::json AS limite,
            (SELECT count(*) FROM talhao t WHERE t.fazenda_id = f.id)::int AS talhoes,
            (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'ativa')::int AS armadilhas_ativas,
            (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'planejada')::int AS armadilhas_planejadas
       FROM fazenda f WHERE f.organizacao_id = $1 ORDER BY f.nome`,
    [sessao.organizacaoId],
  );
  return json(rows);
});

const Schema = z.object({
  nome: z.string().min(2).max(120),
  codigo: z.string().max(40).optional(),
  municipio: z.string().max(120).optional(),
  uf: z.string().length(2).optional(),
  limite: z.any().optional(), // GeoJSON Polygon/MultiPolygon
});

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  const [row] = await query(
    `INSERT INTO fazenda (organizacao_id, nome, codigo, municipio, uf, limite)
     VALUES ($1, $2, $3, $4, $5,
             CASE WHEN $6::text IS NULL THEN NULL ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)) END)
     RETURNING id, nome`,
    [sessao.organizacaoId, d.nome, d.codigo ?? null, d.municipio ?? null, d.uf?.toUpperCase() ?? null, d.limite ? JSON.stringify(d.limite) : null],
  );
  return json(row, { status: 201 });
}, ["admin", "gestor", "agronomo"]);
