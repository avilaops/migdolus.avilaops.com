import Link from "next/link";
import { sessaoAtual } from "@/lib/auth";
import { resumoDaOrganizacao, armadilhasComStatus, vistoriasRecentes, capturasPorSemana } from "@/lib/consultas";
import { BadgeSepto } from "@/components/Badges";
import { GraficoCapturas } from "@/components/GraficoCapturas";
import { dataHora, numero } from "@/lib/formatar";

export default async function VisaoGeral() {
  const sessao = (await sessaoAtual())!;
  const org = sessao.organizacaoId;
  const [resumo, vencendo, recentes, semanas] = await Promise.all([
    resumoDaOrganizacao(org),
    armadilhasComStatus(org, { porPagina: 10 }).then((r) => r.linhas.filter((a) => a.status === "ativa" && a.faixa_septo !== "ok").slice(0, 8)),
    vistoriasRecentes(org, 8),
    capturasPorSemana(org, 12),
  ]);

  const vazio = resumo.armadilhas_ativas === 0 && resumo.armadilhas_planejadas === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-texto-suave mt-1">
            {resumo.ultima_sync ? `Última sincronização de campo: ${dataHora(resumo.ultima_sync)}` : "Nenhuma sincronização de campo ainda."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/talhoes" className="botao-secundario">Fazendas e talhões</Link>
          <Link href="/mapa" className="botao">Abrir mapa</Link>
        </div>
      </header>

      {vazio && (
        <section className="cartao p-6 border-marca/40 bg-marca-clara/40">
          <h2 className="font-semibold">Comece pela cartografia</h2>
          <p className="text-sm text-texto-suave mt-1 max-w-2xl">
            Cadastre a fazenda, desenhe ou importe os talhões e gere a malha de armadilhas (30 m para coleta massal).
            O pragueiro recebe os pontos no aplicativo e confirma cada um com o GPS ao instalar. Sem mapa prévio?
            Ele também pode instalar direto no campo — a malha nasce do GPS.
          </p>
          <Link href="/talhoes" className="botao mt-4">Cadastrar fazenda</Link>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi rotulo="Armadilhas ativas" valor={numero(resumo.armadilhas_ativas)} detalhe={`${numero(resumo.armadilhas_planejadas)} planejadas`} />
        <Kpi rotulo="Septo vencido" valor={numero(resumo.septo_critico)} tom={resumo.septo_critico ? "critico" : "ok"} detalhe={`${numero(resumo.septo_aviso)} trocar em breve`} />
        <Kpi rotulo="Adultos em 7 dias" valor={numero(resumo.adultos_7d)} detalhe={`${numero(resumo.vistorias_7d)} vistorias`} />
        <Kpi rotulo="Adultos em 30 dias" valor={numero(resumo.adultos_30d)} detalhe={`${numero(resumo.fotos_total)} fotos auditáveis`} />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="cartao p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Capturas por semana</h2>
            <span className="text-xs text-texto-suave">últimas 12 semanas · todas as fazendas</span>
          </div>
          {semanas.length ? <GraficoCapturas dados={semanas} /> : <Vazio texto="Sem vistorias no período." />}
        </div>
        <div className="cartao p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Troca de septo</h2>
            <Link href="/armadilhas?faixa=critico" className="text-xs text-marca hover:underline">ver todas</Link>
          </div>
          {vencendo.length ? (
            <ul className="divide-y divide-borda/70">
              {vencendo.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.codigo}</p>
                    <p className="text-xs text-texto-suave truncate">{a.fazenda}{a.talhao ? ` · ${a.talhao}` : ""}</p>
                  </div>
                  <BadgeSepto faixa={a.faixa_septo} dias={a.dias_septo} />
                </li>
              ))}
            </ul>
          ) : (
            <Vazio texto="Nenhuma armadilha perto do vencimento." />
          )}
        </div>
      </section>

      <section className="cartao p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Últimas vistorias</h2>
          <span className="text-xs text-texto-suave">{numero(resumo.pragueiros_ativos_7d)} pragueiros ativos nos últimos 7 dias</span>
        </div>
        {recentes.length ? (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr><th>Quando</th><th>Armadilha</th><th>Fazenda / talhão</th><th>Pragueiro</th><th className="text-right">Adultos</th><th>Septo</th><th>Fotos</th><th>Distância</th></tr>
              </thead>
              <tbody>
                {recentes.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{dataHora(v.realizada_em)}</td>
                    <td className="font-medium">{v.codigo}</td>
                    <td>{v.fazenda}{v.talhao ? ` · ${v.talhao}` : ""}</td>
                    <td>{v.pragueiro ?? "—"}</td>
                    <td className="text-right font-mono">{numero(v.adultos)}</td>
                    <td>{v.troca_septo ? "trocado" : "—"}</td>
                    <td>{v.fotos || "—"}</td>
                    <td className="text-texto-suave">{v.distancia_m ? `${numero(v.distancia_m)} m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio texto="Nenhuma vistoria sincronizada ainda." />
        )}
      </section>
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, tom = "neutro" }: { rotulo: string; valor: string; detalhe?: string; tom?: "neutro" | "ok" | "critico" }) {
  const cor = tom === "critico" ? "text-critico" : tom === "ok" ? "text-marca" : "";
  return (
    <div className="cartao p-5">
      <p className="rotulo">{rotulo}</p>
      <p className={`text-3xl font-semibold mt-2 ${cor}`}>{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave mt-1">{detalhe}</p>}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-texto-suave py-8 text-center">{texto}</p>;
}
