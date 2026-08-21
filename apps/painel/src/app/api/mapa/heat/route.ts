import type { NextRequest } from "next/server";
import { comSessao, json, param } from "@/lib/api";
import { query } from "@/lib/db";

// GeoJSON das armadilhas com peso para o heatmap (soma de adultos no período)
// e as faixas de septo/infestação para a camada de pontos.
export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const fazenda = param(req, "fazenda");
  const de = param(req, "de") || "1970-01-01";
  const ate = param(req, "ate") || "2999-12-31";

  const rows = await query<{
    id: string; codigo: string; lat: number; lon: number; faixa_septo: string; nivel_infestacao: string | null;
    ultima_contagem: number | null; dias_septo: number | null; adultos_periodo: number; vistorias_periodo: number; talhao: string | null; fazenda: string;
  }>(
    `SELECT s.id, s.codigo, ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon, s.faixa_septo, s.nivel_infestacao, s.ultima_contagem, s.dias_septo,
            COALESCE(p.adultos, 0)::int AS adultos_periodo, COALESCE(p.n, 0)::int AS vistorias_periodo, t.nome AS talhao, f.nome AS fazenda
       FROM v_armadilha_status s
       JOIN fazenda f ON f.id = s.fazenda_id
       LEFT JOIN talhao t ON t.id = s.talhao_id
       LEFT JOIN LATERAL (
         SELECT sum(v.adultos) AS adultos, count(*) AS n FROM vistoria v
          WHERE v.armadilha_id = s.id AND v.corrige_vistoria_id IS NULL
            AND v.realizada_em >= $3::date AND v.realizada_em < ($4::date + 1)
       ) p ON true
      WHERE f.organizacao_id = $1 AND ($2::uuid IS NULL OR s.fazenda_id = $2) AND s.status <> 'removida'`,
    [sessao.organizacaoId, fazenda, de, ate],
  );

  const talhoes = await query<{ id: string; nome: string; geom: unknown; area_ha: string | null }>(
    `SELECT t.id, t.nome, ST_AsGeoJSON(t.geom)::json AS geom, t.area_ha
       FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
      WHERE f.organizacao_id = $1 AND ($2::uuid IS NULL OR t.fazenda_id = $2) AND t.geom IS NOT NULL`,
    [sessao.organizacaoId, fazenda],
  );

  const max = Math.max(1, ...rows.map((r) => r.adultos_periodo));
  return json({
    armadilhas: {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: { ...r, peso: r.adultos_periodo / max },
      })),
    },
    talhoes: {
      type: "FeatureCollection",
      features: talhoes.map((t) => ({ type: "Feature", geometry: t.geom, properties: { id: t.id, nome: t.nome, area_ha: t.area_ha } })),
    },
    max_adultos: max,
  });
});
