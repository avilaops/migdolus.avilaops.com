import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { abrir, agora, listarFazendas, listarTalhoes, uuid, type Fazenda, type Talhao } from "../../src/db";
import { capturarPosicao, type Posicao } from "../../src/gps";
import { Botao, Campo, Cartao, s as ui, Suave, Titulo } from "../../src/ui";
import { CORES } from "../../src/config";

/** Amostragem de larvas no solo (larvas/trincheira) — indicador de eficácia do controle. */
export default function NovaTrincheira() {
  const router = useRouter();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [fazendaId, setFazendaId] = useState("");
  const [talhaoId, setTalhaoId] = useState("");
  const [larvas, setLarvas] = useState("");
  const [obs, setObs] = useState("");
  const [pos, setPos] = useState<Posicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, t] = await Promise.all([listarFazendas(), listarTalhoes()]);
      setFazendas(f); setTalhoes(t);
      if (f.length === 1) setFazendaId(f[0].id);
      try { setPos(await capturarPosicao(undefined, 15, 8000)); } catch { /* opcional */ }
    })();
  }, []);

  const talhoesDaFazenda = useMemo(() => talhoes.filter((t) => t.fazenda_id === fazendaId), [talhoes, fazendaId]);

  async function salvar() {
    const n = Number(larvas);
    if (!talhaoId) { Alert.alert("Talhão", "Escolha o talhão da trincheira."); return; }
    if (larvas === "" || Number.isNaN(n) || n < 0) { Alert.alert("Larvas", "Informe o número de larvas (0 se nenhuma)."); return; }
    setSalvando(true);
    try {
      const d = await abrir();
      const id = uuid();
      const ts = agora();
      await d.runAsync(`INSERT INTO trincheira (id, talhao_id, realizada_em, larvas, lat, lon, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, talhaoId, ts, n, pos?.lat ?? null, pos?.lon ?? null, obs.trim() || null]);
      await d.runAsync(`INSERT INTO outbox (tipo, ref_id, criado_em) VALUES ('trincheira', ?, ?)`, [id, ts]);
      router.back();
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
      <Titulo>Trincheira (larvas no solo)</Titulo>
      <Suave>Conte as larvas de Migdolus encontradas na trincheira. {pos ? `GPS ±${Math.round(pos.precisao_m ?? 0)} m.` : "Sem GPS — tudo bem, o talhão basta."}</Suave>

      <Cartao>
        <Text style={ui.rotulo}>Fazenda</Text>
        <View style={st.chips}>
          {fazendas.map((f) => <Chip key={f.id} ativo={fazendaId === f.id} rotulo={f.nome} onPress={() => { setFazendaId(f.id); setTalhaoId(""); }} />)}
          {!fazendas.length && <Suave>Sincronize para receber fazendas e talhões.</Suave>}
        </View>
        <Text style={ui.rotulo}>Talhão</Text>
        <View style={st.chips}>
          {talhoesDaFazenda.map((t) => <Chip key={t.id} ativo={talhaoId === t.id} rotulo={t.nome} onPress={() => setTalhaoId(t.id)} />)}
          {fazendaId && !talhoesDaFazenda.length && <Suave>Esta fazenda ainda não tem talhões cadastrados no painel.</Suave>}
        </View>
      </Cartao>

      <Cartao>
        <Campo rotulo="Larvas encontradas" value={larvas} onChangeText={setLarvas} keyboardType="number-pad" placeholder="0" />
        <Campo rotulo="Observações" value={obs} onChangeText={setObs} placeholder="profundidade, umidade do solo, estágio das larvas…" multiline />
      </Cartao>

      <Botao titulo={salvando ? "Salvando…" : "Salvar trincheira"} onPress={salvar} disabled={salvando} />
    </ScrollView>
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.fundo, paddingHorizontal: 12, paddingVertical: 7 },
  chipTxt: { fontSize: 13, fontWeight: "600", color: CORES.texto },
});
