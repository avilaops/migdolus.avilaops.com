import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";

// Banco local do aparelho. Tudo que o pragueiro faz entra aqui primeiro;
// a fila `outbox` leva para o servidor quando houver rede.

export type StatusArmadilha = "planejada" | "ativa" | "removida" | "perdida";
export type Finalidade = "monitoramento" | "coleta_massal";

export interface Armadilha {
  id: string;              // client_id (uuid) — chave local
  id_servidor: string | null;
  fazenda_id: string;
  talhao_id: string | null;
  codigo: string;
  finalidade: Finalidade;
  lat: number;
  lon: number;
  precisao_m: number | null;
  instalada_em: string;
  status: StatusArmadilha;
  observacoes: string | null;
  septo_inicio: string | null;     // derivado do último ciclo aberto
  ultima_vistoria_em: string | null;
  ultima_contagem: number | null;
  atualizado_em: string;
}

export interface Ciclo {
  id: string;                // client_id
  armadilha_id: string;      // id local da armadilha
  lote_septo: string | null;
  inicio: string;
  trocado_em: string | null;
}

export interface Vistoria {
  id: string;                // client_id
  armadilha_id: string;      // id local
  realizada_em: string;
  adultos: number;
  lat: number | null;
  lon: number | null;
  precisao_m: number | null;
  precisao_baixa: number;
  troca_septo: number;
  observacoes: string | null;
  enviada: number;
}

export interface Foto {
  id: string;                // client_id
  vistoria_id: string | null;
  armadilha_id: string | null;
  uri: string;               // arquivo local
  tirada_em: string;
  lat: number | null;
  lon: number | null;
  enviada: number;
}

export interface Fazenda { id: string; nome: string }
export interface Talhao { id: string; fazenda_id: string; nome: string; geom: string | null; area_ha: number | null }

export interface Parametros {
  dias_septo: number;
  dias_septo_aviso: number;
  faixa_media_min: number;
  faixa_alta_min: number;
  espacamento_malha_m: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function abrir(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("migdolus.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
    CREATE TABLE IF NOT EXISTS fazenda (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS talhao (id TEXT PRIMARY KEY, fazenda_id TEXT NOT NULL, nome TEXT NOT NULL, geom TEXT, area_ha REAL);
    CREATE TABLE IF NOT EXISTS armadilha (
      id TEXT PRIMARY KEY, id_servidor TEXT, fazenda_id TEXT NOT NULL, talhao_id TEXT, codigo TEXT NOT NULL,
      finalidade TEXT NOT NULL DEFAULT 'monitoramento', lat REAL NOT NULL, lon REAL NOT NULL, precisao_m REAL,
      instalada_em TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ativa', observacoes TEXT,
      septo_inicio TEXT, ultima_vistoria_em TEXT, ultima_contagem INTEGER, atualizado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS armadilha_servidor ON armadilha (id_servidor);
    CREATE TABLE IF NOT EXISTS ciclo (id TEXT PRIMARY KEY, armadilha_id TEXT NOT NULL, lote_septo TEXT, inicio TEXT NOT NULL, trocado_em TEXT);
    CREATE TABLE IF NOT EXISTS vistoria (
      id TEXT PRIMARY KEY, armadilha_id TEXT NOT NULL, realizada_em TEXT NOT NULL, adultos INTEGER NOT NULL,
      lat REAL, lon REAL, precisao_m REAL, precisao_baixa INTEGER NOT NULL DEFAULT 0, troca_septo INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT, enviada INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS foto (
      id TEXT PRIMARY KEY, vistoria_id TEXT, armadilha_id TEXT, uri TEXT NOT NULL, tirada_em TEXT NOT NULL,
      lat REAL, lon REAL, enviada INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, ref_id TEXT NOT NULL, criado_em TEXT NOT NULL,
      tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT
    );
  `);
  return db;
}

export function uuid(): string {
  return Crypto.randomUUID();
}

export const agora = () => new Date().toISOString();

// ---- config ----
export async function lerConfig(chave: string): Promise<string | null> {
  const d = await abrir();
  const r = await d.getFirstAsync<{ valor: string }>(`SELECT valor FROM config WHERE chave = ?`, [chave]);
  return r?.valor ?? null;
}
export async function gravarConfig(chave: string, valor: string | null): Promise<void> {
  const d = await abrir();
  if (valor === null) await d.runAsync(`DELETE FROM config WHERE chave = ?`, [chave]);
  else await d.runAsync(`INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`, [chave, valor]);
}
export async function parametros(): Promise<Parametros> {
  const raw = await lerConfig("parametros");
  const p = raw ? (JSON.parse(raw) as Partial<Parametros>) : {};
  return {
    dias_septo: Number(p.dias_septo ?? 30),
    dias_septo_aviso: Number(p.dias_septo_aviso ?? 20),
    faixa_media_min: Number(p.faixa_media_min ?? 20),
    faixa_alta_min: Number(p.faixa_alta_min ?? 100),
    espacamento_malha_m: Number(p.espacamento_malha_m ?? 30),
  };
}

// ---- fazendas / talhões ----
export async function listarFazendas(): Promise<Fazenda[]> {
  const d = await abrir();
  return d.getAllAsync<Fazenda>(`SELECT id, nome FROM fazenda ORDER BY nome`);
}
export async function listarTalhoes(fazendaId?: string): Promise<Talhao[]> {
  const d = await abrir();
  return fazendaId
    ? d.getAllAsync<Talhao>(`SELECT * FROM talhao WHERE fazenda_id = ? ORDER BY nome`, [fazendaId])
    : d.getAllAsync<Talhao>(`SELECT * FROM talhao ORDER BY nome`);
}

// ---- armadilhas ----
export async function listarArmadilhas(): Promise<Armadilha[]> {
  const d = await abrir();
  return d.getAllAsync<Armadilha>(`SELECT * FROM armadilha WHERE status IN ('ativa','planejada') ORDER BY codigo`);
}
export async function buscarArmadilha(id: string): Promise<Armadilha | null> {
  const d = await abrir();
  return d.getFirstAsync<Armadilha>(`SELECT * FROM armadilha WHERE id = ? OR id_servidor = ?`, [id, id]);
}

export interface NovaArmadilha {
  fazenda_id: string; talhao_id: string | null; codigo: string; finalidade: Finalidade;
  lat: number; lon: number; precisao_m: number | null; observacoes: string | null; lote_septo: string | null;
  planejada_id?: string | null; // id local de uma armadilha planejada sendo confirmada
}

/** Instala uma armadilha: cria (ou confirma a planejada), abre o 1º ciclo de septo e enfileira. */
export async function instalarArmadilha(n: NovaArmadilha): Promise<Armadilha> {
  const d = await abrir();
  const ts = agora();
  let id = n.planejada_id ?? null;
  if (id) {
    await d.runAsync(
      `UPDATE armadilha SET lat = ?, lon = ?, precisao_m = ?, instalada_em = ?, status = 'ativa', observacoes = ?, finalidade = ?, codigo = ?, septo_inicio = ?, atualizado_em = ? WHERE id = ?`,
      [n.lat, n.lon, n.precisao_m, ts, n.observacoes, n.finalidade, n.codigo, ts, ts, id],
    );
  } else {
    id = uuid();
    await d.runAsync(
      `INSERT INTO armadilha (id, id_servidor, fazenda_id, talhao_id, codigo, finalidade, lat, lon, precisao_m, instalada_em, status, observacoes, septo_inicio, atualizado_em)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', ?, ?, ?)`,
      [id, n.fazenda_id, n.talhao_id, n.codigo, n.finalidade, n.lat, n.lon, n.precisao_m, ts, n.observacoes, ts, ts],
    );
  }
  const cicloId = uuid();
  await d.runAsync(`INSERT INTO ciclo (id, armadilha_id, lote_septo, inicio, trocado_em) VALUES (?, ?, ?, ?, NULL)`, [cicloId, id, n.lote_septo, ts]);
  await d.runAsync(`INSERT INTO outbox (tipo, ref_id, criado_em) VALUES ('armadilha', ?, ?), ('ciclo', ?, ?)`, [id, ts, cicloId, ts]);
  return (await buscarArmadilha(id))!;
}

export interface NovaVistoria {
  armadilha_id: string; adultos: number; lat: number | null; lon: number | null; precisao_m: number | null;
  precisao_baixa: boolean; troca_septo: boolean; lote_septo: string | null; observacoes: string | null;
}

export async function registrarVistoria(v: NovaVistoria): Promise<Vistoria> {
  const d = await abrir();
  const ts = agora();
  const id = uuid();
  await d.runAsync(
    `INSERT INTO vistoria (id, armadilha_id, realizada_em, adultos, lat, lon, precisao_m, precisao_baixa, troca_septo, observacoes, enviada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, v.armadilha_id, ts, v.adultos, v.lat, v.lon, v.precisao_m, v.precisao_baixa ? 1 : 0, v.troca_septo ? 1 : 0, v.observacoes],
  );
  await d.runAsync(`UPDATE armadilha SET ultima_vistoria_em = ?, ultima_contagem = ?, atualizado_em = ? WHERE id = ?`, [ts, v.adultos, ts, v.armadilha_id]);
  await d.runAsync(`INSERT INTO outbox (tipo, ref_id, criado_em) VALUES ('vistoria', ?, ?)`, [id, ts]);
  if (v.troca_septo) {
    await d.runAsync(`UPDATE ciclo SET trocado_em = ? WHERE armadilha_id = ? AND trocado_em IS NULL`, [ts, v.armadilha_id]);
    const cicloId = uuid();
    await d.runAsync(`INSERT INTO ciclo (id, armadilha_id, lote_septo, inicio, trocado_em) VALUES (?, ?, ?, ?, NULL)`, [cicloId, v.armadilha_id, v.lote_septo, ts]);
    await d.runAsync(`UPDATE armadilha SET septo_inicio = ? WHERE id = ?`, [ts, v.armadilha_id]);
    await d.runAsync(`INSERT INTO outbox (tipo, ref_id, criado_em) VALUES ('ciclo', ?, ?)`, [cicloId, ts]);
  }
  return (await d.getFirstAsync<Vistoria>(`SELECT * FROM vistoria WHERE id = ?`, [id]))!;
}

export async function registrarFoto(f: Omit<Foto, "enviada">): Promise<void> {
  const d = await abrir();
  await d.runAsync(
    `INSERT INTO foto (id, vistoria_id, armadilha_id, uri, tirada_em, lat, lon, enviada) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [f.id, f.vistoria_id, f.armadilha_id, f.uri, f.tirada_em, f.lat, f.lon],
  );
  await d.runAsync(`INSERT INTO outbox (tipo, ref_id, criado_em) VALUES ('foto', ?, ?)`, [f.id, agora()]);
}

export async function vistoriasDaArmadilha(armadilhaId: string, limite = 20): Promise<Vistoria[]> {
  const d = await abrir();
  return d.getAllAsync<Vistoria>(`SELECT * FROM vistoria WHERE armadilha_id = ? ORDER BY realizada_em DESC LIMIT ?`, [armadilhaId, limite]);
}

export async function fotosDaArmadilha(armadilhaId: string): Promise<Foto[]> {
  const d = await abrir();
  return d.getAllAsync<Foto>(`SELECT * FROM foto WHERE armadilha_id = ? ORDER BY tirada_em DESC LIMIT 30`, [armadilhaId]);
}

// ---- outbox ----
export interface ItemOutbox { seq: number; tipo: "armadilha" | "ciclo" | "vistoria" | "foto"; ref_id: string; criado_em: string; tentativas: number; erro: string | null }
export async function pendentes(): Promise<ItemOutbox[]> {
  const d = await abrir();
  return d.getAllAsync<ItemOutbox>(`SELECT * FROM outbox ORDER BY seq`);
}
export async function contarPendentes(): Promise<{ total: number; fotos: number }> {
  const d = await abrir();
  const r = await d.getFirstAsync<{ total: number; fotos: number }>(`SELECT count(*) AS total, sum(CASE WHEN tipo = 'foto' THEN 1 ELSE 0 END) AS fotos FROM outbox`);
  return { total: r?.total ?? 0, fotos: r?.fotos ?? 0 };
}
export async function concluirOutbox(seqs: number[]): Promise<void> {
  if (!seqs.length) return;
  const d = await abrir();
  await d.runAsync(`DELETE FROM outbox WHERE seq IN (${seqs.map(() => "?").join(",")})`, seqs);
}
export async function marcarErroOutbox(seqs: number[], erro: string): Promise<void> {
  if (!seqs.length) return;
  const d = await abrir();
  await d.runAsync(`UPDATE outbox SET tentativas = tentativas + 1, erro = ? WHERE seq IN (${seqs.map(() => "?").join(",")})`, [erro, ...seqs]);
}

// ---- pull: aplica dados do servidor ----
export interface PullArmadilha {
  id: string; client_id: string | null; fazenda_id: string; talhao_id: string | null; codigo: string; finalidade: Finalidade; status: StatusArmadilha;
  lat: number; lon: number; precisao_m: number | null; instalada_em: string; observacoes: string | null; atualizado_em: string;
  septo_inicio: string | null; ultima_vistoria_em: string | null; ultima_contagem: number | null;
}
export async function aplicarPull(p: {
  organizacao?: Partial<Parametros> | null;
  fazendas: Fazenda[];
  talhoes: Array<{ id: string; fazenda_id: string; nome: string; geom: unknown; area_ha: number | string | null }>;
  armadilhas: PullArmadilha[];
  cursor: string;
}): Promise<void> {
  const d = await abrir();
  await d.withTransactionAsync(async () => {
    if (p.organizacao) await gravarConfig("parametros", JSON.stringify(p.organizacao));
    for (const f of p.fazendas) await d.runAsync(`INSERT INTO fazenda (id, nome) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET nome = excluded.nome`, [f.id, f.nome]);
    for (const t of p.talhoes) {
      await d.runAsync(
        `INSERT INTO talhao (id, fazenda_id, nome, geom, area_ha) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET fazenda_id = excluded.fazenda_id, nome = excluded.nome, geom = excluded.geom, area_ha = excluded.area_ha`,
        [t.id, t.fazenda_id, t.nome, t.geom ? JSON.stringify(t.geom) : null, t.area_ha === null ? null : Number(t.area_ha)],
      );
    }
    for (const a of p.armadilhas) {
      // Já existe localmente? (por client_id ou por id_servidor)
      const local = await d.getFirstAsync<{ id: string }>(`SELECT id FROM armadilha WHERE id = ? OR id_servidor = ?`, [a.client_id ?? "", a.id]);
      const pendente = local ? await d.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM outbox WHERE tipo = 'armadilha' AND ref_id = ?`, [local.id]) : null;
      if (local && pendente && pendente.n > 0) continue; // alteração local ainda não enviada vence
      if (a.status === "removida") {
        if (local) await d.runAsync(`UPDATE armadilha SET status = 'removida', atualizado_em = ? WHERE id = ?`, [a.atualizado_em, local.id]);
        continue;
      }
      const id = local?.id ?? a.client_id ?? a.id;
      await d.runAsync(
        `INSERT INTO armadilha (id, id_servidor, fazenda_id, talhao_id, codigo, finalidade, lat, lon, precisao_m, instalada_em, status, observacoes, septo_inicio, ultima_vistoria_em, ultima_contagem, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET id_servidor = excluded.id_servidor, fazenda_id = excluded.fazenda_id, talhao_id = excluded.talhao_id, codigo = excluded.codigo,
           finalidade = excluded.finalidade, lat = excluded.lat, lon = excluded.lon, precisao_m = excluded.precisao_m, instalada_em = excluded.instalada_em,
           status = excluded.status, observacoes = excluded.observacoes, septo_inicio = excluded.septo_inicio,
           ultima_vistoria_em = COALESCE(excluded.ultima_vistoria_em, armadilha.ultima_vistoria_em),
           ultima_contagem = COALESCE(excluded.ultima_contagem, armadilha.ultima_contagem), atualizado_em = excluded.atualizado_em`,
        [id, a.id, a.fazenda_id, a.talhao_id, a.codigo, a.finalidade, a.lat, a.lon, a.precisao_m, a.instalada_em, a.status, a.observacoes, a.septo_inicio, a.ultima_vistoria_em, a.ultima_contagem, a.atualizado_em],
      );
    }
    await gravarConfig("cursor_pull", p.cursor);
  });
}

export async function limparTudo(): Promise<void> {
  const d = await abrir();
  await d.execAsync(`DELETE FROM outbox; DELETE FROM foto; DELETE FROM vistoria; DELETE FROM ciclo; DELETE FROM armadilha; DELETE FROM talhao; DELETE FROM fazenda; DELETE FROM config;`);
}
