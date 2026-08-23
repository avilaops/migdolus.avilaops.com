import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sessaoAtual } from "@/lib/auth";
import { armadilhasComStatus, contagemArmadilhas, fazendasDaOrganizacao } from "@/lib/consultas";
import { BadgeSepto, BadgeNivel } from "@/components/Badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { dataHora, numero } from "@/lib/formatar";

export const metadata: Metadata = { title: "Armadilhas" };

export default async function ArmadilhasPage({ searchParams }: PageProps<"/armadilhas">) {
  const sp = await searchParams;
  const sessao = (await sessaoAtual())!;
  const fazenda = typeof sp.fazenda === "string" && sp.fazenda ? sp.fazenda : null;
  const faixa = typeof sp.faixa === "string" && sp.faixa ? sp.faixa : null;
  const busca = typeof sp.busca === "string" ? sp.busca.trim() : "";
  const pagina = Math.max(1, Number(typeof sp.pagina === "string" ? sp.pagina : 1) || 1);

  const [fazendas, resultado, contagem] = await Promise.all([
    fazendasDaOrganizacao(sessao.organizacaoId),
    armadilhasComStatus(sessao.organizacaoId, { fazenda, faixa, busca: busca || null, pagina, porPagina: 50 }),
    contagemArmadilhas(sessao.organizacaoId, fazenda),
  ]);
  const { linhas, total, porPagina } = resultado;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const de = total === 0 ? 0 : (paginaAtual - 1) * porPagina + 1;
  const ate = Math.min(paginaAtual * porPagina, total);

  const FAIXAS = [
    { valor: "", rotulo: `Todas (${numero(contagem.total)})` },
    { valor: "critico", rotulo: `Septo vencido (${numero(contagem.critico)})` },
    { valor: "aviso", rotulo: `Trocar em breve (${numero(contagem.aviso)})` },
    { valor: "ok", rotulo: `Em dia (${numero(contagem.ok)})` },
    { valor: "sem_septo", rotulo: `Sem septo (${numero(contagem.sem_septo)})` },
  ];

  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const f = "fazenda" in patch ? patch.fazenda : fazenda;
    const x = "faixa" in patch ? patch.faixa : faixa;
    const p = "pagina" in patch ? patch.pagina : null; // mudar filtro volta à página 1
    if (f) q.set("fazenda", f);
    if (x) q.set("faixa", x);
    if (busca) q.set("busca", busca);
    if (p && p !== "1") q.set("pagina", p);
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
        <div className="flex gap-1 rounded-lg border border-borda bg-superficie p-1 overflow-x-auto">
          {FAIXAS.map((f) => (
            <Link
              key={f.valor}
              href={link({ faixa: f.valor || null })}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${(faixa ?? "") === f.valor ? "bg-marca text-white" : "text-texto-suave hover:bg-fundo"}`}
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
          {linhas.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Fazenda / talhão</TableHead>
                    <TableHead>Finalidade</TableHead>
                    <TableHead>Septo</TableHead>
                    <TableHead>Última vistoria</TableHead>
                    <TableHead className="text-right">Contagem</TableHead>
                    <TableHead>Infestação</TableHead>
                    <TableHead>Coordenadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <Link href={`/armadilhas/${a.id}`} className="hover:underline text-marca-escura">{a.codigo}</Link>
                        {a.status === "planejada" && <Badge variant="outline" className="ml-2">planejada</Badge>}
                        {a.status === "perdida" && <Badge variant="destructive" className="ml-2">perdida</Badge>}
                      </TableCell>
                      <TableCell>{a.fazenda}{a.talhao ? <span className="text-texto-suave"> · {a.talhao}</span> : null}</TableCell>
                      <TableCell className="text-texto-suave">{a.finalidade === "coleta_massal" ? "Coleta massal" : "Monitoramento"}</TableCell>
                      <TableCell>{a.status === "ativa" ? <BadgeSepto faixa={a.faixa_septo} dias={a.dias_septo} /> : <span className="text-texto-suave">—</span>}</TableCell>
                      <TableCell className="text-texto-suave">{dataHora(a.ultima_vistoria_em)}</TableCell>
                      <TableCell className="text-right font-mono">{numero(a.ultima_contagem)}</TableCell>
                      <TableCell><BadgeNivel nivel={a.nivel_infestacao} /></TableCell>
                      <TableCell className="font-mono text-xs text-texto-suave">{Number(a.lat).toFixed(5)}, {Number(a.lon).toFixed(5)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-4 py-3 text-sm">
                <p className="text-texto-suave">Mostrando <strong>{numero(de)}–{numero(ate)}</strong> de <strong>{numero(total)}</strong></p>
                <nav className="flex items-center gap-1" aria-label="Paginação">
                  <PaginaLink href={link({ pagina: String(paginaAtual - 1) })} desabilitado={paginaAtual <= 1}><ChevronLeft size={16} /> Anterior</PaginaLink>
                  {numerosDePagina(paginaAtual, totalPaginas).map((n, i) =>
                    n === null ? (
                      <span key={`e${i}`} className="px-1 text-texto-suave">…</span>
                    ) : (
                      <Link
                        key={n}
                        href={link({ pagina: String(n) })}
                        aria-current={n === paginaAtual ? "page" : undefined}
                        className={`min-w-8 rounded-md px-2 py-1.5 text-center text-xs font-medium ${n === paginaAtual ? "bg-marca text-white" : "text-texto hover:bg-fundo"}`}
                      >
                        {n}
                      </Link>
                    ),
                  )}
                  <PaginaLink href={link({ pagina: String(paginaAtual + 1) })} desabilitado={paginaAtual >= totalPaginas}>Próxima <ChevronRight size={16} /></PaginaLink>
                </nav>
              </div>
            </>
          ) : (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>Nenhuma armadilha encontrada</EmptyTitle>
                <EmptyDescription>
                  {contagem.total ? "Ajuste os filtros ou a busca." : "As armadilhas aparecem aqui assim que o pragueiro sincronizar o aplicativo — ou gere a malha em Fazendas e talhões."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaginaLink({ href, desabilitado, children }: { href: string; desabilitado: boolean; children: React.ReactNode }) {
  if (desabilitado) {
    return <span className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-texto-suave/50 cursor-not-allowed">{children}</span>;
  }
  return <Link href={href} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-texto hover:bg-fundo">{children}</Link>;
}

/** 1 … (atual-1) atual (atual+1) … última — nunca lista mil páginas. */
function numerosDePagina(atual: number, total: number): Array<number | null> {
  const s = new Set<number>([1, total, atual - 1, atual, atual + 1]);
  const ordenado = [...s].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: Array<number | null> = [];
  let anterior = 0;
  for (const n of ordenado) {
    if (anterior && n - anterior > 1) saida.push(null);
    saida.push(n);
    anterior = n;
  }
  return saida;
}
