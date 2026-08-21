import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet } from "react-native";
import { useSessao } from "../src/sessao";
import { Botao, Campo } from "../src/ui";
import { CORES, API_URL } from "../src/config";

export default function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    setErro(null);
    setOcupado(true);
    try {
      await entrar(email.trim().toLowerCase(), senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar. Verifique a internet — o primeiro acesso precisa de rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: CORES.lateral }}>
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <View style={s.topo}>
          <View style={s.logo}><Text style={{ color: "#fff", fontSize: 22 }}>◎</Text></View>
          <Text style={s.marca}>Migdolus Campo</Text>
          <Text style={s.sub}>Armadilhas georreferenciadas, contagem e foto — funciona sem sinal.</Text>
        </View>
        <View style={s.cartao}>
          <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@usina.com.br" />
          <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="password" onSubmitEditing={enviar} />
          {erro && <Text style={s.erro}>{erro}</Text>}
          <Botao titulo={ocupado ? "Entrando…" : "Entrar"} onPress={enviar} disabled={ocupado || !email || !senha} />
          <Text style={s.rodape}>Servidor: {API_URL.replace(/^https?:\/\//, "")}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  conteudo: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 20 },
  topo: { alignItems: "center", gap: 8, marginBottom: 8 },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: CORES.marca, alignItems: "center", justifyContent: "center" },
  marca: { color: "#fff", fontSize: 24, fontWeight: "700" },
  sub: { color: "#c8d6cd", textAlign: "center", maxWidth: 300 },
  cartao: { backgroundColor: CORES.superficie, borderRadius: 16, padding: 18, gap: 14 },
  erro: { color: CORES.critico },
  rodape: { color: CORES.textoSuave, fontSize: 11, textAlign: "center" },
});
