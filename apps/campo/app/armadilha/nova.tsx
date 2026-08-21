import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { instalarArmadilha, listarArmadilhas, listarFazendas, listarTalhoes, buscarArmadilha, type Armadilha, type Fazenda, type Finalidade, type Talhao } from "../../src/db";
import { capturarPosicao, distanciaM, type Posicao } from "../../src/gps";
import { CameraCarimbo } from "../../src/foto";
import { Botao, Campo, Cartao, s as ui, Suave, Titulo } from "../../src/ui";
import { CORES, PRECISAO_ALVO_M } from "../../src/config";

/**
 * Instalação de armadilha. Dois caminhos:
 *  - confirmar um ponto planejado (vem com ?planejada=<id>) — o GPS real substitui o planejado;
 *  - instalar livre, sem mapa prévio — a malha nasce do GPS.
 */
export default function NovaArmadilha() {
  const router = useRouter();
  const { planejada } = useLocalSearchParams<{ planejada?: string }>();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [fazendaId, setFazendaId] = useState<string>("");
  const [talhaoId, setTalhaoId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [finalidade, setFinalidade] = useState<Finalidade>("coleta_massal");
  const [lote, setLote] = useState("");
  const [obs, setObs] = useState("");
  const [pos, setPos] = useState<Posicao | null>(null);
  const [lendoGps, setLendoGps] = useState(false);
  const [leitura, setLeitura] = useState<Posicao | null>(null);
  const [planejadaObj, setPlanejadaObj] = useState<Armadilha | null>(null);
  const [existentes, setExistentes] = useState<Armadilha[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [camera, setCamera] = useState<null | { armadilha: Armadilha }>(null);

  useEffect(() => {
    (async () => {
      const [f, t, ex] = await Promise.all([listarFazendas(), listarTalhoes(), listarArmadilhas()]);
      setFazendas(f); setTalhoes(t); setExistentes(ex);
      if (planejada) {
        const a = await buscarArmadilha(planejada);
        if (a) { setPlanejadaObj(a); setFazendaId(a.fazenda_id); setTalhaoId(a.talhao_id); setCodigo(a.codigo); setFinalidade(a.finalidade); }
      } else if (f.length === 1) setFazendaId(f[0].id);
      lerGps();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lerGps() {
    setLendoGps(true); setLeitura(null);
    try {
      const p = await capturarPosicao(setLeitura);
      setPos(p);
    } catch (e) {
      Alert.alert("GPS", e instanceof Error ? e.message : String(e));
    } finally {
      setLendoGps(false);
    }
  }

  const talhoesDaFazenda = useMemo(() => talhoes.filter((t) => t.fazenda_id === fazendaId), [talhoes, fazendaId]);
  const codigoDuplicado = useMemo(() => !!codigo && existentes.some((a) => a.codigo.toUpperCase() === codigo.trim().toUpperCase() && a.id !== planejadaObj?.id && a.fazenda_id === fazendaId), [codigo, existentes, fazendaId, planejadaObj]);
  const sugestao = useMemo(() => {
    if (planejadaObj || codigo) return null;
    const n = existentes.filter((a) => a.fazenda_id === fazendaId).length + 1;
    const t = talhoesDaFazenda.find((x) => x.id === talhaoId);
    return `${(t?.nome ?? "ARM").replace(/\s+/g, "").slice(0, 8).toUpperCase()}-${String(n).padStart(3, "0")}`;
  }, [existentes, fazendaId, talhaoId, talhoesDaFazenda, planejadaObj, codigo]);

  const distPlanejada = planejadaObj && pos ? distanciaM(pos.lat, pos.lon, planejadaObj.lat, planejadaObj.lon) : null;

  async function salvar() {
    if (!pos) { Alert.alert("GPS", "Aguarde a leitura do GPS."); return; }
    if (!fazendaId) { Alert.alert("Fazenda", "Escolha a fazenda. Se não houver nenhuma, sincronize primeiro."); return; }
    const cod = (codigo || sugestao || "").trim().toUpperCase();
    if (!cod) { Alert.alert("Código", "Informe o código da armadilha."); return; }
    if (codigoDuplicado) { Alert.alert("Código", "Já existe armadilha com esse código nesta fazenda."); return; }
    setSalvando(true);
    try {
      const a = await instalarArmadilha({
        fazenda_id: fazendaId, talhao_id: talhaoId, codigo: cod, finalidade, lat: pos.lat, lon: pos.lon, precisao_m: pos.precisao_m,
        observacoes: obs.trim() || null, lote_septo: lote.trim() || null, planejada_id: planejadaObj?.id ?? null,
      });
      setCamera({ armadilha: a });
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
        <Titulo>{planejadaObj ? `Confirmar ${planejadaObj.codigo}` : "Instalar armadilha"}</Titulo>
        <Suave>{planejadaObj ? "Vá até o ponto planejado e confirme com o GPS real." : "Sem mapa prévio? Instale aqui mesmo — a posição vem do GPS."}</Suave>

        <Cartao>
          <View style={[ui.linha, { justifyContent: "space-between" }]}>
            <Text style={{ fontWeight: "700", color: CORES.texto }}>Posição GPS</Text>
            <Pressable onPress={lerGps} disabled={lendoGps}><Text style={{ color: CORES.marca, fontWeight: "700" }}>{lendoGps ? "lendo…" : "ler de novo"}</Text></Pressable>
          </View>
          {pos ? (
            <>
              <Text style={st.coord}>{pos.lat.toFixed(6)}, {pos.lon.toFixed(6)}</Text>
              <Suave style={{ color: (pos.precisao_m ?? 99) <= PRECISAO_ALVO_M ? CORES.marca : CORES.aviso }}>
                precisão ±{Math.round(pos.precisao_m ?? 0)} m {pos.precisao_baixa ? "· baixa — se puder, aguarde céu aberto" : "· boa"}
              </Suave>
              {distPlanejada !== null && (
                <Suave style={{ color: distPlanejada > 30 ? CORES.aviso : CORES.marca }}>
                  {Math.round(distPlanejada)} m do ponto planejado{distPlanejada > 30 ? " — a posição real será gravada" : ""}
                </Suave>
              )}
            </>
          ) : (
            <Suave>{leitura ? `aguardando precisão… (±${Math.round(leitura.precisao_m ?? 0)} m)` : "procurando satélites…"}</Suave>
          )}
        </Cartao>

        {!planejadaObj && (
          <Cartao>
            <Text style={ui.rotulo}>Fazenda</Text>
            <View style={st.chips}>
              {fazendas.map((f) => <Chip key={f.id} ativo={fazendaId === f.id} rotulo={f.nome} onPress={() => { setFazendaId(f.id); setTalhaoId(null); }} />)}
              {!fazendas.length && <Suave>Nenhuma fazenda no aparelho — sincronize.</Suave>}
            </View>
            {talhoesDaFazenda.length > 0 && (
              <>
                <Text style={ui.rotulo}>Talhão (opcional)</Text>
                <View style={st.chips}>
                  <Chip ativo={!talhaoId} rotulo="sem talhão" onPress={() => setTalhaoId(null)} />
                  {talhoesDaFazenda.map((t) => <Chip key={t.id} ativo={talhaoId === t.id} rotulo={t.nome} onPress={() => setTalhaoId(t.id)} />)}
                </View>
              </>
            )}
          </Cartao>
        )}

        <Cartao>
          <Campo rotulo="Código da armadilha" value={codigo} onChangeText={setCodigo} placeholder={sugestao ?? "T12-001"} autoCapitalize="characters" />
          {codigoDuplicado && <Text style={{ color: CORES.critico, fontSize: 12 }}>Código já usado nesta fazenda.</Text>}
          <Text style={ui.rotulo}>Finalidade</Text>
          <View style={st.chips}>
            <Chip ativo={finalidade === "coleta_massal"} rotulo="Coleta massal" onPress={() => setFinalidade("coleta_massal")} />
            <Chip ativo={finalidade === "monitoramento"} rotulo="Monitoramento" onPress={() => setFinalidade("monitoramento")} />
          </View>
          <Campo rotulo="Lote do septo (opcional)" value={lote} onChangeText={setLote} placeholder="ex.: L2408-17" autoCapitalize="characters" />
          <Campo rotulo="Observações" value={obs} onChangeText={setObs} placeholder="borda de carreador, solo úmido…" multiline />
        </Cartao>

        <Botao titulo={salvando ? "Salvando…" : "Salvar e fotografar"} onPress={salvar} disabled={salvando || !pos || lendoGps} />
        <Suave style={{ textAlign: "center" }}>O contador de {"30"} dias do septo começa agora.</Suave>
      </ScrollView>

      <Modal visible={!!camera} animationType="slide" onRequestClose={() => {}}>
        {camera && (
          <CameraCarimbo
            codigo={camera.armadilha.codigo}
            posicao={pos}
            vistoriaId={null}
            armadilhaId={camera.armadilha.id}
            aoConcluir={() => { setCamera(null); router.replace({ pathname: "/armadilha/[id]", params: { id: camera.armadilha.id } }); }}
          />
        )}
      </Modal>
    </>
  );
}

function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, ativo && { backgroundColor: CORES.marca, borderColor: CORES.marca }]}>
      <Text style={[st.chipTxt, ativo && { color: "#fff" }]}>{rotulo}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  coord: { fontFamily: "monospace", fontSize: 16, color: CORES.texto },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.fundo, paddingHorizontal: 12, paddingVertical: 7 },
  chipTxt: { fontSize: 13, fontWeight: "600", color: CORES.texto },
});

