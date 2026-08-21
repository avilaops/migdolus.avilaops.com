import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { contarPendentes, lerConfig, listarArmadilhas, parametros, type Armadilha, type Parametros } from "../../src/db";
import { distanciaM, formatarDistancia } from "../../src/gps";
import { BadgeSepto, COR_NIVEL, faixaSepto, nivelInfestacao, s as ui, Suave } from "../../src/ui";
import { CORES } from "../../src/config";

type Filtro = "todas" | "vencendo" | "planejadas";

export default function Armadilhas() {
  const router = useRouter();
  const [lista, setLista] = useState<Armadilha[]>([]);
  const [p, setP] = useState<Parametros | null>(null);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pend, setPend] = useState(0);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    const [a, par, c, us] = await Promise.all([listarArmadilhas(), parametros(), contarPendentes(), lerConfig("ultima_sync")]);
    setLista(a); setP(par); setPend(c.total); setUltimaSync(us);
    setAtualizando(false);
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const ultima = await Location.getLastKnownPositionAsync();
      if (ultima) setPos({ lat: ultima.coords.latitude, lon: ultima.coords.longitude });
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 }, (l) =>
        setPos({ lat: l.coords.latitude, lon: l.coords.longitude }));
    })();
    return () => sub?.remove();
  }, []);

  const itens = useMemo(() => {
    if (!p) return [];
    const q = busca.trim().toLowerCase();
    return lista
      .map((a) => {
        const { faixa, dias } = faixaSepto(a.status === "ativa" ? a.septo_inicio : null, p);
        const dist = pos ? distanciaM(pos.lat, pos.lon, a.lat, a.lon) : null;
        return { a, faixa, dias, dist, nivel: nivelInfestacao(a.ultima_contagem, p) };
      })
      .filter((x) => (filtro === "vencendo" ? x.a.status === "ativa" && (x.faixa === "aviso" || x.faixa === "critico") : filtro === "planejadas" ? x.a.status === "planejada" : true))
      .filter((x) => !q || x.a.codigo.toLowerCase().includes(q))
      .sort((x, y) => (x.dist ?? 1e12) - (y.dist ?? 1e12));
  }, [lista, p, pos, busca, filtro]);

  const vencendo = useMemo(() => (p ? lista.filter((a) => a.status === "ativa" && ["aviso", "critico"].includes(faixaSepto(a.septo_inicio, p).faixa)).length : 0), [lista, p]);
  const planejadas = lista.filter((a) => a.status === "planejada").length;

  return (
    <View style={ui.tela}>
      <View style={st.topo}>
        <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar código…" placeholderTextColor="#9aa79f" style={[ui.campo, { flex: 1 }]} autoCapitalize="characters" />
        <Pressable onPress={() => router.push("/armadilha/nova")} style={st.novo}><Text style={st.novoTxt}>+ Instalar</Text></Pressable>
      </View>
      <View style={st.filtros}>
        <Chip ativo={filtro === "todas"} onPress={() => setFiltro("todas")} rotulo={`Todas (${lista.length})`} />
        <Chip ativo={filtro === "vencendo"} onPress={() => setFiltro("vencendo")} rotulo={`Trocar septo (${vencendo})`} cor={vencendo ? CORES.aviso : undefined} />
        <Chip ativo={filtro === "planejadas"} onPress={() => setFiltro("planejadas")} rotulo={`A instalar (${planejadas})`} />
      </View>
      {(pend > 0 || !ultimaSync) && (
        <Link href="/sync" asChild>
          <Pressable style={st.aviso}>
            <Text style={st.avisoTxt}>{pend > 0 ? `${pend} registro(s) aguardando sincronização` : "Nunca sincronizado — toque para baixar fazendas e armadilhas"}</Text>
          </Pressable>
        </Link>
      )}
      <FlatList
        data={itens}
        keyExtractor={(x) => x.a.id}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={carregar} />}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: CORES.texto }}>Nenhuma armadilha</Text>
            <Suave style={{ textAlign: "center" }}>Instale a primeira com o botão “+ Instalar” ou sincronize para receber a malha planejada no escritório.</Suave>
          </View>
        }
        renderItem={({ item: x }) => (
          <Pressable onPress={() => router.push({ pathname: "/armadilha/[id]", params: { id: x.a.id } })} style={({ pressed }) => [ui.cartao, { opacity: pressed ? 0.85 : 1 }]}>
            <View style={[ui.linha, { justifyContent: "space-between" }]}>
              <View style={ui.linha}>
                <View style={[st.bolinha, { backgroundColor: x.nivel ? COR_NIVEL[x.nivel] : "#9e9e9e" }]} />
                <Text style={st.codigo}>{x.a.codigo}</Text>
                {x.a.status === "planejada" && <Text style={st.tagPlan}>a instalar</Text>}
              </View>
              <Text style={st.dist}>{x.dist !== null ? formatarDistancia(x.dist) : "—"}</Text>
            </View>
            <View style={[ui.linha, { justifyContent: "space-between" }]}>
              {x.a.status === "ativa" ? <BadgeSepto faixa={x.faixa} dias={x.dias} /> : <Suave>Confirme o ponto no campo</Suave>}
              <Suave>{x.a.ultima_contagem !== null ? `${x.a.ultima_contagem} adultos` : "sem vistoria"}</Suave>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Chip({ rotulo, ativo, onPress, cor }: { rotulo: string; ativo: boolean; onPress: () => void; cor?: string }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, ativo && { backgroundColor: cor ?? CORES.marca, borderColor: cor ?? CORES.marca }]}>
      <Text style={[st.chipTxt, ativo && { color: "#fff" }]}>{rotulo}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  topo: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 4 },
  novo: { backgroundColor: CORES.marca, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  novoTxt: { color: "#fff", fontWeight: "700" },
  filtros: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.superficie, paddingHorizontal: 10, paddingVertical: 6 },
  chipTxt: { fontSize: 12, fontWeight: "600", color: CORES.textoSuave },
  aviso: { marginHorizontal: 12, marginBottom: 4, backgroundColor: "#fff7d6", borderColor: "#f1d87a", borderWidth: 1, borderRadius: 10, padding: 10 },
  avisoTxt: { color: "#6d5200", fontSize: 13, fontWeight: "600" },
  bolinha: { width: 12, height: 12, borderRadius: 6 },
  codigo: { fontSize: 17, fontWeight: "700", color: CORES.texto },
  tagPlan: { fontSize: 11, color: CORES.textoSuave, borderWidth: 1, borderColor: CORES.borda, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  dist: { fontVariant: ["tabular-nums"], color: CORES.texto, fontWeight: "600" },
});
