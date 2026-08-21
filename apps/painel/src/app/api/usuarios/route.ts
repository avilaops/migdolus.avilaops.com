import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, json, lerCorpo, ApiError } from "@/lib/api";
import { query } from "@/lib/db";
import { hashSenha } from "@/lib/auth";

export const GET = comSessao(async (_req: NextRequest, { sessao }) => {
  const rows = await query(
    `SELECT id, nome, email, telefone, papel, ativo, criado_em FROM usuario WHERE organizacao_id = $1 ORDER BY nome`,
    [sessao.organizacaoId],
  );
  return json(rows);
}, ["admin", "gestor"]);

const Schema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  telefone: z.string().max(30).optional(),
  papel: z.enum(["pragueiro", "agronomo", "gestor", "admin"]),
  senha: z.string().min(8).max(120),
});

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Schema);
  if (d.papel === "admin" && sessao.papel !== "admin") throw new ApiError(403, "Só admin cria admin");
  const senha_hash = await hashSenha(d.senha);
  try {
    const [row] = await query(
      `INSERT INTO usuario (organizacao_id, nome, email, telefone, papel, senha_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, papel`,
      [sessao.organizacaoId, d.nome, d.email.toLowerCase(), d.telefone ?? null, d.papel, senha_hash],
    );
    return json(row, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ApiError(409, "E-mail já cadastrado");
    throw e;
  }
}, ["admin", "gestor"]);

const Patch = z.object({
  id: z.string().uuid(),
  ativo: z.boolean().optional(),
  papel: z.enum(["pragueiro", "agronomo", "gestor", "admin"]).optional(),
  senha: z.string().min(8).max(120).optional(),
});

export const PATCH = comSessao(async (req: NextRequest, { sessao }) => {
  const d = await lerCorpo(req, Patch);
  if (d.id === sessao.usuarioId && d.ativo === false) throw new ApiError(400, "Você não pode desativar a si mesmo");
  const senha_hash = d.senha ? await hashSenha(d.senha) : null;
  const rows = await query(
    `UPDATE usuario SET ativo = COALESCE($3, ativo), papel = COALESCE($4, papel), senha_hash = COALESCE($5, senha_hash)
      WHERE id = $1 AND organizacao_id = $2 RETURNING id, nome, papel, ativo`,
    [d.id, sessao.organizacaoId, d.ativo ?? null, d.papel ?? null, senha_hash],
  );
  if (!rows.length) throw new ApiError(404, "Usuário não encontrado");
  return json(rows[0]);
}, ["admin", "gestor"]);
