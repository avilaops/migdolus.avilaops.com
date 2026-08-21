import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Camera, GeoJSONSource, Layer, Map as MapaLibre, OfflineManager, UserLocation, type CameraRef, type PressEventWithFeatures } from "@maplibre/maplibre-react-native";
import type { NativeSyntheticEvent } from "react-native";
import { lerConfig, listarArmadilhas, listarFazendas, listarTalhoes, parametros, type Armadilha, type Fazenda, type Parametros } from "../../src/db";
import { COR_FAIXA, COR_NIVEL, faixaSepto, nivelInfestacao } from "../../src/ui";
import { CORES, ESTILO_MAPA_URL } from "../../src/config";

export default function Mapa() {
  const router = useRouter();
  const cam = useRef<CameraRef>(null);
  const [armadilhas, setArmadilhas] = useState<Armadilha[]>([]);
  const [talhoes, setTalhoes] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [p, setP] = useState<Parametros | null>(null);
  const [selecionada, setSelecionada] = useState<Armadilha | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [pacotes, setPacotes] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [a, t, f, par] = await Promise.all([listarArmadilhas(), listarTalhoes(), listarFazendas(), parametros()]);
      setArmadilhas(a); setFazendas(f); setP(par);
      setTalhoes({ type: "FeatureCollection", features: t.filter((x) => x.geom).map((x) => ({ type: "Feature", geometry: JSON.parse(x.geom!), properties: { id: x.id, nome: x.nome } })) });
      try { setPacotes((await OfflineManager.getPacks()).map((pk) => pk.id)); } catch { /* módulo offline indisponível no Expo Go */ }
      const last = await lerConfig("mapa_centro");
      if (a.length && cam.current) {
        const lons = a.map((x) => x.lon), lats = a.map((x) => x.lat);
        cam.current.fitBounds([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)], { padding: { top: 60, bottom: 120, left: 40, right: 40 }, duration: 600 });
      } else if (last) {
        const [lon, lat] = JSON.parse(last) as [number, number];
        cam.current?.jumpTo({ center: [lon, lat], zoom: 14 });
      }
    })();
  }, []));

  const pontos = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: p ? armadilhas.map((a) => {
      const { faixa } = faixaSepto(a.status === "ativa" ? a.septo_inicio : null, p);
      const nivel = nivelInfestacao(a.ultima_contagem, p);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
        properties: { id: a.id, codigo: a.codigo, cor: a.status === "planejada" ? "#90caf9" : nivel ? COR_NIVEL[nivel] : "#9e9e9e", borda: a.status === "planejada" ? "#1565c0" : COR_FAIXA[faixa], planejada: a.status === "planejada" },
      };
    }) : [],
  }), [armadilhas, p]);

  function aoTocar(e: NativeSyntheticEvent<PressEventWithFeatures>) {
    const f = e.nativeEvent.features?.[0];
    const id = f?.properties?.id as string | undefined;
    if (id) setSelecionada(armadilhas.find((a) => a.id === id) ?? null);
  }

  async function baixarOffline() {
    if (!armadilhas.length && !talhoes.features.length) { Alert.alert("Mapa offline", "Sincronize primeiro para ter armadilhas ou talhões e definir a área."); return; }
    const coords: [number, number][] = [
      ...armadilhas.map((a) => [a.lon, a.lat] as [number, number]),
      ...talhoes.features.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates.flat() : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat(2) : []) as [number, number][]),
    ];
    const lons = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
    const margem = 0.01; // ~1 km
    const bounds: [number, number, number, number] = [Math.min(...lons) - margem, Math.min(...lats) - margem, Math.max(...lons) + margem, Math.max(...lats) + margem];
    const nome = `fazenda-${fazendas[0]?.id.slice(0, 8) ?? "area"}`;
    try {
      setBaixando("0%");
      try { await OfflineManager.deletePack(nome); } catch { /* não existia */ }
      await OfflineManager.createPack(
        { mapStyle: ESTILO_MAPA_URL, bounds, minZoom: 12, maxZoom: 17, metadata: { nome } },
        (_pack, status) => {
          setBaixando(`${Math.round(status.percentage)}%`);
          if (status.state === "complete") { setBaixando(null); setPacotes((x) => [...new Set([...x, nome])]); }
        },
        (_pack, erro) => { setBaixando(null); Alert.alert("Falha no download", erro.message); },
      );
    } catch (e) {
      setBaixando(null);
      Alert.alert("Mapa offline", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <MapaLibre style={{ flex: 1 }} mapStyle={ESTILO_MAPA_URL} attribution attributionPosition={{ bottom: 8, left: 8 }} logo={false}>
        <Camera ref={cam} initialViewState={{ center: [-48.5, -21.2], zoom: 6 }} />
        <UserLocation heading />
        <GeoJSONSource id="talhoes" data={talhoes}>
          <Layer id="talhoes-fill" type="fill" style={{ fillColor: "#ffffff", fillOpacity: 0.08 }} />
          <Layer id="talhoes-line" type="line" style={{ lineColor: "#ffffff", lineWidth: 1.5 }} />
        </GeoJSONSource>
        <GeoJSONSource id="armadilhas" data={pontos} onPress={aoTocar} hitbox={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Layer id="armadilhas-circ" type="circle" style={{ circleRadius: 8, circleColor: ["get", "cor"], circleStrokeColor: ["get", "borda"], circleStrokeWidth: 2.5 }} />
          <Layer id="armadilhas-txt" type="symbol" minzoom={14} style={{ textField: ["get", "codigo"], textSize: 11, textOffset: [0, 1.4], textColor: "#fff", textHaloColor: "#000", textHaloWidth: 1 }} />
        </GeoJSONSource>
      </MapaLibre>

      <View style={st.acoes}>
        <Pressable onPress={baixarOffline} disabled={!!baixando} style={st.acao}>
          <Text style={st.acaoTxt}>{baixando ? `Baixando ${baixando}` : pacotes.length ? "Atualizar mapa offline" : "Baixar mapa offline"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/armadilha/nova")} style={[st.acao, { backgroundColor: CORES.marca }]}>
          <Text style={[st.acaoTxt, { color: "#fff" }]}>+ Instalar aqui</Text>
        </Pressable>
      </View>

      {selecionada && (
        <Pressable onPress={() => router.push({ pathname: "/armadilha/[id]", params: { id: selecionada.id } })} style={st.painel}>
          <View style={{ flex: 1 }}>
            <Text style={st.painelTitulo}>{selecionada.codigo}{selecionada.status === "planejada" ? "  · a instalar" : ""}</Text>
            <Text style={st.painelSub}>
              {selecionada.ultima_contagem !== null ? `${selecionada.ultima_contagem} adultos na última vistoria` : "sem vistoria"}
              {p && selecionada.status === "ativa" ? `  ·  septo ${faixaSepto(selecionada.septo_inicio, p).dias ?? "—"} d` : ""}
            </Text>
          </View>
          <Text style={{ color: CORES.marca, fontWeight: "700" }}>Abrir ›</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  acoes: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", gap: 8, justifyContent: "space-between" },
  acao: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  acaoTxt: { fontWeight: "700", color: CORES.texto, fontSize: 13 },
  painel: { position: "absolute", left: 12, right: 12, bottom: 16, backgroundColor: CORES.superficie, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, elevation: 4 },
  painelTitulo: { fontSize: 17, fontWeight: "700", color: CORES.texto },
  painelSub: { color: CORES.textoSuave, fontSize: 13 },
});
