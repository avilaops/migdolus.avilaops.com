import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { one } from "./db";

export const COOKIE_NAME = "migdolus_sessao";

export type Papel = "pragueiro" | "agronomo" | "gestor" | "admin";

export interface Sessao {
  usuarioId: string;
  organizacaoId: string;
  nome: string;
  papel: Papel;
}

interface TokenPayload extends JWTPayload {
  sub: string; // usuario id
  org: string;
  nome: string;
  papel: Papel;
  tipo: "acesso" | "refresh";
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET não definido");
  return new TextEncoder().encode(s);
}

export async function assinarToken(sessao: Sessao, tipo: "acesso" | "refresh", ttlOverride?: string): Promise<string> {
  const ttl = ttlOverride ?? (tipo === "acesso" ? process.env.JWT_TTL || "15m" : process.env.REFRESH_TTL || "30d");
  return new SignJWT({ org: sessao.organizacaoId, nome: sessao.nome, papel: sessao.papel, tipo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sessao.usuarioId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

export async function verificarToken(token: string, tipoEsperado: "acesso" | "refresh" = "acesso"): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify<TokenPayload>(token, secret());
    if (payload.tipo !== tipoEsperado || !payload.sub) return null;
    return { usuarioId: payload.sub, organizacaoId: payload.org, nome: payload.nome, papel: payload.papel };
  } catch {
    return null;
  }
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(senha, hash);
}

/** Sessão de uma requisição de API: aceita Bearer (app) ou cookie (painel). */
export async function sessaoDaRequisicao(req: NextRequest): Promise<Sessao | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return verificarToken(auth.slice(7));
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) return verificarToken(cookie);
  return null;
}

/** Sessão em Server Components / páginas (só cookie). */
export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verificarToken(token);
}

export async function usuarioPorEmail(email: string) {
  return one<{
    id: string;
    organizacao_id: string;
    nome: string;
    email: string;
    papel: Papel;
    senha_hash: string | null;
    ativo: boolean;
  }>(`SELECT id, organizacao_id, nome, email, papel, senha_hash, ativo FROM usuario WHERE lower(email) = lower($1)`, [email]);
}
