import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { CORES } from "./config";
import type { Parametros } from "./db";

export type FaixaSepto = "ok" | "aviso" | "critico" | "sem_septo";

export function faixaSepto(septoInicio: string | null, p: Parametros): { faixa: FaixaSepto; dias: number | null } {
  if (!septoInicio) return { faixa: "sem_septo", dias: null };
  const dias = Math.floor((Date.now() - new Date(septoInicio).getTime()) / 864e5);
  if (dias >= p.dias_septo) return { faixa: "critico", dias };
  if (dias >= p.dias_septo_aviso) return { faixa: "aviso", dias };
  return { faixa: "ok", dias };
}

export function nivelInfestacao(contagem: number | null, p: Parametros): "baixo" | "medio" | "alto" | null {
  if (contagem === null || contagem === undefined) return null;
  if (contagem >= p.faixa_alta_min) return "alto";
  if (contagem >= p.faixa_media_min) return "medio";
  return "baixo";
}

export const COR_FAIXA: Record<FaixaSepto, string> = { ok: CORES.ok, aviso: CORES.aviso, critico: CORES.critico, sem_septo: "#9e9e9e" };
export const ROTULO_FAIXA: Record<FaixaSepto, string> = { ok: "Em dia", aviso: "Trocar em breve", critico: "Septo vencido", sem_septo: "Sem septo" };
export const COR_NIVEL = { baixo: "#2e9e52", medio: "#e0b400", alto: "#d32f2f" } as const;

export function BadgeSepto({ faixa, dias }: { faixa: FaixaSepto; dias: number | null }) {
  return (
    <View style={[s.badge, { backgroundColor: COR_FAIXA[faixa] + "22", borderColor: COR_FAIXA[faixa] }]}>
      <View style={[s.ponto, { backgroundColor: COR_FAIXA[faixa] }]} />
      <Text style={[s.badgeTxt, { color: COR_FAIXA[faixa] }]}>{ROTULO_FAIXA[faixa]}{dias !== null ? ` · ${dias} d` : ""}</Text>
    </View>
  );
}

export function Botao({ titulo, onPress, variante = "primario", disabled, style }: { titulo: string; onPress: () => void; variante?: "primario" | "secundario" | "perigo"; disabled?: boolean; style?: ViewStyle }) {
  const bg = variante === "primario" ? CORES.marca : variante === "perigo" ? CORES.critico : CORES.superficie;
  const cor = variante === "secundario" ? CORES.texto : "#fff";
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.botao, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: variante === "secundario" ? 1 : 0, borderColor: CORES.borda }, style]}>
      <Text style={[s.botaoTxt, { color: cor }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput placeholderTextColor="#9aa79f" {...props} style={[s.campo, props.style]} />
    </View>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={s.titulo}>{children}</Text>;
}
export function Suave({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.suave, style]}>{children}</Text>;
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  conteudo: { padding: 16, gap: 12 },
  titulo: { fontSize: 22, fontWeight: "700", color: CORES.texto },
  suave: { color: CORES.textoSuave, fontSize: 13 },
  rotulo: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: CORES.textoSuave },
  campo: { borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.superficie, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: CORES.texto },
  cartao: { backgroundColor: CORES.superficie, borderRadius: 14, borderWidth: 1, borderColor: CORES.borda, padding: 14, gap: 8 },
  botao: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  botaoTxt: { fontWeight: "700", fontSize: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  badgeTxt: { fontSize: 12, fontWeight: "600" },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10 },
});
