import { z } from "zod";
import type { NextRequest } from "next/server";
import { semSessao, lerCorpo, ApiError, json } from "@/lib/api";
import { hashSenha } from "@/lib/auth";
import { one, transaction } from "@/lib/db";

// Primeiro acesso: cria a organização e o usuário admin.
// Só funciona enquanto não existir nenhum usuário e exige SETUP_TOKEN do ambiente.
const Schema = z.object({
  setup_token: z.string().min(8),
  organizacao: z.string().min(2),
  tipo: z.enum(["usina", "consultoria", "fazenda"]).default("consultoria"),
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(8),
});

export const POST = semSessao(async (req: NextRequest) => {
  const dados = await lerCorpo(req, Schema);
  const esperado = process.env.SETUP_TOKEN;
  if (!esperado || dados.setup_token !== esperado) throw new ApiError(403, "Token de setup inválido");
  const existente = await one<{ n: string }>(`SELECT count(*)::text AS n FROM usuario`);
  if (existente && Number(existente.n) > 0) throw new ApiError(409, "Setup já realizado");

  const senha_hash = await hashSenha(dados.senha);
  const resultado = await transaction(async (q) => {
    const [org] = await q<{ id: string }>(
      `INSERT INTO organizacao (nome, tipo, plano) VALUES ($1, $2, 'usina') RETURNING id`,
      [dados.organizacao, dados.tipo],
    );
    const [u] = await q<{ id: string }>(
      `INSERT INTO usuario (organizacao_id, nome, email, papel, senha_hash) VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
      [org.id, dados.nome, dados.email, senha_hash],
    );
    return { organizacao_id: org.id, usuario_id: u.id };
  });
  return json({ ok: true, ...resultado });
});
