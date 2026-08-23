"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, TrendingDown, Sprout, Bug } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar, LabelList } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { numero } from "@/lib/formatar";

export interface Safra { id: string; rotulo: string; inicio: string; fim: string }
export interface PontoCurva { safra: string; mes: string; ordem: number; machos: number; vistorias: number }
export interface ResumoSafra {
  id: string; rotulo: string; machos_media: number | null; vistorias: number; larvas_media: number | null; trincheiras: number;
  tch_tratado: number | null; tch_testemunha: number | null; talhoes_tch: number;
}
interface LinhaProducao {
  talhao_id: string; talhao: string; fazenda: string; area_ha: string | null; ano_programa: number | null;
  producao_id: string | null; tch: string | null; testemunha: boolean | null; fonte: string | null; larvas_media: string | null; trincheiras: number;
}

// Paleta categórica validada (scripts/validate_palette.js do skill dataviz): CVD ΔE ≥ 19, contraste ≥ 3:1
const CORES_SAFRA = ["#1f7a3e", "#1e6fb8", "#c47207", "#7b4bb7", "#5b6b62", "#0f1f17"];

export function SafrasClient({ safras, pontos, resumos, podeEditar }: { safras: Safra[]; pontos: PontoCurva[]; resumos: ResumoSafra[]; podeEditar: boolean }) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [safraSel, setSafraSel] = useState<string>(safras.at(-1)?.id ?? "");
  const [linhas, setLinhas] = useState<LinhaProducao[]>([]);
  const [trinc, setTrinc] = useState<null | LinhaProducao>(null);

  // dados do gráfico de curva: uma linha por safra
  const curva = useMemo(() => {
    const meses = [...new Set(pontos.sort((a, b) => a.ordem - b.ordem).map((p) => p.mes))];
    return meses.map((mes) => {
      const row: Record<string, string | number> = { mes };
      for (const p of pontos.filter((x) => x.mes === mes)) row[p.safra] = p.machos;
      return row;
    });
  }, [pontos]);
  const rotulos = useMemo(() => [...new Set(pontos.map((p) => p.safra))], [pontos]);

  const barras = resumos.map((r) => ({ safra: r.rotulo, machos: r.machos_media ?? 0, larvas: r.larvas_media ?? 0, tch: r.tch_tratado ?? 0, testemunha: r.tch_testemunha ?? 0 }));
  const primeira = resumos.find((r) => r.machos_media !== null);
  const ultima = [...resumos].reverse().find((r) => r.machos_media !== null);
  const queda = primeira && ultima && primeira.id !== ultima.id && primeira.machos_media ? Math.round((1 - (ultima.machos_media ?? 0) / primeira.machos_media) * 100) : null;

  useEffect(() => {
    if (!safraSel) return;
    fetch(`/api/producao?safra=${safraSel}`).then((r) => r.json()).then(setLinhas).catch(() => setLinhas([]));
  }, [safraSel]);

  async function criarSafra(fd: FormData) {
    setOcupado(true);
    const res = await fetch("/api/safras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotulo: fd.get("rotulo"), inicio: fd.get("inicio"), fim: fd.get("fim") }) });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro"); return; }
    toast.success("Safra criada");
    setNova(false);
    router.refresh();
  }

  async function salvarTch(l: LinhaProducao, tch: string, testemunha: boolean) {
    const valor = tch.trim() === "" ? null : Number(tch.replace(",", "."));
    if (valor !== null && Number.isNaN(valor)) return;
    const res = await fetch("/api/producao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "tch", talhao_id: l.talhao_id, safra_id: safraSel, tch: valor, testemunha }) });
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao salvar TCH"); return; }
    setLinhas((ls) => ls.map((x) => (x.talhao_id === l.talhao_id ? { ...x, tch: valor === null ? null : String(valor), testemunha } : x)));
    router.refresh();
  }

  async function salvarTrincheira(fd: FormData) {
    if (!trinc) return;
    setOcupado(true);
    const res = await fetch("/api/producao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "trincheira", talhao_id: trinc.talhao_id, safra_id: safraSel || null, realizada_em: fd.get("data"), larvas: Number(fd.get("larvas")), observacoes: fd.get("obs") || undefined }) });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro"); return; }
    toast.success("Trincheira registrada");
    setTrinc(null);
    fetch(`/api/producao?safra=${safraSel}`).then((r) => r.json()).then(setLinhas);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safras e resultado do controle</h1>
          <p className="text-sm text-texto-suave mt-1">Curva de revoada por safra, queda de capturas, larvas no solo e TCH — os mesmos indicadores do estudo da bp bioenergy.</p>
        </div>
        {podeEditar && <Button onClick={() => setNova(true)}><Plus /> Nova safra</Button>}
      </header>

      {!safras.length ? (
        <Card><CardContent className="py-12"><Empty><EmptyHeader><EmptyTitle>Nenhuma safra cadastrada</EmptyTitle><EmptyDescription>Crie a safra atual (ex.: 2026/27, de 01/11 a 31/05) para começar a comparar.</EmptyDescription></EmptyHeader></Empty></CardContent></Card>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi icone={<TrendingDown size={16} />} rotulo="Queda de capturas" valor={queda !== null ? `${queda > 0 ? "−" : "+"}${Math.abs(queda)} %` : "—"} detalhe={primeira && ultima && primeira.id !== ultima.id ? `${primeira.rotulo} → ${ultima.rotulo}` : "precisa de 2 safras com vistorias"} tom={queda !== null && queda > 0 ? "ok" : "neutro"} />
            <Kpi icone={<Bug size={16} />} rotulo="Machos/armadilha (última safra)" valor={numero(ultima?.machos_media ?? null, 1)} detalhe={ultima ? `${numero(ultima.vistorias)} vistorias em ${ultima.rotulo}` : ""} />
            <Kpi icone={<Sprout size={16} />} rotulo="Larvas/trincheira" valor={numero(ultima?.larvas_media ?? null, 1)} detalhe={ultima ? `${numero(ultima.trincheiras)} trincheiras` : ""} />
            <Kpi rotulo="TCH tratado vs testemunha" valor={ultima?.tch_tratado ? `${numero(ultima.tch_tratado, 1)} / ${numero(ultima.tch_testemunha ?? null, 1)}` : "—"} detalhe={ultima?.tch_tratado && ultima.tch_testemunha ? `+${Math.round(((ultima.tch_tratado / ultima.tch_testemunha) - 1) * 100)} % de produtividade` : "lance o TCH por talhão abaixo"} tom="ok" />
          </section>

          <section className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Curva de revoada por safra</CardTitle><CardDescription>Média de machos por armadilha em cada mês — compare o pico (mar/abr) entre safras.</CardDescription></CardHeader>
              <CardContent>
                {curva.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curva} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke="var(--borda)" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--borda)", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {rotulos.map((r, i) => <Line key={r} type="monotone" dataKey={r} stroke={CORES_SAFRA[i % CORES_SAFRA.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-sm text-texto-suave py-10 text-center">Sem vistorias dentro das safras cadastradas.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Machos/armadilha por safra</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barras} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="var(--borda)" vertical={false} />
                      <XAxis dataKey="safra" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--borda)", fontSize: 12 }} />
                      <Bar dataKey="machos" name="machos/armadilha" radius={[6, 6, 0, 0]} maxBarSize={48} fill="var(--marca)">
                        <LabelList dataKey="machos" position="top" style={{ fontSize: 11, fill: "var(--texto)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle>Produtividade e larvas por talhão</CardTitle><CardDescription>Lance o TCH (t/ha) de cada talhão na safra e marque os talhões testemunha (sem controle) para calcular o ganho.</CardDescription></div>
                <Select value={safraSel} onValueChange={(v) => v && setSafraSel(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{safras.map((s) => <SelectItem key={s.id} value={s.id}>{s.rotulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="tabela">
                <TabsList className="mx-6"><TabsTrigger value="tabela">Talhões</TabsTrigger><TabsTrigger value="grafico">TCH por safra</TabsTrigger></TabsList>
                <TabsContent value="tabela">
                  {linhas.length ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Fazenda / talhão</TableHead><TableHead>Área</TableHead><TableHead>Ano do programa</TableHead><TableHead>Larvas/trincheira</TableHead><TableHead className="w-32">TCH</TableHead><TableHead>Testemunha</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {linhas.map((l) => (
                          <TableRow key={l.talhao_id}>
                            <TableCell className="font-medium">{l.fazenda} <span className="text-texto-suave">· {l.talhao}</span></TableCell>
                            <TableCell className="text-texto-suave">{numero(l.area_ha, 1)} ha</TableCell>
                            <TableCell className="text-texto-suave">{l.ano_programa ? `${l.ano_programa}º` : "—"}</TableCell>
                            <TableCell>{l.trincheiras ? `${numero(l.larvas_media, 1)} (${l.trincheiras})` : <span className="text-texto-suave">—</span>}</TableCell>
                            <TableCell>
                              <Input defaultValue={l.tch ?? ""} placeholder="t/ha" inputMode="decimal" disabled={!podeEditar} className="h-8"
                                onBlur={(e) => { if (podeEditar && e.target.value !== (l.tch ?? "")) salvarTch(l, e.target.value, !!l.testemunha); }} />
                            </TableCell>
                            <TableCell><Switch checked={!!l.testemunha} disabled={!podeEditar} onCheckedChange={(v) => salvarTch(l, l.tch ?? "", v)} /></TableCell>
                            <TableCell className="text-right">{podeEditar && <Button size="sm" variant="ghost" onClick={() => setTrinc(l)}>+ trincheira</Button>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : <p className="text-sm text-texto-suave p-6">Cadastre talhões em Fazendas e talhões.</p>}
                </TabsContent>
                <TabsContent value="grafico" className="p-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barras} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke="var(--borda)" vertical={false} />
                        <XAxis dataKey="safra" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--borda)", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="testemunha" name="TCH testemunha" fill="#c62828" radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList dataKey="testemunha" position="top" style={{ fontSize: 11 }} /></Bar>
                        <Bar dataKey="tch" name="TCH com controle" fill="var(--marca)" radius={[6, 6, 0, 0]} maxBarSize={40}><LabelList dataKey="tch" position="top" style={{ fontSize: 11 }} /></Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={nova} onOpenChange={setNova}>
        <DialogContent>
          <form action={criarSafra}>
            <DialogHeader><DialogTitle>Nova safra</DialogTitle><DialogDescription>Período de monitoramento. A revoada do Migdolus vai de novembro a maio.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5"><Label htmlFor="rotulo">Rótulo</Label><Input id="rotulo" name="rotulo" placeholder="2026/27" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label htmlFor="inicio">Início</Label><Input id="inicio" name="inicio" type="date" required defaultValue={`${new Date().getFullYear()}-11-01`} /></div>
                <div className="grid gap-1.5"><Label htmlFor="fim">Fim</Label><Input id="fim" name="fim" type="date" required defaultValue={`${new Date().getFullYear() + 1}-05-31`} /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!trinc} onOpenChange={(o) => !o && setTrinc(null)}>
        <DialogContent>
          <form action={salvarTrincheira}>
            <DialogHeader><DialogTitle>Registrar trincheira</DialogTitle><DialogDescription>{trinc?.fazenda} · {trinc?.talhao} — larvas de Migdolus encontradas na trincheira.</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-4">
              <div className="grid gap-1.5"><Label htmlFor="tdata">Data</Label><Input id="tdata" name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="larvas">Larvas</Label><Input id="larvas" name="larvas" type="number" min={0} required /></div>
              <div className="grid gap-1.5 col-span-2"><Label htmlFor="tobs">Observações</Label><Input id="tobs" name="obs" /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, icone, tom = "neutro" }: { rotulo: string; valor: string; detalhe?: string; icone?: React.ReactNode; tom?: "neutro" | "ok" }) {
  return (
    <div className="cartao p-5">
      <p className="rotulo flex items-center gap-1.5">{icone}{rotulo}</p>
      <p className={`text-3xl font-semibold mt-2 ${tom === "ok" ? "text-marca" : ""}`}>{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave mt-1">{detalhe}</p>}
    </div>
  );
}
