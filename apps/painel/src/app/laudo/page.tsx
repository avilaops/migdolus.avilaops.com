import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { MapaLaudo } from "@/components/MapaLaudo";
import { GraficoCapturas } from "@/components/GraficoCapturas";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { data, dataHora, numero, ROTULO_FAIXA, ROTULO_NIVEL } from "@/lib/formatar";

export const metadata: Metadata = { title: "Laudo técnico" };

export default async function LaudoPage({ searchParams }: PageProps<"/laudo">) {
  const sp = await searchParams;
  const sessao = (await sessaoAtual())!;
  const org = sessao.organizacaoId;
  const fazendaId = typeof sp.fazenda === "string" ? sp.fazenda : "";
  if (!/^[0-9a-f-]{36}$/i.test(fazendaId)) notFound();
  const de = typeof sp.de === "string" && sp.de ? sp.de : "1970-01-01";
  const ate = typeof sp.ate === "string" && sp.ate ? sp.ate : new Date().toISOString().slice(0, 10);

  const organizacao = await one<{ nome: string; dias_septo: number; faixa_media_min: number; faixa_alta_min: number }>(`SELECT nome, dias_septo, faixa_media_min, faixa_alta_min FROM organizacao WHERE id = $1`, [org]);
  const fazenda = await one<{ id: string; nome: string; municipio: string | null; uf: string | null; codigo: string | null }>(`SELECT id, nome, municipio, uf, codigo FROM fazenda WHERE id = $1 AND organizacao_id = $2`, [fazendaId, org]);
  if (!fazenda || !organizacao) notFound();

  const [resumo, talhoes, semanas, septos, fotos, topArmadilhas] = await Promise.all([
    one<Record<string, string | null>>(
      `SELECT (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = $1 AND a.status = 'ativa') AS ativas,
              count(v.id) AS vistorias, COALESCE(sum(v.adultos),0) AS adultos, round(avg(v.adultos),1) AS media, max(v.adultos) AS maximo,
              count(DISTINCT v.usuario_id) AS pragueiros,
              (SELECT count(*) FROM v_armadilha_status s WHERE s.fazenda_id = $1 AND s.status = 'ativa' AND s.faixa_septo = 'critico') AS septo_critico,
              (SELECT count(*) FROM foto fo JOIN armadilha a ON a.id = fo.armadilha_id WHERE a.fazenda_id = $1 AND fo.tirada_em >= $2::date AND fo.tirada_em < ($3::date + 1)) AS fotos
         FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id
        WHERE a.fazenda_id = $1 AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= $2::date AND v.realizada_em < ($3::date + 1)`,
      [fazendaId, de, ate],
    ),
    query<{ talhao: string; area_ha: string | null; armadilhas: number; vistorias: number; adultos: number; media: string | null; maximo: number | null }>(
      `SELECT COALESCE(t.nome, '(sem talhão)') AS talhao, t.area_ha,
              count(DISTINCT a.id)::int AS armadilhas, count(v.id)::int AS vistorias, COALESCE(sum(v.adultos),0)::int AS adultos,
              round(avg(v.adultos),1) AS media, max(v.adultos) AS maximo
         FROM armadilha a LEFT JOIN talhao t ON t.id = a.talhao_id
         LEFT JOIN vistoria v ON v.armadilha_id = a.id AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= $2::date AND v.realizada_em < ($3::date + 1)
        WHERE a.fazenda_id = $1 AND a.status = 'ativa'
        GROUP BY t.nome, t.area_ha ORDER BY adultos DESC, t.nome`,
      [fazendaId, de, ate],
    ),
    query<{ semana: string; adultos: number; vistorias: number; media: number }>(
      `SELECT to_char(date_trunc('week', v.realizada_em), 'DD/MM') AS semana, sum(v.adultos)::int AS adultos, count(*)::int AS vistorias, round(avg(v.adultos),1)::float AS media
         FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id
        WHERE a.fazenda_id = $1 AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= $2::date AND v.realizada_em < ($3::date + 1)
        GROUP BY date_trunc('week', v.realizada_em) ORDER BY date_trunc('week', v.realizada_em)`,
      [fazendaId, de, ate],
    ),
    query<{ codigo: string; talhao: string | null; dias_septo: number | null; faixa_septo: string; septo_fim_previsto: string | null }>(
      `SELECT s.codigo, t.nome AS talhao, s.dias_septo, s.faixa_septo, s.septo_fim_previsto
         FROM v_armadilha_status s LEFT JOIN talhao t ON t.id = s.talhao_id
        WHERE s.fazenda_id = $1 AND s.status = 'ativa' AND s.faixa_septo IN ('critico','aviso','sem_septo')
        ORDER BY CASE s.faixa_septo WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END, s.codigo`,
      [fazendaId],
    ),
    query<{ id: string; codigo: string; tirada_em: string | null; lat: number | null; lon: number | null }>(
      `SELECT fo.id, a.codigo, fo.tirada_em, ST_Y(fo.geom) AS lat, ST_X(fo.geom) AS lon
         FROM foto fo JOIN armadilha a ON a.id = fo.armadilha_id
        WHERE a.fazenda_id = $1 AND fo.tirada_em >= $2::date AND fo.tirada_em < ($3::date + 1)
        ORDER BY fo.tirada_em DESC LIMIT 12`,
      [fazendaId, de, ate],
    ),
    query<{ codigo: string; talhao: string | null; adultos: number; vistorias: number }>(
      `SELECT a.codigo, t.nome AS talhao, sum(v.adultos)::int AS adultos, count(*)::int AS vistorias
         FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id LEFT JOIN talhao t ON t.id = a.talhao_id
        WHERE a.fazenda_id = $1 AND v.corrige_vistoria_id IS NULL AND v.realizada_em >= $2::date AND v.realizada_em < ($3::date + 1)
        GROUP BY a.codigo, t.nome ORDER BY adultos DESC LIMIT 10`,
      [fazendaId, de, ate],
    ),
  ]);

  const n = (k: string) => Number(resumo?.[k] ?? 0);
  const nivel = (media: string | null) => {
    if (media === null) return "—";
    const m = Number(media);
    return m >= organizacao.faixa_alta_min ? ROTULO_NIVEL.alto : m >= organizacao.faixa_media_min ? ROTULO_NIVEL.medio : ROTULO_NIVEL.baixo;
  };

  return (
    <main className="laudo mx-auto max-w-4xl bg-white text-[#14201a] p-8 print:p-0 space-y-8">
      <div className="no-print flex justify-end gap-2"><BotaoImprimir /></div>

      <header className="border-b-2 border-marca pb-4">
        <p className="text-xs uppercase tracking-widest text-texto-suave">Laudo técnico de monitoramento · <em>Migdolus fryanus</em></p>
        <h1 className="text-3xl font-semibold mt-1">{fazenda.nome}</h1>
        <p className="text-sm text-texto-suave mt-1">
          {organizacao.nome}{fazenda.municipio ? ` · ${fazenda.municipio}${fazenda.uf ? "/" + fazenda.uf : ""}` : ""}{fazenda.codigo ? ` · cód. ${fazenda.codigo}` : ""}
        </p>
        <p className="text-sm mt-2">Período: <strong>{data(de)} a {data(ate)}</strong> · emitido em {dataHora(new Date())} · Migdolus Monitor / Avila Ops</p>
      </header>

      <section className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
        {[
          ["Armadilhas ativas", numero(n("ativas"))],
          ["Vistorias", numero(n("vistorias"))],
          ["Adultos capturados", numero(n("adultos"))],
          ["Média/vistoria", numero(resumo?.media, 1)],
          ["Máximo", numero(resumo?.maximo)],
          ["Septos vencidos", numero(n("septo_critico"))],
        ].map(([r, v]) => (
          <div key={r} className="rounded-lg border border-borda p-3">
            <p className="text-[10px] uppercase tracking-wide text-texto-suave">{r}</p>
            <p className="text-xl font-semibold mt-1">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Mapa de calor</h2>
        <MapaLaudo fazenda={fazendaId} de={de} ate={ate} />
        <p className="text-xs text-texto-suave mt-1">Pontos: nível de infestação na última vistoria (verde baixo, amarelo médio, vermelho alto). Calor ponderado pelos adultos capturados no período.</p>
      </section>

      <section className="avoid-break">
        <h2 className="text-lg font-semibold mb-2">Capturas por talhão</h2>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-borda text-left text-xs uppercase text-texto-suave"><th className="py-1.5">Talhão</th><th>Área (ha)</th><th className="text-right">Armadilhas</th><th className="text-right">Vistorias</th><th className="text-right">Adultos</th><th className="text-right">Média</th><th className="text-right">Máx.</th><th>Nível</th></tr></thead>
          <tbody>
            {talhoes.map((t) => (
              <tr key={t.talhao} className="border-b border-borda/60">
                <td className="py-1.5 font-medium">{t.talhao}</td><td>{numero(t.area_ha, 1)}</td>
                <td className="text-right">{t.armadilhas}</td><td className="text-right">{t.vistorias}</td><td className="text-right font-mono">{numero(t.adultos)}</td>
                <td className="text-right">{numero(t.media, 1)}</td><td className="text-right">{numero(t.maximo)}</td><td>{nivel(t.media)}</td>
              </tr>
            ))}
            {!talhoes.length && <tr><td colSpan={8} className="py-4 text-center text-texto-suave">Sem armadilhas ativas nesta fazenda.</td></tr>}
          </tbody>
        </table>
        <p className="text-xs text-texto-suave mt-1">Níveis: médio a partir de {organizacao.faixa_media_min}, alto a partir de {organizacao.faixa_alta_min} adultos/armadilha (parâmetros da organização).</p>
      </section>

      <section className="grid md:grid-cols-2 gap-6 avoid-break">
        <div>
          <h2 className="text-lg font-semibold mb-2">Evolução semanal</h2>
          {semanas.length ? <GraficoCapturas dados={semanas} /> : <p className="text-sm text-texto-suave">Sem vistorias no período.</p>}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Armadilhas com mais capturas</h2>
          <table className="w-full text-sm">
            <tbody>
              {topArmadilhas.map((a) => (
                <tr key={a.codigo} className="border-b border-borda/60"><td className="py-1 font-medium">{a.codigo}</td><td className="text-texto-suave">{a.talhao ?? ""}</td><td className="text-right font-mono">{numero(a.adultos)}</td><td className="text-right text-xs text-texto-suave">{a.vistorias} vist.</td></tr>
              ))}
              {!topArmadilhas.length && <tr><td className="py-2 text-texto-suave">—</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="avoid-break">
        <h2 className="text-lg font-semibold mb-2">Troca de feromônio ({organizacao.dias_septo} dias)</h2>
        {septos.length ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-borda text-left text-xs uppercase text-texto-suave"><th className="py-1.5">Armadilha</th><th>Talhão</th><th>Dias de uso</th><th>Situação</th><th>Vence em</th></tr></thead>
            <tbody>{septos.map((s) => <tr key={s.codigo} className="border-b border-borda/60"><td className="py-1.5 font-medium">{s.codigo}</td><td>{s.talhao ?? "—"}</td><td>{s.dias_septo ?? "—"}</td><td>{ROTULO_FAIXA[s.faixa_septo]}</td><td>{data(s.septo_fim_previsto)}</td></tr>)}</tbody>
          </table>
        ) : <p className="text-sm text-marca">Todos os septos dentro do prazo.</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Registro fotográfico ({numero(n("fotos"))} no período — últimas 12)</h2>
        {fotos.length ? (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {fotos.map((f) => (
              <figure key={f.id} className="avoid-break">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fotos/${f.id}`} alt={f.codigo} className="aspect-square w-full object-cover rounded border border-borda" />
                <figcaption className="text-[10px] text-texto-suave mt-0.5 font-mono">{f.codigo} · {dataHora(f.tirada_em)}{f.lat !== null ? ` · ${Number(f.lat).toFixed(5)}, ${Number(f.lon).toFixed(5)}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="text-sm text-texto-suave">Nenhuma foto sincronizada no período.</p>}
      </section>

      <footer className="border-t border-borda pt-3 text-xs text-texto-suave">
        Dados coletados em campo com GPS e foto carimbada pelo aplicativo Migdolus Campo; {numero(n("pragueiros"))} pragueiro(s) no período. Laudo gerado por migdolus.avilaops.com.
      </footer>
    </main>
  );
}
