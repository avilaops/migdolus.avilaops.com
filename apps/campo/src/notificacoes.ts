import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { listarArmadilhas, parametros } from "./db";

// Avisos locais de troca de septo: funcionam sem rede, agendados no aparelho.
// Reagendados a cada sincronização e a cada abertura da lista.

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let permissaoPedida = false;

export async function agendarAvisosSepto(): Promise<void> {
  try {
    if (!permissaoPedida) {
      permissaoPedida = true;
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        const r = await Notifications.requestPermissionsAsync();
        if (r.status !== "granted") return;
      }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("septo", { name: "Troca de septo", importance: Notifications.AndroidImportance.HIGH, sound: undefined });
      }
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [arms, p] = await Promise.all([listarArmadilhas(), parametros()]);
    const agora = Date.now();
    const ativas = arms.filter((a) => a.status === "ativa" && a.septo_inicio);

    // Um aviso por dia-alvo (agrupado), não um por armadilha: "N armadilhas chegam a 20 dias amanhã".
    const grupos = new Map<string, { quando: Date; tipo: "aviso" | "critico"; codigos: string[] }>();
    for (const a of ativas) {
      const inicio = new Date(a.septo_inicio!).getTime();
      for (const [tipo, dias] of [["aviso", p.dias_septo_aviso], ["critico", p.dias_septo]] as const) {
        const alvo = new Date(inicio + dias * 864e5);
        alvo.setHours(7, 30, 0, 0);
        if (alvo.getTime() <= agora) continue;
        const chave = `${tipo}-${alvo.toISOString().slice(0, 10)}`;
        const g = grupos.get(chave) ?? { quando: alvo, tipo, codigos: [] };
        g.codigos.push(a.codigo);
        grupos.set(chave, g);
      }
    }
    const lista = [...grupos.values()].sort((x, y) => x.quando.getTime() - y.quando.getTime()).slice(0, 40);
    for (const g of lista) {
      const n = g.codigos.length;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: g.tipo === "critico" ? `Septo vencido em ${n} armadilha${n > 1 ? "s" : ""}` : `Trocar septo em breve (${n})`,
          body: `${g.codigos.slice(0, 6).join(", ")}${n > 6 ? ` e mais ${n - 6}` : ""} — ${g.tipo === "critico" ? `${p.dias_septo} dias: troque hoje` : `${p.dias_septo_aviso} dias de uso`}`,
          data: { tipo: g.tipo },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: g.quando, channelId: "septo" },
      });
    }
  } catch {
    // notificações são conveniência; nunca bloqueiam o fluxo de campo
  }
}
