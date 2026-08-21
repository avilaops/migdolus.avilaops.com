"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ESTILO_SATELITE } from "./MapaClient";

const COR_NIVEL: Record<string, string> = { baixo: "#2e9e52", medio: "#e0b400", alto: "#d32f2f" };

// Mapa estático para o laudo: sem controles, preserveDrawingBuffer para sair na impressão.
export function MapaLaudo({ fazenda, de, ate }: { fazenda: string; de: string; ate: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({ container: ref.current, style: ESTILO_SATELITE, center: [-48.5, -21.2], zoom: 6, interactive: false, attributionControl: { compact: true }, canvasContextAttributes: { preserveDrawingBuffer: true } });
    m.on("load", async () => {
      const res = await fetch(`/api/mapa/heat?${new URLSearchParams({ fazenda, de, ate })}`);
      if (!res.ok) return;
      const d = await res.json();
      m.addSource("talhoes", { type: "geojson", data: d.talhoes });
      m.addLayer({ id: "talhoes-line", type: "line", source: "talhoes", paint: { "line-color": "#fff", "line-width": 1.5 } });
      m.addLayer({ id: "talhoes-rotulo", type: "symbol", source: "talhoes", layout: { "text-field": ["get", "nome"], "text-size": 11, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1 } });
      m.addSource("armadilhas", { type: "geojson", data: d.armadilhas });
      m.addLayer({ id: "calor", type: "heatmap", source: "armadilhas", paint: { "heatmap-weight": ["get", "peso"], "heatmap-radius": 30, "heatmap-opacity": 0.7, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(46,158,82,0)", 0.3, "rgba(46,158,82,0.6)", 0.6, "rgba(224,180,0,0.8)", 1, "rgba(211,47,47,0.95)"] } });
      m.addLayer({ id: "pontos", type: "circle", source: "armadilhas", paint: { "circle-radius": 5, "circle-color": ["match", ["get", "nivel_infestacao"], "alto", COR_NIVEL.alto, "medio", COR_NIVEL.medio, "baixo", COR_NIVEL.baixo, "#9e9e9e"], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      const coords: [number, number][] = [
        ...d.armadilhas.features.map((f: { geometry: { coordinates: [number, number] } }) => f.geometry.coordinates),
        ...d.talhoes.features.flatMap((f: { geometry: { coordinates: number[][][][] } }) => f.geometry.coordinates.flat(2) as unknown as [number, number][]),
      ];
      if (coords.length) {
        const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
        m.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
      }
    });
    return () => m.remove();
  }, [fazenda, de, ate]);
  return <div ref={ref} className="h-[420px] w-full rounded-lg overflow-hidden border border-borda" />;
}
