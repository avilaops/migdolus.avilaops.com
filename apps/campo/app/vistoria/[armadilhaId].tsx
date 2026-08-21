import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { buscarArmadilha, parametros, registrarVistoria, type Armadilha, type Parametros } from "../../src/db";
import { capturarPosicao, distanciaM, type Posicao } from "../../src/gps";
import { CameraCarimbo } from "../../src/foto";
import { Botao, Campo, Cartao, faixaSepto, s as ui, Suave, Titulo } from "../../src/ui";
import { CORES, DISTANCIA_REALOCACAO_M } from "../../src/config";

export default function NovaVistoria() {
  const { armadilhaId } = useLocalSearchParams<{ armadilhaId: string }>();
  const router = useRouter();
  const [a, setA] = useState<Armadilha | null>(null);
  const [p, setP] = useState<Parametros | null>(null);
  const [adultos, setAdultos] = useState("");
  const [troca, setTroca] = useState(false);
  const [lote, setLote] = useState("");
  const [obs, setObs] = useState("");
  const [pos, setPos] = useState<Posicao | null>(null);
  const [lendo, setLendo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [camera, setCamera] = useState<null | { vistoriaId: string }>(null);

  useEffect(() => {
    (async () => {
      const [arm, par] = await Promise.all([buscarArmadilha(armadilhaId!), parametros()]);
      setA(arm); setP(par);
      if (arm && par) {
        const f = faixaSepto(arm.septo_inicio, par);
        if (f.faixa === "critico" || f.faixa === "aviso") setTroca(true); // sugere troca quando está na hora
      }
      try { setPos(await capturarPosicao()); } catch { /* segue sem GPS */ } finally { setLendo(false); }
    })();
  }, [armadilhaId]);

  if (!a || !p) return <View style={ui.tela} />;

  const dist = pos ? distanciaM(pos.lat, pos.lon, a.lat, a.lon) : null;
  const n = adultos === "" ? null : Number(adultos);
  const densidade = n !== null && a.ultima_vistoria_em ? n / Math.max(1, (Date.now() - new Date(a.ultima_vistoria_em).getTime()) / 864e5) : null;

  function teclar(d: string) {
    if (d === "⌫") setAdultos((v) => v.slice(0, -1));
    else setAdultos((v) => (v === "0" ? d : v + d).slice(0, 6));
  }

  async function salvar() {
    if (n === null || Number.isNaN(n)) { Alert.alert("Contagem", "Digite o número de adultos capturados (0 se nenhum)."); return; }
    if (dist !== null && dist > DISTANCIA_REALOCACAO_M) {
      const ok = await new Promise<boolean>((res) => Alert.alert("Você está longe do ponto", `${Math.round(dist)} m da posição cadastrada. Registrar mesmo assim?`, [
        { text: "Cancelar", style: "cancel", onPress: () => res(false) },
        { text: "Registrar", onPress: () => res(true) },
      ]));
      if (!ok) return;
    }
    setSalvando(true);
    try {
      const v = await registrarVistoria({
        armadilha_id: a!.id, adultos: n, lat: pos?.lat ?? null, lon: pos?.lon ?? null, precisao_m: pos?.precisao_m ?? null,
        precisao_baixa: pos?.precisao_baixa ?? true, troca_septo: troca, lote_septo: lote.trim() || null, observacoes: obs.trim() || null,
      });
      setCamera({ vistoriaId: v.id });
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
        <Titulo>Vistoria · {a.codigo}</Titulo>
        <Suave>
          {lendo ? "lendo GPS…" : pos ? `GPS ±${Math.round(pos.precisao_m ?? 0)} m · ${dist !== null ? `${Math.round(dist)} m do ponto` : ""}` : "sem GPS nesta vistoria"}
        </Suave>

        <Cartao style={{ alignItems: "center" }}>
          <Text style={ui.rotulo}>Adultos capturados</Text>
          <Text style={st.numero}>{adultos === "" ? "–" : adultos}</Text>
          {densidade !== null && <Suave>≈ {densidade.toFixed(1)} adultos/armadilha/dia desde a última vistoria</Suave>}
          <View style={st.teclado}>
            {["1","2","3","4","5","6","7","8","9","0","00","⌫"].map((t) => (
              <Pressable key={t} onPress={() => teclar(t)} style={({ pressed }) => [st.tecla, pressed && { backgroundColor: CORES.marcaClara }]}>
                <Text style={st.teclaTxt}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Cartao>

        <Cartao>
          <View style={[ui.linha, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: CORES.texto }}>Troquei o septo de feromônio</Text>
              <Suave>{faixaSepto(a.septo_inicio, p).dias ?? 0} dias desde o último · reinicia o contador de {p.dias_septo} dias</Suave>
            </View>
            <Switch value={troca} onValueChange={setTroca} trackColor={{ true: CORES.marca }} />
          </View>
          {troca && <Campo rotulo="Lote do septo novo (opcional)" value={lote} onChangeText={setLote} autoCapitalize="characters" />}
          <Campo rotulo="Observações" value={obs} onChangeText={setObs} placeholder="bacia seca, armadilha tombada, formigas…" multiline />
        </Cartao>

        <Botao titulo={salvando ? "Salvando…" : "Salvar e fotografar a bacia"} onPress={salvar} disabled={salvando || n === null} />
      </ScrollView>

      <Modal visible={!!camera} animationType="slide" onRequestClose={() => {}}>
        {camera && (
          <CameraCarimbo
            codigo={a.codigo}
            posicao={pos}
            vistoriaId={camera.vistoriaId}
            armadilhaId={a.id}
            aoConcluir={() => { setCamera(null); router.back(); }}
          />
        )}
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  numero: { fontSize: 64, fontWeight: "800", color: CORES.texto, lineHeight: 72 },
  teclado: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, width: "100%" },
  tecla: { width: "31%", paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.fundo, alignItems: "center" },
  teclaTxt: { fontSize: 22, fontWeight: "700", color: CORES.texto },
});
