import type { Metadata } from "next";
import Link from "next/link";
import { sessaoAtual } from "@/lib/auth";
import { armadilhasComStatus, fazendasDaOrganizacao } from "@/lib/consultas";
import { BadgeSepto, BadgeNivel } from "@/components/Badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { dataHora, numero } from "@/lib/formatar";

export const metadata: Metadata = { title: "Armadilhas" };

const FAIXAS = [
  { valor: "", rotulo: "Todas" },
  { valor: "critico", rotulo: "Septo vencido" },
  { valor: "aviso", rotulo: "Trocar em breve" },
  { valor: "ok", rotulo: "Em dia" },
  { valor: "sem_septo", rotulo: "Sem septo" },
];

export default async function ArmadilhasPage({ searchParams }: PageProps<"/armadilhas">) {
  const sp = await searchParams;
  const sessao = (await sessaoAtual())!;
  const fazenda = typeof sp.fazenda === "string" && sp.fazenda ? sp.fazenda : null;
  const faixa = typeof sp.faixa === "string" && sp.faixa ? sp.faixa : null;
  const busca = typeof sp.busca === "string" ? sp.busca.trim().toLowerCase() : "";

  const [fazendas, lista] = await Promise.all([
    fazendasDaOrganizacao(sessao.organizacaoId),
    armadilhasComStatus(sessao.organizacaoId, { fazenda, faixa }),
  ]);
  const filtradas = busca ? lista.filter((a) => a.codigo.toLowerCase().includes(busca) || (a.talhao ?? "").toLowerCase().includes(busca)) : lista;
  const contagem = {
    total: lista.length,
    ativas: lista.filter((a) => a.status === "ativa").length,
    planejadas: lista.filter((a) => a.status === "planejada").length,
  };

  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const f = "fazenda" in patch ? patch.fazenda : fazenda;
    const x = "faixa" in patch ? patch.faixa : faixa;
    if (f) q.set("fazenda", f);
    if (x) q.set("faixa", x);
    if (busca) q.set("busca", busca);
    const s = q.toString();
    return s ? `/armadilhas?${s}` : "/armadilhas";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Armadilhas</h1>
          <p className="text-sm text-texto-suave mt-1">
            {numero(contagem.ativas)} ativas · {numero(contagem.planejadas)} planejadas (aguardando instalação no campo)
          </p>
        </div>
        <form className="flex gap-2" action="/armadilhas">
          {fazenda && <input type="hidden" name="fazenda" value={fazenda} />}
          {faixa && <input type="hidden" name="faixa" value={faixa} />}
          <input name="busca" defaultValue={busca} placeholder="Buscar código ou talhão" className="campo !w-56" />
        </form>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-borda bg-superficie p-1">
          {FAIXAS.map((f) => (
            <Link
              key={f.valor}
              href={link({ faixa: f.valor || null })}
              className={`rounded-md px-3 py-1 text-xs font-medium ${(faixa ?? "") === f.valor ? "bg-marca text-white" : "text-texto-suave hover:bg-fundo"}`}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-borda bg-superficie p-1 overflow-x-auto">
          <Link href={link({ fazenda: null })} className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${!fazenda ? "bg-marca text-white" : "text-texto-suave hover:bg-fundo"}`}>Todas as fazendas</Link>
          {fazendas.map((f) => (
            <Link key={f.id} href={link({ fazenda: f.id })} className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${fazenda === f.id ? "bg-marca text-white" : "text-texto-suave hover:bg-fundo"}`}>{f.nome}</Link>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtradas.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fazenda / talhão</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Septo</TableHead>
                  <TableHead>Vence em</TableHead>
                  <TableHead>Última vistoria</TableHead>
                  <TableHead className="text-right">Contagem</TableHead>
                  <TableHead>Infestação</TableHead>
                  <TableHead>Coordenadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.codigo}
                      {a.status === "planejada" && <Badge variant="outline" className="ml-2">planejada</Badge>}
                      {a.status === "perdida" && <Badge variant="destructive" className="ml-2">perdida</Badge>}
                    </TableCell>
                    <TableCell>{a.fazenda}{a.talhao ? <span className="text-texto-suave"> · {a.talhao}</span> : null}</TableCell>
                    <TableCell className="text-texto-suave">{a.finalidade === "coleta_massal" ? "Coleta massal" : "Monitoramento"}</TableCell>
                    <TableCell>{a.status === "ativa" ? <BadgeSepto faixa={a.faixa_septo} dias={a.dias_septo} /> : <span className="text-texto-suave">—</span>}</TableCell>
                    <TableCell className="text-texto-suave">{a.septo_fim_previsto ? dataHora(a.septo_fim_previsto).slice(0, 8) : "—"}</TableCell>
                    <TableCell className="text-texto-suave">{dataHora(a.ultima_vistoria_em)}</TableCell>
                    <TableCell className="text-right font-mono">{numero(a.ultima_contagem)}</TableCell>
                    <TableCell><BadgeNivel nivel={a.nivel_infestacao} /></TableCell>
                    <TableCell className="font-mono text-xs text-texto-suave">{Number(a.lat).toFixed(5)}, {Number(a.lon).toFixed(5)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>Nenhuma armadilha encontrada</EmptyTitle>
                <EmptyDescription>
                  {lista.length ? "Ajuste os filtros ou a busca." : "As armadilhas aparecem aqui assim que o pragueiro sincronizar o aplicativo — ou gere a malha em Fazendas e talhões."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
