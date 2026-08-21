import type { Metadata } from "next";
import { sessaoAtual } from "@/lib/auth";
import { query } from "@/lib/db";
import { TalhoesClient, type FazendaResumo, type TalhaoResumo } from "@/components/TalhoesClient";

export const metadata: Metadata = { title: "Fazendas e talhões" };

export default async function TalhoesPage() {
  const sessao = (await sessaoAtual())!;
  const org = sessao.organizacaoId;
  const [fazendas, talhoes, cfg] = await Promise.all([
    query<FazendaResumo>(
      `SELECT f.id, f.nome, f.codigo, f.municipio, f.uf,
              (SELECT count(*) FROM talhao t WHERE t.fazenda_id = f.id)::int AS talhoes,
              (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'ativa')::int AS armadilhas_ativas,
              (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'planejada')::int AS armadilhas_planejadas
         FROM fazenda f WHERE f.organizacao_id = $1 ORDER BY f.nome`,
      [org],
    ),
    query<TalhaoResumo>(
      `SELECT t.id, t.fazenda_id, t.nome, t.variedade, t.corte, t.ano_programa, t.area_ha::float AS area_ha, t.origem,
              ST_AsGeoJSON(t.geom)::json AS geom,
              (SELECT count(*) FROM armadilha a WHERE a.talhao_id = t.id AND a.status = 'ativa')::int AS armadilhas_ativas,
              (SELECT count(*) FROM armadilha a WHERE a.talhao_id = t.id AND a.status = 'planejada')::int AS armadilhas_planejadas
         FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
        WHERE f.organizacao_id = $1 ORDER BY f.nome, t.nome`,
      [org],
    ),
    query<{ espacamento_malha_m: string }>(`SELECT espacamento_malha_m FROM organizacao WHERE id = $1`, [org]),
  ]);
  const podeEditar = ["admin", "gestor", "agronomo"].includes(sessao.papel);
  return (
    <TalhoesClient
      fazendas={fazendas}
      talhoes={talhoes}
      espacamentoPadrao={Number(cfg[0]?.espacamento_malha_m ?? 30)}
      podeEditar={podeEditar}
    />
  );
}
