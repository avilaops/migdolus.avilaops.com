"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BadgeSepto, BadgeNivel } from "./Badges";
import { dataHora, numero } from "@/lib/formatar";

// Estilo base: imagem de satélite (Esri World Imagery) — sem chave, atribuição obrigatória.
export const ESTILO_SATELITE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satelite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "satelite", type: "raster", source: "satelite" }],
};

type Fazenda = { id: string; nome: string };

interface Props {
  fazendas: Fazenda[];
}

interface PropsArmadilha {
  id: string; codigo: string; faixa_septo: string; nivel_infestacao: string | null; ultima_contagem: number | null;
  dias_septo: number | null; adultos_periodo: number; vistorias_periodo: number; talhao: string | null; fazenda: string; peso: number; lat: number; lon: number;
}

const COR_NIVEL: Record<string, string> = { baixo: "#2e9e52", medio: "#e0b400", alto: "#d32f2f" };

export function MapaClient({ fazendas }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const [fazenda, setFazenda] = useState<string>("");
  const hoje = new Date();
  const [de, setDe] = useState(new Date(hoje.getTime() - 30 * 864e5).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));
  const [selecionada, setSelecionada] = useState<PropsArmadilha | null>(null);
  const [total, setTotal] = useState<{ armadilhas: number; max: number } | null>(null);
  const [mostrarCalor, setMostrarCalor] = useState(true);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: ESTILO_SATELITE,
      center: [-48.5, -21.2], // região canavieira de SP como ponto de partida
      zoom: 6,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("talhoes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "talhoes-fill", type: "fill", source: "talhoes", paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 } });
      m.addLayer({ id: "talhoes-line", type: "line", source: "talhoes", paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.8 } });
      m.addLayer({
        id: "talhoes-rotulo", type: "symbol", source: "talhoes",
        layout: { "text-field": ["get", "nome"], "text-size": 12, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"] },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1 },
      });
      m.addSource("armadilhas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "calor", type: "heatmap", source: "armadilhas", maxzoom: 18,
        paint: {
          "heatmap-weight": ["get", "peso"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 12, 14, 30, 17, 60],
          "heatmap-opacity": 0.75,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(46,158,82,0)", 0.2, "rgba(46,158,82,0.6)", 0.5, "rgba(224,180,0,0.8)", 0.8, "rgba(211,47,47,0.9)", 1, "rgba(150,0,0,1)"],
        },
      });
      m.addLayer({
        id: "pontos", type: "circle", source: "armadilhas",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 7, 17, 10],
          "circle-color": ["match", ["get", "nivel_infestacao"], "alto", COR_NIVEL.alto, "medio", COR_NIVEL.medio, "baixo", COR_NIVEL.baixo, "#9e9e9e"],
          "circle-stroke-color": ["match", ["get", "faixa_septo"], "critico", "#ff1744", "aviso", "#ffd600", "#ffffff"],
          "circle-stroke-width": ["match", ["get", "faixa_septo"], "critico", 3, "aviso", 2.5, 1.2],
        },
      });
      m.on("click", "pontos", (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (f) setSelecionada(f.properties as unknown as PropsArmadilha);
      });
      m.on("mouseenter", "pontos", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "pontos", () => (m.getCanvas().style.cursor = ""));
      mapa.current = m;
      carregar();
    });
    return () => { m.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !m.getLayer("calor")) return;
    m.setLayoutProperty("calor", "visibility", mostrarCalor ? "visible" : "none");
  }, [mostrarCalor]);

  async function carregar() {
    const m = mapa.current;
    if (!m) return;
    setCarregando(true);
    const qs = new URLSearchParams({ de, ate });
    if (fazenda) qs.set("fazenda", fazenda);
    const res = await fetch(`/api/mapa/heat?${qs}`);
    setCarregando(false);
    if (!res.ok) return;
    const d = await res.json();
    (m.getSource("armadilhas") as maplibregl.GeoJSONSource).setData(d.armadilhas);
    (m.getSource("talhoes") as maplibregl.GeoJSONSource).setData(d.talhoes);
    setTotal({ armadilhas: d.armadilhas.features.length, max: d.max_adultos });
    const coords: [number, number][] = [
      ...d.armadilhas.features.map((f: { geometry: { coordinates: [number, number] } }) => f.geometry.coordinates),
      ...d.talhoes.features.flatMap((f: { geometry: { coordinates: number[][][][] } }) => f.geometry.coordinates.flat(2) as unknown as [number, number][]),
    ];
    if (coords.length) {
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      m.fitBounds(b, { padding: 60, maxZoom: 16, duration: 600 });
    }
  }

  return (
    <div className="flex-1 min-h-[70vh] grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="relative cartao overflow-hidden">
        <div ref={ref} className="absolute inset-0" />
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-superficie/95 backdrop-blur rounded-xl border border-borda p-2.5 shadow-lg text-xs">
          <select value={fazenda} onChange={(e) => setFazenda(e.target.value)} className="campo !w-auto !py-1">
            <option value="">Todas as fazendas</option>
            {fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="campo !w-auto !py-1" />
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="campo !w-auto !py-1" />
          <button onClick={carregar} className="botao !py-1" disabled={carregando}>{carregando ? "…" : "Aplicar"}</button>
          <label className="inline-flex items-center gap-1.5 px-2">
            <input type="checkbox" checked={mostrarCalor} onChange={(e) => setMostrarCalor(e.target.checked)} /> calor
          </label>
        </div>
        <div className="absolute bottom-6 right-3 bg-superficie/95 backdrop-blur rounded-xl border border-borda p-3 shadow-lg text-xs space-y-1.5">
          <p className="rotulo !text-[10px]">Legenda</p>
          <p><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: COR_NIVEL.baixo }} />Infestação baixa</p>
          <p><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: COR_NIVEL.medio }} />Média</p>
          <p><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: COR_NIVEL.alto }} />Alta</p>
          <p><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 border-2 border-[#ff1744] bg-white" />Septo vencido</p>
          <p><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 border-2 border-[#ffd600] bg-white" />Trocar em breve</p>
          {total && <p className="text-texto-suave pt-1">{total.armadilhas} armadilhas · máx. {numero(total.max)} adultos</p>}
        </div>
      </div>
      <aside className="cartao p-4 space-y-3 text-sm">
        {selecionada ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="rotulo">Armadilha</p>
                <p className="text-lg font-semibold">{selecionada.codigo}</p>
                <p className="text-texto-suave">{selecionada.fazenda}{selecionada.talhao ? ` · ${selecionada.talhao}` : ""}</p>
              </div>
              <button onClick={() => setSelecionada(null)} className="text-texto-suave hover:text-texto">✕</button>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="rotulo">Septo</dt><dd className="mt-1"><BadgeSepto faixa={selecionada.faixa_septo} dias={selecionada.dias_septo} /></dd></div>
              <div><dt className="rotulo">Infestação</dt><dd className="mt-1"><BadgeNivel nivel={selecionada.nivel_infestacao} /></dd></div>
              <div><dt className="rotulo">Última contagem</dt><dd className="text-xl font-semibold">{numero(selecionada.ultima_contagem)}</dd></div>
              <div><dt className="rotulo">No período</dt><dd className="text-xl font-semibold">{numero(selecionada.adultos_periodo)} <span className="text-xs font-normal text-texto-suave">em {selecionada.vistorias_periodo} vist.</span></dd></div>
            </dl>
            <p className="text-xs text-texto-suave font-mono">{Number(selecionada.lat).toFixed(6)}, {Number(selecionada.lon).toFixed(6)}</p>
            <a href={`/armadilhas?busca=${encodeURIComponent(selecionada.codigo)}`} className="botao-secundario w-full justify-center">Ver histórico</a>
          </>
        ) : (
          <div className="text-texto-suave space-y-2">
            <p className="font-medium text-texto">Clique em uma armadilha</p>
            <p>Para ver o status do septo, a última contagem e as capturas no período escolhido.</p>
            <p className="text-xs pt-2">Atualizado em {dataHora(new Date())}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
