import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo, param, ApiError } from "@/lib/api";
import { query, one } from "@/lib/db";

export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const fazenda = param(req, "fazenda");
  const rows = await query(
    `SELECT t.id, t.fazenda_id, f.nome AS fazenda, t.nome, t.variedade, t.corte, t.ano_programa, t.area_ha, t.origem,
            ST_AsGeoJSON(t.geom)::json AS geom,
            (SELECT count(*) FROM armadilha a WHERE a.talhao_id = t.id AND a.status IN ('ativa','planejada'))::int AS armadilhas
       FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
      WHERE f.organizacao_id = $1 AND ($2::uuid IS NULL OR t.fazenda_id = $2)
      ORDER BY f.nome, t.nome`,
    [sessao.organizacaoId, fazenda],
  );
  return json(rows);
});

const Schema = z.object({
  fazenda_id: z.string().uuid(),
  nome: z.string().min(1).max(120),
  variedade: z.string().max(60).optional(),
  corte: z.number().int().min(1).max(15).optional(),
  ano_programa: z.number().int().min(1).max(3).optional(),
  origem: z.enum(["desenho", "kml", "geojson", "shp", "gps"]).default("desenho"),
  geom: z.any(), // GeoJSON Polygon ou MultiPolygon
});

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  const faz = await one(`SELECT id FROM fazenda WHERE id = $1 AND organizacao_id = $2`, [d.fazenda_id, sessao.organizacaoId]);
  if (!faz) throw new ApiError(404, "Fazenda não encontrada");
  const [row] = await query(
    `INSERT INTO talhao (fazenda_id, nome, variedade, corte, ano_programa, origem, geom)
     VALUES ($1, $2, $3, $4, $5, $6, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))))
     RETURNING id, nome, area_ha`,
    [d.fazenda_id, d.nome, d.variedade ?? null, d.corte ?? null, d.ano_programa ?? null, d.origem, JSON.stringify(d.geom)],
  );
  return json(row, { status: 201 });
}, ["admin", "gestor", "agronomo"]);

export const DELETE = comSessao(async (req: NextRequest, { sessao }) => {
  const id = param(req, "id");
  if (!id) throw new ApiError(400, "id obrigatório");
  const res = await query(
    `DELETE FROM talhao t USING fazenda f
      WHERE t.id = $1 AND f.id = t.fazenda_id AND f.organizacao_id = $2
        AND NOT EXISTS (SELECT 1 FROM armadilha a WHERE a.talhao_id = t.id AND a.status = 'ativa')
      RETURNING t.id`,
    [id, sessao.organizacaoId],
  );
  if (!res.length) throw new ApiError(409, "Talhão não encontrado ou possui armadilhas ativas");
  return json({ ok: true });
}, ["admin", "gestor"]);
