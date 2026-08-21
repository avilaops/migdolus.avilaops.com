"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";
import { Plus, Upload, PenLine, Grid3X3, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ESTILO_SATELITE } from "./MapaClient";
import { numero } from "@/lib/formatar";

export interface FazendaResumo {
  id: string; nome: string; codigo: string | null; municipio: string | null; uf: string | null;
  talhoes: number; armadilhas_ativas: number; armadilhas_planejadas: number;
}
export interface TalhaoResumo {
  id: string; fazenda_id: string; nome: string; variedade: string | null; corte: number | null; ano_programa: number | null;
  area_ha: number | null; origem: string; geom: GeoJSON.MultiPolygon | GeoJSON.Polygon | null; armadilhas_ativas: number; armadilhas_planejadas: number;
}

interface Props {
  fazendas: FazendaResumo[];
  talhoes: TalhaoResumo[];
  espacamentoPadrao: number;
  podeEditar: boolean;
}

type Modo = "navegar" | "desenhar";

export function TalhoesClient({ fazendas, talhoes, espacamentoPadrao, podeEditar }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const [fazendaId, setFazendaId] = useState<string>(fazendas[0]?.id ?? "");
  const [modo, setModo] = useState<Modo>("navegar");
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const verticesRef = useRef<[number, number][]>([]);
  const [novaFazenda, setNovaFazenda] = useState(false);
  const [novoTalhao, setNovoTalhao] = useState<null | { geom: GeoJSON.Polygon | GeoJSON.MultiPolygon; origem: string }>(null);
  const [malha, setMalha] = useState<null | TalhaoResumo>(null);
  const [ocupado, setOcupado] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const talhoesDaFazenda = useMemo(() => talhoes.filter((t) => t.fazenda_id === fazendaId), [talhoes, fazendaId]);
  const fazenda = fazendas.find((f) => f.id === fazendaId);

  // mapa
  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = new maplibregl.Map({ container: ref.current, style: ESTILO_SATELITE, center: [-48.5, -21.2], zoom: 6, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("talhoes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "talhoes-fill", type: "fill", source: "talhoes", paint: { "fill-color": "#4caf50", "fill-opacity": 0.18 } });
      m.addLayer({ id: "talhoes-line", type: "line", source: "talhoes", paint: { "line-color": "#b9f6ca", "line-width": 2 } });
      m.addLayer({ id: "talhoes-rotulo", type: "symbol", source: "talhoes", layout: { "text-field": ["get", "nome"], "text-size": 12, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1 } });
      m.addSource("desenho", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "desenho-fill", type: "fill", source: "desenho", paint: { "fill-color": "#ffeb3b", "fill-opacity": 0.25 } });
      m.addLayer({ id: "desenho-line", type: "line", source: "desenho", paint: { "line-color": "#ffeb3b", "line-width": 2, "line-dasharray": [2, 1] } });
      m.addLayer({ id: "desenho-pts", type: "circle", source: "desenho", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#ffeb3b", "circle-stroke-width": 2 } });
      mapa.current = m;
      atualizarTalhoes();
    });
    m.on("click", (e: maplibregl.MapMouseEvent) => {
      if (modoRef.current !== "desenhar") return;
      const next = [...verticesRef.current, [e.lngLat.lng, e.lngLat.lat] as [number, number]];
      verticesRef.current = next;
      setVertices(next);
      desenhar(next);
    });
    return () => { m.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modoRef = useRef<Modo>("navegar");
  useEffect(() => {
    modoRef.current = modo;
    const m = mapa.current;
    if (m) m.getCanvas().style.cursor = modo === "desenhar" ? "crosshair" : "";
  }, [modo]);

  useEffect(() => { atualizarTalhoes(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fazendaId, talhoes]);

  function atualizarTalhoes() {
    const m = mapa.current;
    if (!m || !m.getSource("talhoes")) return;
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: talhoesDaFazenda.filter((t) => t.geom).map((t) => ({ type: "Feature", geometry: t.geom!, properties: { id: t.id, nome: t.nome } })),
    };
    (m.getSource("talhoes") as maplibregl.GeoJSONSource).setData(fc);
    const coords = fc.features.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates.flat() : (f.geometry as GeoJSON.MultiPolygon).coordinates.flat(2))) as [number, number][];
    if (coords.length) {
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      m.fitBounds(b, { padding: 50, maxZoom: 16, duration: 500 });
    }
  }

  function desenhar(pts: [number, number][]) {
    const m = mapa.current;
    if (!m || !m.getSource("desenho")) return;
    const features: GeoJSON.Feature[] = pts.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} }));
    if (pts.length >= 3) features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] }, properties: {} });
    else if (pts.length === 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} });
    (m.getSource("desenho") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
  }

  function limparDesenho() {
    verticesRef.current = [];
    setVertices([]);
    desenhar([]);
    setModo("navegar");
  }

  function concluirDesenho() {
    if (vertices.length < 3) { toast.error("Marque pelo menos 3 pontos"); return; }
    setNovoTalhao({ geom: { type: "Polygon", coordinates: [[...vertices, vertices[0]]] }, origem: "desenho" });
  }

  async function importarArquivo(file: File) {
    const texto = await file.text();
    let geom: GeoJSON.Polygon | GeoJSON.MultiPolygon | null = null;
    let origem = "geojson";
    try {
      if (file.name.toLowerCase().endsWith(".kml")) {
        origem = "kml";
        geom = kmlParaPoligono(texto);
      } else {
        const gj = JSON.parse(texto);
        geom = extrairPoligono(gj);
      }
    } catch {
      geom = null;
    }
    if (!geom) { toast.error("Não encontrei um polígono válido no arquivo (GeoJSON ou KML)."); return; }
    setNovoTalhao({ geom, origem });
    const m = mapa.current;
    if (m) {
      const coords = (geom.type === "Polygon" ? geom.coordinates.flat() : geom.coordinates.flat(2)) as [number, number][];
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      m.fitBounds(b, { padding: 50, maxZoom: 16 });
    }
  }

  async function salvarFazenda(fd: FormData) {
    setOcupado(true);
    const res = await fetch("/api/fazendas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: fd.get("nome"), codigo: fd.get("codigo") || undefined, municipio: fd.get("municipio") || undefined, uf: fd.get("uf") || undefined }) });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao salvar"); return; }
    const f = await res.json();
    toast.success(`Fazenda ${f.nome} criada`);
    setNovaFazenda(false);
    setFazendaId(f.id);
    router.refresh();
  }

  async function salvarTalhao(fd: FormData) {
    if (!novoTalhao || !fazendaId) return;
    setOcupado(true);
    const res = await fetch("/api/talhoes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fazenda_id: fazendaId, nome: fd.get("nome"), variedade: fd.get("variedade") || undefined,
        corte: fd.get("corte") ? Number(fd.get("corte")) : undefined, ano_programa: fd.get("ano_programa") ? Number(fd.get("ano_programa")) : undefined,
        origem: novoTalhao.origem, geom: novoTalhao.geom,
      }),
    });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao salvar talhão"); return; }
    const t = await res.json();
    toast.success(`Talhão ${t.nome} salvo (${numero(t.area_ha, 1)} ha)`);
    setNovoTalhao(null);
    limparDesenho();
    router.refresh();
  }

  async function gerarMalha(fd: FormData) {
    if (!malha) return;
    setOcupado(true);
    const res = await fetch(`/api/talhoes/${malha.id}/malha`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacamento_m: Number(fd.get("espacamento")), prefixo: fd.get("prefixo") || undefined, finalidade: fd.get("finalidade") }),
    });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao gerar malha"); return; }
    const r = await res.json();
    toast.success(`${r.armadilhas_planejadas} armadilhas planejadas a ${r.espacamento_m} m — já disponíveis no app de campo`);
    setMalha(null);
    router.refresh();
  }

  async function excluirTalhao(t: TalhaoResumo) {
    if (!confirm(`Excluir o talhão ${t.nome}? Armadilhas planejadas nele serão removidas.`)) return;
    const res = await fetch(`/api/talhoes?id=${t.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).erro || "Não foi possível excluir"); return; }
    toast.success("Talhão excluído");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fazendas e talhões</h1>
          <p className="text-sm text-texto-suave mt-1">Desenhe ou importe os talhões e gere a malha de armadilhas. Sem base cartográfica? Desenhe direto sobre o satélite.</p>
        </div>
        {podeEditar && (
          <Button onClick={() => setNovaFazenda(true)}><Plus /> Nova fazenda</Button>
        )}
      </header>

      {!fazendas.length ? (
        <Card><CardContent className="py-12 text-center text-texto-suave">Cadastre a primeira fazenda para começar.</CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fazenda</Label>
              <Select value={fazendaId} onValueChange={(v) => v && setFazendaId(v)}>
                <SelectTrigger className="w-full bg-superficie"><SelectValue placeholder="Escolha a fazenda" /></SelectTrigger>
                <SelectContent>
                  {fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {fazenda && (
                <p className="text-xs text-texto-suave">
                  {fazenda.talhoes} talhões · {fazenda.armadilhas_ativas} armadilhas ativas · {fazenda.armadilhas_planejadas} planejadas
                  {fazenda.municipio ? ` · ${fazenda.municipio}${fazenda.uf ? "/" + fazenda.uf : ""}` : ""}
                </p>
              )}
            </div>

            {podeEditar && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Novo talhão</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {modo === "desenhar" ? (
                    <>
                      <p className="text-xs text-texto-suave">Clique no mapa para marcar os vértices ({vertices.length} marcados).</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={concluirDesenho} disabled={vertices.length < 3}><Check /> Concluir</Button>
                        <Button size="sm" variant="outline" onClick={limparDesenho}><X /> Cancelar</Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="justify-start" onClick={() => setModo("desenhar")}><PenLine /> Desenhar no mapa</Button>
                      <Button variant="outline" className="justify-start" onClick={() => arquivoRef.current?.click()}><Upload /> Importar GeoJSON / KML</Button>
                      <input ref={arquivoRef} type="file" accept=".geojson,.json,.kml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importarArquivo(f); e.target.value = ""; }} />
                      <p className="text-[11px] text-texto-suave">Shapefile: converta para GeoJSON (QGIS ou mapshaper.org) antes de importar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Talhões ({talhoesDaFazenda.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {talhoesDaFazenda.length ? (
                  <ul className="divide-y divide-borda/70 max-h-[50vh] overflow-auto">
                    {talhoesDaFazenda.map((t) => (
                      <li key={t.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.nome} <span className="text-texto-suave font-normal">· {numero(t.area_ha, 1)} ha</span></p>
                          <p className="text-xs text-texto-suave">
                            {t.armadilhas_ativas} ativas · {t.armadilhas_planejadas} planejadas
                            {t.ano_programa ? ` · ${t.ano_programa}º ano` : ""}
                            {t.variedade ? ` · ${t.variedade}` : ""}
                          </p>
                        </div>
                        {podeEditar && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon-sm" variant="ghost" title="Gerar malha de armadilhas" onClick={() => setMalha(t)}><Grid3X3 /></Button>
                            <Button size="icon-sm" variant="ghost" title="Excluir" onClick={() => excluirTalhao(t)}><Trash2 /></Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-sm text-texto-suave">Nenhum talhão nesta fazenda ainda.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="relative cartao overflow-hidden min-h-[70vh]">
            <div ref={ref} className="absolute inset-0" />
            {modo === "desenhar" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-superficie/95 rounded-lg px-3 py-1.5 text-xs shadow">
                Modo desenho: clique para adicionar vértices · {vertices.length} pontos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nova fazenda */}
      <Dialog open={novaFazenda} onOpenChange={setNovaFazenda}>
        <DialogContent>
          <form action={salvarFazenda}>
            <DialogHeader><DialogTitle>Nova fazenda</DialogTitle><DialogDescription>Unidade produtiva que agrupa talhões e armadilhas.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5"><Label htmlFor="nome">Nome</Label><Input id="nome" name="nome" required placeholder="Fazenda Santa Rita" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5 col-span-1"><Label htmlFor="codigo">Código</Label><Input id="codigo" name="codigo" placeholder="FSR" /></div>
                <div className="grid gap-1.5"><Label htmlFor="municipio">Município</Label><Input id="municipio" name="municipio" /></div>
                <div className="grid gap-1.5"><Label htmlFor="uf">UF</Label><Input id="uf" name="uf" maxLength={2} placeholder="SP" /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Novo talhão */}
      <Dialog open={!!novoTalhao} onOpenChange={(o) => !o && setNovoTalhao(null)}>
        <DialogContent>
          <form action={salvarTalhao}>
            <DialogHeader><DialogTitle>Salvar talhão</DialogTitle><DialogDescription>Polígono {novoTalhao?.origem === "desenho" ? "desenhado no mapa" : `importado (${novoTalhao?.origem})`} em {fazenda?.nome}.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5"><Label htmlFor="tnome">Nome do talhão</Label><Input id="tnome" name="nome" required placeholder="T-12" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5"><Label htmlFor="variedade">Variedade</Label><Input id="variedade" name="variedade" placeholder="RB867515" /></div>
                <div className="grid gap-1.5"><Label htmlFor="corte">Corte</Label><Input id="corte" name="corte" type="number" min={1} max={15} /></div>
                <div className="grid gap-1.5"><Label htmlFor="ano">Ano do programa</Label><Input id="ano" name="ano_programa" type="number" min={1} max={3} placeholder="1" /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Salvar talhão</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Malha */}
      <Dialog open={!!malha} onOpenChange={(o) => !o && setMalha(null)}>
        <DialogContent>
          <form action={gerarMalha}>
            <DialogHeader>
              <DialogTitle>Gerar malha de armadilhas</DialogTitle>
              <DialogDescription>
                Grade regular dentro de <strong>{malha?.nome}</strong> ({numero(malha?.area_ha, 1)} ha). As armadilhas ficam <Badge variant="outline">planejadas</Badge> até o pragueiro confirmar cada ponto no campo.
                Armadilhas planejadas anteriores deste talhão são substituídas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label htmlFor="esp">Espaçamento (m)</Label><Input id="esp" name="espacamento" type="number" min={5} max={500} defaultValue={espacamentoPadrao} required /></div>
                <div className="grid gap-1.5"><Label htmlFor="prefixo">Prefixo do código</Label><Input id="prefixo" name="prefixo" defaultValue={malha?.nome.replace(/\s+/g, "").slice(0, 8).toUpperCase()} /></div>
              </div>
              <div className="grid gap-1.5">
                <Label>Finalidade</Label>
                <Select name="finalidade" defaultValue="coleta_massal">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coleta_massal">Coleta massal (30 m — mais eficiente por área)</SelectItem>
                    <SelectItem value="monitoramento">Monitoramento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-texto-suave">Estimativa: ~{malha?.area_ha ? numero(Math.round((malha.area_ha * 10000) / (espacamentoPadrao * espacamentoPadrao))) : "—"} pontos a {espacamentoPadrao} m.</p>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}><Grid3X3 /> Gerar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function extrairPoligono(gj: unknown): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const g = gj as { type?: string; features?: Array<{ geometry: GeoJSON.Geometry }>; geometry?: GeoJSON.Geometry; coordinates?: unknown };
  if (!g || typeof g !== "object") return null;
  if (g.type === "FeatureCollection" && g.features?.length) {
    const polys = g.features.map((f) => f.geometry).filter((x) => x && (x.type === "Polygon" || x.type === "MultiPolygon"));
    if (!polys.length) return null;
    if (polys.length === 1) return polys[0] as GeoJSON.Polygon;
    return { type: "MultiPolygon", coordinates: polys.flatMap((p) => (p.type === "Polygon" ? [p.coordinates] : (p as GeoJSON.MultiPolygon).coordinates)) };
  }
  if (g.type === "Feature" && g.geometry) return extrairPoligono(g.geometry);
  if (g.type === "Polygon" || g.type === "MultiPolygon") return g as GeoJSON.Polygon;
  return null;
}

function kmlParaPoligono(kml: string): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const doc = new DOMParser().parseFromString(kml, "application/xml");
  const polys = Array.from(doc.getElementsByTagName("Polygon"));
  const rings: number[][][][] = [];
  for (const p of polys) {
    const outer = p.getElementsByTagName("outerBoundaryIs")[0]?.getElementsByTagName("coordinates")[0]?.textContent;
    if (!outer) continue;
    const coords = outer.trim().split(/\s+/).map((t) => t.split(",").slice(0, 2).map(Number) as [number, number]).filter((c) => c.length === 2 && !c.some(Number.isNaN));
    if (coords.length >= 3) rings.push([coords]);
  }
  if (!rings.length) return null;
  return rings.length === 1 ? { type: "Polygon", coordinates: rings[0] } : { type: "MultiPolygon", coordinates: rings };
}
