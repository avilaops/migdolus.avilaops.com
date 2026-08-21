import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

// Cliente HTTP do app: Bearer + refresh automático.

const CHAVE_TOKEN = "migdolus_token";
const CHAVE_REFRESH = "migdolus_refresh";

export interface Usuario { id: string; nome: string; email: string; papel: string }

export async function guardarTokens(token: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_TOKEN, token);
  await SecureStore.setItemAsync(CHAVE_REFRESH, refresh);
}
export async function limparTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  await SecureStore.deleteItemAsync(CHAVE_REFRESH);
}
export async function temSessao(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(CHAVE_REFRESH));
}

export class ErroApi extends Error {
  constructor(public status: number, message: string, public detalhes?: unknown) {
    super(message);
  }
}

async function renovar(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(CHAVE_REFRESH);
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    if (res.status === 401) await limparTokens();
    return null;
  }
  const d = (await res.json()) as { token: string; refresh_token: string };
  await guardarTokens(d.token, d.refresh_token);
  return d.token;
}

export async function api<T = unknown>(caminho: string, init: RequestInit = {}, tentarRenovar = true): Promise<T> {
  const token = await SecureStore.getItemAsync(CHAVE_TOKEN);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}${caminho}`, { ...init, headers });
  if (res.status === 401 && tentarRenovar) {
    const novo = await renovar();
    if (novo) return api<T>(caminho, init, false);
  }
  const texto = await res.text();
  const corpo = texto ? safeJson(texto) : null;
  if (!res.ok) {
    const msg = (corpo as { erro?: string } | null)?.erro || `Erro ${res.status}`;
    throw new ErroApi(res.status, msg, (corpo as { detalhes?: unknown } | null)?.detalhes);
  }
  return corpo as T;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return t; }
}

export async function login(email: string, senha: string, deviceId: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha, device_id: deviceId }),
  });
  const d = (await res.json().catch(() => ({}))) as { token?: string; refresh_token?: string; usuario?: Usuario; erro?: string; organizacao?: unknown };
  if (!res.ok || !d.token || !d.refresh_token) throw new ErroApi(res.status, d.erro || "Não foi possível entrar");
  await guardarTokens(d.token, d.refresh_token);
  return d as { token: string; refresh_token: string; usuario: Usuario; organizacao: unknown };
}
