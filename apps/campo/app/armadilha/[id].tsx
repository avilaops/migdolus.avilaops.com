import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { buscarArmadilha, fotosDaArmadilha, parametros, vistoriasDaArmadilha, type Armadilha, type Foto, type Parametros, type Vistoria } from "../../src/db";
import { distanciaM, formatarDistancia, rumoGraus } from "../../src/gps";
import { BadgeSepto, Botao, Cartao, COR_NIVEL, faixaSepto, nivelInfestacao, s as ui, Suave, Titulo } from "../../src/ui";
import { CORES } from "../../src/config";

export default function DetalheArmadilha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [a, setA] = useState<Armadilha | null>(null);
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [p, setP] = useState<Parametros | null>(null);
  const [pos, setPos] = useState<{ lat: number; lon: number; heading: number | null } | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [arm, par] = await Promise.all([buscarArmadilha(id), parametros()]);
    setA(arm); setP(par);
    if (arm) {
      const [v, f] = await Promise.all([vistoriasDaArmadilha(arm.id), fotosDaArmadilha(arm.id)]);
      setVistorias(v); setFotos(f);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 }, (l) =>
        setPos({ lat: l.coords.latitude, lon: l.coords.longitude, heading: l.coords.heading ?? null }));
    })();
    return () => sub?.remove();
  }, []);

  if (!a || !p) return <View style={ui.tela} />;

  const { faixa, dias } = faixaSepto(a.status === "ativa" ? a.septo_inicio : null, p);
  const nivel = nivelInfestacao(a.ultima_contagem, p);
  const dist = pos ? distanciaM(pos.lat, pos.lon, a.lat, a.lon) : null;
  const rumo = pos ? rumoGraus(pos.lat, pos.lon, a.lat, a.lon) : null;
  const diasRestantes = dias !== null ? p.dias_septo - dias : null;

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      <View style={[ui.linha, { justifyContent: "space-between" }]}>
        <Titulo>{a.codigo}</Titulo>
        {a.status === "ativa" ? <BadgeSepto faixa={faixa} dias={dias} /> : <Suave>a instalar</Suave>}
      </View>
      <Suave>{a.finalidade === "coleta_massal" ? "Coleta massal" : "Monitoramento"} · instalada em {new Date(a.instalada_em).toLocaleDateString("pt-BR")}{a.observacoes ? ` · ${a.observacoes}` : ""}</Suave>

      {/* Localizador */}
      <Cartao>
        <View style={[ui.linha, { justifyContent: "space-between" }]}>
          <View>
            <Text style={ui.rotulo}>Distância até a armadilha</Text>
            <Text style={st.grande}>{dist !== null ? formatarDistancia(dist) : "—"}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={[st.seta, { transform: [{ rotate: `${((rumo ?? 0) - (pos?.heading ?? 0) + 360) % 360}deg` }] }]}>➤</Text>
            <Suave>{rumo !== null ? `${Math.round(rumo)}°` : ""}</Suave>
          </View>
        </View>
        <Suave style={{ fontFamily: "monospace" }}>{a.lat.toFixed(6)}, {a.lon.toFixed(6)} {a.precisao_m ? `(±${Math.round(a.precisao_m)} m)` : ""}</Suave>
        <Pressable onPress={() => Linking.openURL(`geo:${a.lat},${a.lon}?q=${a.lat},${a.lon}(${encodeURIComponent(a.codigo)})`)}>
          <Text style={{ color: CORES.marca, fontWeight: "600" }}>Abrir no app de mapas</Text>
        </Pressable>
      </Cartao>

      {a.status === "planejada" ? (
        <Botao titulo="Estou no ponto — instalar agora" onPress={() => router.push({ pathname: "/armadilha/nova", params: { planejada: a.id } })} />
      ) : (
        <>
          <View style={ui.linha}>
            <View style={[ui.cartao, { flex: 1 }]}>
              <Text style={ui.rotulo}>Última contagem</Text>
              <Text style={[st.grande, { color: nivel ? COR_NIVEL[nivel] : CORES.texto }]}>{a.ultima_contagem ?? "—"}</Text>
              <Suave>{a.ultima_vistoria_em ? new Date(a.ultima_vistoria_em).toLocaleDateString("pt-BR") : "sem vistoria"}</Suave>
            </View>
            <View style={[ui.cartao, { flex: 1 }]}>
              <Text style={ui.rotulo}>Septo</Text>
              <Text style={[st.grande, { color: faixa === "critico" ? CORES.critico : faixa === "aviso" ? CORES.aviso : CORES.texto }]}>{dias !== null ? `${dias} d` : "—"}</Text>
              <Suave>{diasRestantes !== null ? (diasRestantes > 0 ? `troca em ${diasRestantes} d` : "trocar agora") : "sem septo"}</Suave>
            </View>
          </View>
          <Botao titulo="Registrar vistoria" onPress={() => router.push({ pathname: "/vistoria/[armadilhaId]", params: { armadilhaId: a.id } })} />
        </>
      )}

      {vistorias.length > 0 && (
        <Cartao>
          <Text style={{ fontWeight: "700", color: CORES.texto }}>Histórico</Text>
          {vistorias.map((v) => (
            <View key={v.id} style={[ui.linha, { justifyContent: "space-between" }]}>
              <Suave>{new Date(v.realizada_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{v.troca_septo ? " · septo trocado" : ""}{v.enviada ? "" : " · pendente"}</Suave>
              <Text style={{ fontWeight: "700", color: CORES.texto }}>{v.adultos}</Text>
            </View>
          ))}
        </Cartao>
      )}

      {fotos.length > 0 && (
        <Cartao>
          <Text style={{ fontWeight: "700", color: CORES.texto }}>Fotos ({fotos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {fotos.map((f) => <Image key={f.id} source={{ uri: f.uri }} style={st.foto} />)}
          </ScrollView>
        </Cartao>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  grande: { fontSize: 30, fontWeight: "800", color: CORES.texto },
  seta: { fontSize: 40, color: CORES.marca },
  foto: { width: 110, height: 110, borderRadius: 10, backgroundColor: "#ddd" },
});
