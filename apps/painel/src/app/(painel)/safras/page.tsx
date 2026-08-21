import type { Metadata } from "next";
import { sessaoAtual } from "@/lib/auth";
import { query } from "@/lib/db";
import { SafrasClient, type Safra, type PontoCurva, type ResumoSafra } from "@/components/SafrasClient";

export const metadata: Metadata = { title: "Safras" };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function SafrasPage() {
  const sessao = (await sessaoAtual())!;
  const org = sessao.organizacaoId;

  const [safras, curva, resumos] = await Promise.all([
    query<Safra>(`SELECT id, rotulo, inicio::text, fim::text FROM safra WHERE organizacao_id = $1 ORDER BY inicio`, [org]),
    // média de machos/armadilha por mês de cada safra (todas as fazendas)
    query<{ safra: string; mes: string; machos: number; vistorias: number }>(
      `SELECT s.rotulo AS safra, to_char(date_trunc('month', v.realizada_em), 'YYYY-MM') AS mes,
              round(avg(v.adultos), 1)::float AS machos, count(*)::int AS vistorias
         FROM safra s
         JOIN fazenda f ON f.organizacao_id = s.organizacao_id
         JOIN armadilha a ON a.fazenda_id = f.id
         JOIN vistoria v ON v.armadilha_id = a.id AND v.corrige_vistoria_id IS NULL
                        AND v.realizada_em >= s.inicio AND v.realizada_em < s.fim + 1
        WHERE s.organizacao_id = $1
        GROUP BY s.rotulo, date_trunc('month', v.realizada_em)
        ORDER BY s.rotulo, date_trunc('month', v.realizada_em)`,
      [org],
    ),
    query<ResumoSafra>(
      `SELECT s.id, s.rotulo,
              (SELECT round(avg(v.adultos), 1) FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
                WHERE f.organizacao_id = s.organizacao_id AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= s.inicio AND v.realizada_em < s.fim + 1)::float AS machos_media,
              (SELECT count(*) FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
                WHERE f.organizacao_id = s.organizacao_id AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= s.inicio AND v.realizada_em < s.fim + 1)::int AS vistorias,
              (SELECT round(avg(t.larvas), 1) FROM trincheira t WHERE t.safra_id = s.id)::float AS larvas_media,
              (SELECT count(*) FROM trincheira t WHERE t.safra_id = s.id)::int AS trincheiras,
              (SELECT round(avg(p.tch), 1) FROM producao_talhao p WHERE p.safra_id = s.id AND NOT p.testemunha)::float AS tch_tratado,
              (SELECT round(avg(p.tch), 1) FROM producao_talhao p WHERE p.safra_id = s.id AND p.testemunha)::float AS tch_testemunha,
              (SELECT count(*) FROM producao_talhao p WHERE p.safra_id = s.id)::int AS talhoes_tch
         FROM safra s WHERE s.organizacao_id = $1 ORDER BY s.inicio`,
      [org],
    ),
  ]);

  // Eixo: meses da safra em ordem (nov, dez, jan, …) — usa a ordem da safra mais antiga como referência
  const ordemMeses = new Map<string, number>();
  for (const s of safras) {
    const ini = new Date(s.inicio + "T00:00:00Z");
    for (let i = 0; i < 12; i++) {
      const m = MESES[(ini.getUTCMonth() + i) % 12];
      if (!ordemMeses.has(m)) ordemMeses.set(m, ordemMeses.size);
    }
  }
  const pontos: PontoCurva[] = curva.map((c) => {
    const [, mm] = c.mes.split("-");
    const mes = MESES[Number(mm) - 1];
    return { safra: c.safra, mes, ordem: ordemMeses.get(mes) ?? 99, machos: c.machos, vistorias: c.vistorias };
  });

  return <SafrasClient safras={safras} pontos={pontos} resumos={resumos} podeEditar={["admin", "gestor", "agronomo"].includes(sessao.papel)} />;
}
