import { useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { captureRef } from "react-native-view-shot";
import { File, Paths } from "expo-file-system";
import { CORES } from "./config";
import { registrarFoto, uuid } from "./db";
import type { Posicao } from "./gps";

interface Props {
  codigo: string;
  posicao: Posicao | null;
  vistoriaId: string | null;
  armadilhaId: string;
  aoConcluir(fotoId: string | null): void;
}

/**
 * Câmera + carimbo. A foto é renderizada numa View com o carimbo sobreposto
 * (código, data/hora, coordenadas) e capturada com view-shot — o carimbo fica
 * gravado na imagem, não só nos metadados.
 */
export function CameraCarimbo({ codigo, posicao, vistoriaId, armadilhaId, aoConcluir }: Props) {
  const [perm, pedirPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const carimboRef = useRef<View>(null);
  const [uriBruta, setUriBruta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const quando = new Date();

  if (!perm) return <View style={s.cheio}><ActivityIndicator /></View>;
  if (!perm.granted) {
    return (
      <View style={[s.cheio, s.centro]}>
        <Text style={s.txt}>Precisamos da câmera para a foto da bacia.</Text>
        <Pressable style={s.botao} onPress={pedirPerm}><Text style={s.botaoTxt}>Permitir câmera</Text></Pressable>
        <Pressable style={[s.botao, s.botaoSec]} onPress={() => aoConcluir(null)}><Text style={s.botaoSecTxt}>Pular foto</Text></Pressable>
      </View>
    );
  }

  async function tirar() {
    const r = await cam.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
    if (r?.uri) setUriBruta(r.uri);
  }

  async function salvar() {
    if (!carimboRef.current) return;
    setSalvando(true);
    try {
      const id = uuid();
      const tmp = await captureRef(carimboRef, { format: "jpg", quality: 0.8, result: "tmpfile", width: 1280 });
      const destino = new File(Paths.document, "fotos", `${id}.jpg`);
      if (!destino.parentDirectory.exists) destino.parentDirectory.create({ intermediates: true });
      new File(tmp).move(destino);
      await registrarFoto({ id, vistoria_id: vistoriaId, armadilha_id: armadilhaId, uri: destino.uri, tirada_em: quando.toISOString(), lat: posicao?.lat ?? null, lon: posicao?.lon ?? null });
      aoConcluir(id);
    } finally {
      setSalvando(false);
    }
  }

  const carimbo = `${codigo}  ·  ${quando.toLocaleString("pt-BR")}${posicao ? `\n${posicao.lat.toFixed(6)}, ${posicao.lon.toFixed(6)}  ±${Math.round(posicao.precisao_m ?? 0)} m` : "\nsem GPS"}`;

  if (uriBruta) {
    return (
      <View style={s.cheio}>
        <View ref={carimboRef} collapsable={false} style={s.cheio}>
          <Image source={{ uri: uriBruta }} style={s.cheio} resizeMode="cover" />
          <View style={s.faixa}><Text style={s.faixaTxt}>{carimbo}</Text></View>
        </View>
        <View style={s.acoes}>
          <Pressable style={[s.botao, s.botaoSec]} onPress={() => setUriBruta(null)}><Text style={s.botaoSecTxt}>Refazer</Text></Pressable>
          <Pressable style={s.botao} onPress={salvar} disabled={salvando}><Text style={s.botaoTxt}>{salvando ? "Salvando…" : "Usar foto"}</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.cheio}>
      <CameraView ref={cam} style={s.cheio} facing="back" />
      <View style={s.faixa}><Text style={s.faixaTxt}>{carimbo}</Text></View>
      <View style={s.acoes}>
        <Pressable style={[s.botao, s.botaoSec]} onPress={() => aoConcluir(null)}><Text style={s.botaoSecTxt}>Sem foto</Text></Pressable>
        <Pressable style={s.disparo} onPress={tirar}><View style={s.disparoInterno} /></Pressable>
        <View style={{ width: 96 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cheio: { flex: 1, backgroundColor: "#000" },
  centro: { alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  txt: { color: "#fff", textAlign: "center" },
  faixa: { position: "absolute", left: 0, right: 0, bottom: 96, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 8 },
  faixaTxt: { color: "#fff", fontFamily: "monospace", fontSize: 13, lineHeight: 18 },
  acoes: { position: "absolute", left: 0, right: 0, bottom: 0, height: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.6)" },
  disparo: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  disparoInterno: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },
  botao: { backgroundColor: CORES.marca, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, minWidth: 96, alignItems: "center" },
  botaoTxt: { color: "#fff", fontWeight: "600" },
  botaoSec: { backgroundColor: "rgba(255,255,255,0.15)" },
  botaoSecTxt: { color: "#fff", fontWeight: "600" },
});
