import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { contarPendentes, lerConfig, listarArmadilhas, listarFazendas, pendentes, type ItemOutbox } from "../../src/db";
import { sincronizar, temRede, type ResultadoSync } from "../../src/sync";
import { useSessao } from "../../src/sessao";
import { agendarAvisosSepto } from "../../src/notificacoes";
import { Botao, Cartao, s as ui, Suave, Titulo } from "../../src/ui";
import { CORES } from "../../src/config";

export default function Sync() {
  const { deviceId, usuario, sair } = useSessao();
  const [pend, setPend] = useState<{ total: number; fotos: number }>({ total: 0, fotos: 0 });
  const [fila, setFila] = useState<ItemOutbox[]>([]);
  const [ultima, setUltima] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ armadilhas: number; fazendas: number }>({ armadilhas: 0, fazendas: 0 });
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);

  const carregar = useCallback(async () => {
    const [c, f, u, a, fz] = await Promise.all([contarPendentes(), pendentes(), lerConfig("ultima_sync"), listarArmadilhas(), listarFazendas()]);
    setPend(c); setFila(f); setUltima(u); setResumo({ armadilhas: a.length, fazendas: fz.length });
  }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function rodar() {
    if (!(await temRede())) { Alert.alert("Sem internet", "Conecte ao Wi-Fi ou 4G e tente de novo. Seus dados continuam guardados no aparelho."); return; }
    setOcupado(true); setResultado(null);
    try {
      const r = await sincronizar(deviceId, setMsg);
      setResultado(r);
      agendarAvisosSepto();
    } finally {
      setOcupado(false); setMsg(null);
      carregar();
    }
  }

  const erros = fila.filter((i) => i.erro);

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      <Titulo>Sincronização</Titulo>
      <Suave>{usuario?.nome} · aparelho {deviceId}</Suave>

      <Cartao>
        <View style={[ui.linha, { justifyContent: "space-between" }]}>
          <View>
            <Text style={{ fontSize: 32, fontWeight: "800", color: pend.total ? CORES.aviso : CORES.marca }}>{pend.total}</Text>
            <Suave>registros aguardando envio{pend.fotos ? ` (${pend.fotos} fotos)` : ""}</Suave>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: "700", color: CORES.texto }}>{resumo.armadilhas} armadilhas</Text>
            <Suave>{resumo.fazendas} fazenda(s) no aparelho</Suave>
          </View>
        </View>
        <Suave>Última sincronização: {ultima ? new Date(ultima).toLocaleString("pt-BR") : "nunca"}</Suave>
        <Botao titulo={ocupado ? (msg ?? "Sincronizando…") : "Sincronizar agora"} onPress={rodar} disabled={ocupado} />
      </Cartao>

      {resultado && (
        <Cartao style={{ borderColor: resultado.erros.length ? CORES.aviso : CORES.marca }}>
          <Text style={{ fontWeight: "700", color: CORES.texto }}>{resultado.erros.length ? "Concluído com avisos" : "Tudo sincronizado"}</Text>
          <Suave>{resultado.enviados} registros enviados · {resultado.fotosEnviadas} fotos · {resultado.recebidos} itens recebidos</Suave>
          {resultado.erros.map((e, i) => <Text key={i} style={{ color: CORES.critico, fontSize: 12 }}>• {e}</Text>)}
        </Cartao>
      )}

      {erros.length > 0 && (
        <Cartao>
          <Text style={{ fontWeight: "700", color: CORES.texto }}>Itens com erro (serão reenviados)</Text>
          {erros.slice(0, 10).map((i) => (
            <Suave key={i.seq}>• {i.tipo} {i.ref_id.slice(0, 8)} — {i.erro} ({i.tentativas}x)</Suave>
          ))}
        </Cartao>
      )}

      <Cartao>
        <Text style={{ fontWeight: "700", color: CORES.texto }}>Como funciona</Text>
        <Suave>1. No campo, tudo fica salvo no aparelho — armadilhas, contagens, fotos com carimbo.</Suave>
        <Suave>2. Ao ter sinal, toque em Sincronizar: o lote sobe para o escritório e você recebe talhões, parâmetros e a malha planejada.</Suave>
        <Suave>3. Baixe o mapa offline na aba Mapa (pelo Wi-Fi) antes de ir para talhões sem sinal.</Suave>
      </Cartao>

      <Botao
        titulo="Sair deste aparelho"
        variante="secundario"
        onPress={() => Alert.alert("Sair", pend.total ? `Há ${pend.total} registro(s) não enviados. Sincronize antes de sair, senão eles serão perdidos.` : "Os dados locais serão apagados.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Sair mesmo assim", style: "destructive", onPress: () => { sair(); } },
        ])}
      />
    </ScrollView>
  );
}
