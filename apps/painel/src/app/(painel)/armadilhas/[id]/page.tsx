import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { BadgeSepto, BadgeNivel } from "@/components/Badges";
import { GraficoContagens } from "@/components/GraficoContagens";
import { GaleriaFotos } from "@/components/GaleriaFotos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dataHora, data, numero } from "@/lib/formatar";

export const metadata: Metadata = { title: "Armadilha" };

export default async function ArmadilhaPage({ params }: PageProps<"/armadilhas/[id]">) {
  const { id } = await params;
  const sessao = (await sessaoAtual())!;
  const org = sessao.organizacaoId;

  const a = await one<{
    id: string; codigo: string; fazenda: string; fazenda_id: string; talhao: string | null; finalidade: string; status: string;
    lat: number; lon: number; precisao_m: string | null; instalada_em: string; instalada_por: string | null; observacoes: string | null;
    septo_inicio: string | null; septo_fim_previsto: string | null; dias_septo: number | null; faixa_septo: string;
    ultima_vistoria_em: string | null; ultima_contagem: number | null; nivel_infestacao: string | null;
  }>(
    `SELECT s.id, s.codigo, f.nome AS fazenda, f.id AS fazenda_id, t.nome AS talhao, s.finalidade, s.status,
            ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon, a.precisao_m, a.instalada_em, u.nome AS instalada_por, a.observacoes,
            s.septo_inicio, s.septo_fim_previsto, s.dias_septo, s.faixa_septo, s.ultima_vistoria_em, s.ultima_contagem, s.nivel_infestacao
       FROM v_armadilha_status s
       JOIN armadilha a ON a.id = s.id
       JOIN fazenda f ON f.id = s.fazenda_id
       LEFT JOIN talhao t ON t.id = s.talhao_id
       LEFT JOIN usuario u ON u.id = a.instalada_por
      WHERE s.id = $1 AND f.organizacao_id = $2`,
    [id, org],
  );
  if (!a) notFound();

  const [vistorias, ciclos, fotos] = await Promise.all([
    query<{ id: string; realizada_em: string; adultos: number; troca_septo: boolean; pragueiro: string | null; distancia_m: string | null; precisao_baixa: boolean; observacoes: string | null; fotos: number }>(
      `SELECT v.id, v.realizada_em, v.adultos, v.troca_septo, u.nome AS pragueiro, v.distancia_m, v.precisao_baixa, v.observacoes,
              (SELECT count(*) FROM foto fo WHERE fo.vistoria_id = v.id)::int AS fotos
         FROM vistoria v LEFT JOIN usuario u ON u.id = v.usuario_id
        WHERE v.armadilha_id = $1 AND v.corrige_vistoria_id IS NULL ORDER BY v.realizada_em DESC LIMIT 200`,
      [id],
    ),
    query<{ id: string; inicio: string; fim_previsto: string; trocado_em: string | null; lote_septo: string | null; dias: number }>(
      `SELECT id, inicio, fim_previsto, trocado_em, lote_septo,
              EXTRACT(day FROM COALESCE(trocado_em, now()) - inicio)::int AS dias
         FROM ciclo_feromonio WHERE armadilha_id = $1 ORDER BY inicio DESC`,
      [id],
    ),
    query<{ id: string; tirada_em: string | null; lat: number | null; lon: number | null; vistoria_id: string | null }>(
      `SELECT id, tirada_em, ST_Y(geom) AS lat, ST_X(geom) AS lon, vistoria_id FROM foto WHERE armadilha_id = $1 ORDER BY tirada_em DESC NULLS LAST LIMIT 60`,
      [id],
    ),
  ]);

  const serie = [...vistorias].reverse().map((v) => ({ data: data(v.realizada_em), adultos: v.adultos, troca: v.troca_septo }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-texto-suave"><Link href="/armadilhas" className="hover:underline">Armadilhas</Link> / {a.fazenda}{a.talhao ? ` / ${a.talhao}` : ""}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 flex items-center gap-3">
            {a.codigo}
            {a.status === "planejada" && <Badge variant="outline">planejada</Badge>}
            {a.status === "ativa" && <BadgeSepto faixa={a.faixa_septo} dias={a.dias_septo} />}
          </h1>
          <p className="text-sm text-texto-suave mt-1">
            {a.finalidade === "coleta_massal" ? "Coleta massal" : "Monitoramento"} · instalada em {data(a.instalada_em)}{a.instalada_por ? ` por ${a.instalada_por}` : ""}
            {a.observacoes ? ` · ${a.observacoes}` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-texto-suave">{Number(a.lat).toFixed(6)}, {Number(a.lon).toFixed(6)}{a.precisao_m ? ` (±${numero(a.precisao_m)} m)` : ""}</p>
          <a className="text-marca hover:underline text-xs" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${a.lat},${a.lon}`}>abrir no Google Maps</a>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi rotulo="Última contagem" valor={numero(a.ultima_contagem)} detalhe={a.ultima_vistoria_em ? dataHora(a.ultima_vistoria_em) : "sem vistoria"} />
        <Kpi rotulo="Infestação" valor={<BadgeNivel nivel={a.nivel_infestacao} />} />
        <Kpi rotulo="Septo atual" valor={a.dias_septo !== null ? `${a.dias_septo} d` : "—"} detalhe={a.septo_fim_previsto ? `vence ${data(a.septo_fim_previsto)}` : "sem septo"} tom={a.faixa_septo === "critico" ? "critico" : "neutro"} />
        <Kpi rotulo="Vistorias · fotos" valor={`${vistorias.length} · ${fotos.length}`} detalhe={`${ciclos.length} ciclo(s) de septo`} />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Evolução das capturas</CardTitle></CardHeader>
          <CardContent>{serie.length ? <GraficoContagens dados={serie} /> : <p className="text-sm text-texto-suave py-8 text-center">Sem vistorias ainda.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ciclos de feromônio</CardTitle></CardHeader>
          <CardContent className="p-0">
            {ciclos.length ? (
              <ul className="divide-y divide-borda/70 text-sm">
                {ciclos.map((c) => (
                  <li key={c.id} className="px-6 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{data(c.inicio)} → {c.trocado_em ? data(c.trocado_em) : "em uso"}</p>
                      <p className="text-xs text-texto-suave">{c.lote_septo ? `lote ${c.lote_septo} · ` : ""}{c.dias} dias</p>
                    </div>
                    {!c.trocado_em && <BadgeSepto faixa={a.faixa_septo} dias={a.dias_septo} />}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-texto-suave p-6">Nenhum septo registrado.</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Galeria de fotos ({fotos.length})</CardTitle></CardHeader>
        <CardContent>
          {fotos.length ? <GaleriaFotos fotos={fotos.map((f) => ({ id: f.id, url: `/api/fotos/${f.id}`, tirada_em: f.tirada_em, lat: f.lat, lon: f.lon }))} codigo={a.codigo} /> : <p className="text-sm text-texto-suave py-6 text-center">Nenhuma foto sincronizada — cada vistoria no app gera a foto carimbada da bacia.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vistorias</CardTitle></CardHeader>
        <CardContent className="p-0">
          {vistorias.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Pragueiro</TableHead><TableHead className="text-right">Adultos</TableHead><TableHead>Septo</TableHead><TableHead>GPS</TableHead><TableHead>Fotos</TableHead><TableHead>Observações</TableHead></TableRow></TableHeader>
              <TableBody>
                {vistorias.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap">{dataHora(v.realizada_em)}</TableCell>
                    <TableCell>{v.pragueiro ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{numero(v.adultos)}</TableCell>
                    <TableCell>{v.troca_septo ? <Badge variant="outline">trocado</Badge> : "—"}</TableCell>
                    <TableCell className="text-texto-suave text-xs">{v.distancia_m ? `${numero(v.distancia_m)} m do ponto` : "—"}{v.precisao_baixa ? " · precisão baixa" : ""}</TableCell>
                    <TableCell>{v.fotos || "—"}</TableCell>
                    <TableCell className="text-texto-suave max-w-xs truncate">{v.observacoes ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-texto-suave p-6">Nenhuma vistoria.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, tom = "neutro" }: { rotulo: string; valor: React.ReactNode; detalhe?: string; tom?: "neutro" | "critico" }) {
  return (
    <div className="cartao p-5">
      <p className="rotulo">{rotulo}</p>
      <div className={`text-2xl font-semibold mt-2 ${tom === "critico" ? "text-critico" : ""}`}>{valor}</div>
      {detalhe && <p className="text-xs text-texto-suave mt-1">{detalhe}</p>}
    </div>
  );
}
