import * as Network from "expo-network";
import { api, ErroApi } from "./api";
import {
  abrir, aplicarPull, concluirOutbox, gravarConfig, lerConfig, marcarErroOutbox, pendentes,
  type Armadilha, type Ciclo, type Foto, type ItemOutbox, type PullArmadilha, type Vistoria, type Fazenda, type Trincheira,
} from "./db";

export interface ResultadoSync {
  enviados: number;
  fotosEnviadas: number;
  recebidos: number;
  erros: string[];
  cursor: string | null;
}

export async function temRede(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/** Push do outbox (em lote) + upload de fotos + pull incremental. */
export async function sincronizar(deviceId: string, onProgresso?: (msg: string) => void): Promise<ResultadoSync> {
  const r: ResultadoSync = { enviados: 0, fotosEnviadas: 0, recebidos: 0, erros: [], cursor: null };
  const d = await abrir();
  const fila = await pendentes();

  // ---- 1. lote de registros ----
  const itens = fila.filter((i) => i.tipo !== "foto");
  if (itens.length) {
    onProgresso?.(`Enviando ${itens.length} registros…`);
    const lote = await montarLote(itens, deviceId);
    try {
      const resp = await api<{ armadilhas: Record<string, string>; ciclos: string[]; vistorias: Array<{ client_id: string; id: string }> }>(
        "/sync/push", { method: "POST", body: JSON.stringify(lote) },
      );
      // grava ids do servidor
      for (const [clientId, idServidor] of Object.entries(resp.armadilhas ?? {})) {
        await d.runAsync(`UPDATE armadilha SET id_servidor = ? WHERE id = ?`, [idServidor, clientId]);
      }
      const okVistorias = new Set((resp.vistorias ?? []).map((v) => v.client_id));
      if (okVistorias.size) {
        await d.runAsync(`UPDATE vistoria SET enviada = 1 WHERE id IN (${[...okVistorias].map(() => "?").join(",")})`, [...okVistorias]);
      }
      await concluirOutbox(itens.map((i) => i.seq));
      r.enviados = itens.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await marcarErroOutbox(itens.map((i) => i.seq), msg);
      r.erros.push(`Lote: ${msg}`);
      if (e instanceof ErroApi && e.status === 401) return r; // sem sessão, não adianta continuar
    }
  }

  // ---- 2. fotos (uma a uma, multipart) ----
  const fotos = fila.filter((i) => i.tipo === "foto");
  for (const [idx, item] of fotos.entries()) {
    onProgresso?.(`Enviando foto ${idx + 1} de ${fotos.length}…`);
    const foto = await d.getFirstAsync<Foto>(`SELECT * FROM foto WHERE id = ?`, [item.ref_id]);
    if (!foto) { await concluirOutbox([item.seq]); continue; }
    try {
      const form = new FormData();
      form.append("client_id", foto.id);
      if (foto.vistoria_id) form.append("vistoria_client_id", foto.vistoria_id);
      if (foto.armadilha_id) form.append("armadilha_client_id", foto.armadilha_id);
      form.append("tirada_em", foto.tirada_em);
      if (foto.lat !== null) form.append("lat", String(foto.lat));
      if (foto.lon !== null) form.append("lon", String(foto.lon));
      // React Native aceita {uri, name, type} como arquivo no FormData
      form.append("arquivo", { uri: foto.uri, name: `${foto.id}.jpg`, type: "image/jpeg" } as unknown as Blob);
      await api("/fotos", { method: "POST", body: form });
      await d.runAsync(`UPDATE foto SET enviada = 1 WHERE id = ?`, [foto.id]);
      await concluirOutbox([item.seq]);
      r.fotosEnviadas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await marcarErroOutbox([item.seq], msg);
      r.erros.push(`Foto ${foto.id.slice(0, 8)}: ${msg}`);
    }
  }

  // ---- 3. pull ----
  onProgresso?.("Baixando atualizações…");
  try {
    const since = await lerConfig("cursor_pull");
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    const p = await api<{
      cursor: string;
      organizacao: Record<string, unknown> | null;
      fazendas: Fazenda[];
      talhoes: Array<{ id: string; fazenda_id: string; nome: string; geom: unknown; area_ha: number | string | null }>;
      armadilhas: PullArmadilha[];
    }>(`/sync/pull${qs}`);
    await aplicarPull(p);
    r.recebidos = p.armadilhas.length + p.talhoes.length + p.fazendas.length;
    r.cursor = p.cursor;
    await gravarConfig("ultima_sync", new Date().toISOString());
  } catch (e) {
    r.erros.push(`Pull: ${e instanceof Error ? e.message : String(e)}`);
  }
  return r;
}

async function montarLote(itens: ItemOutbox[], deviceId: string) {
  const d = await abrir();
  const lote = { device_id: deviceId, armadilhas: [] as unknown[], ciclos: [] as unknown[], vistorias: [] as unknown[], trincheiras: [] as unknown[] };
  for (const it of itens) {
    if (it.tipo === "armadilha") {
      const a = await d.getFirstAsync<Armadilha>(`SELECT * FROM armadilha WHERE id = ?`, [it.ref_id]);
      if (!a) continue;
      lote.armadilhas.push({
        client_id: a.id, id_servidor: a.id_servidor, fazenda_id: a.fazenda_id, talhao_id: a.talhao_id, codigo: a.codigo, finalidade: a.finalidade,
        ponto: { lat: a.lat, lon: a.lon }, precisao_m: a.precisao_m, instalada_em: a.instalada_em, status: a.status, observacoes: a.observacoes,
      });
    } else if (it.tipo === "ciclo") {
      const c = await d.getFirstAsync<Ciclo>(`SELECT * FROM ciclo WHERE id = ?`, [it.ref_id]);
      if (!c) continue;
      const a = await d.getFirstAsync<{ id_servidor: string | null }>(`SELECT id_servidor FROM armadilha WHERE id = ?`, [c.armadilha_id]);
      lote.ciclos.push({ client_id: c.id, armadilha_client_id: c.armadilha_id, armadilha_id: a?.id_servidor ?? null, lote_septo: c.lote_septo, inicio: c.inicio, trocado_em: c.trocado_em });
    } else if (it.tipo === "trincheira") {
      const t = await d.getFirstAsync<Trincheira>(`SELECT * FROM trincheira WHERE id = ?`, [it.ref_id]);
      if (!t) continue;
      lote.trincheiras.push({
        client_id: t.id, talhao_id: t.talhao_id, realizada_em: t.realizada_em, larvas: t.larvas,
        ponto: t.lat !== null && t.lon !== null ? { lat: t.lat, lon: t.lon } : null, observacoes: t.observacoes,
      });
    } else if (it.tipo === "vistoria") {
      const v = await d.getFirstAsync<Vistoria>(`SELECT * FROM vistoria WHERE id = ?`, [it.ref_id]);
      if (!v) continue;
      const a = await d.getFirstAsync<{ id_servidor: string | null }>(`SELECT id_servidor FROM armadilha WHERE id = ?`, [v.armadilha_id]);
      lote.vistorias.push({
        client_id: v.id, armadilha_client_id: v.armadilha_id, armadilha_id: a?.id_servidor ?? null, realizada_em: v.realizada_em, adultos: v.adultos,
        ponto: v.lat !== null && v.lon !== null ? { lat: v.lat, lon: v.lon } : null, precisao_m: v.precisao_m,
        precisao_baixa: !!v.precisao_baixa, troca_septo: !!v.troca_septo, observacoes: v.observacoes,
      });
    }
  }
  return lote;
}
