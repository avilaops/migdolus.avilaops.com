import { z } from "zod";
import type { NextRequest } from "next/server";
import { semSessao, lerCorpo, ApiError, json } from "@/lib/api";
import { assinarToken, verificarToken } from "@/lib/auth";
import { one } from "@/lib/db";

const Schema = z.object({ refresh_token: z.string().min(10) });

export const POST = semSessao(async (req: NextRequest) => {
  const { refresh_token } = await lerCorpo(req, Schema);
  const sessao = await verificarToken(refresh_token, "refresh");
  if (!sessao) throw new ApiError(401, "Refresh token inválido ou expirado");
  const ativo = await one<{ ativo: boolean }>(`SELECT ativo FROM usuario WHERE id = $1`, [sessao.usuarioId]);
  if (!ativo?.ativo) throw new ApiError(401, "Usuário desativado");
  const [token, refresh] = await Promise.all([assinarToken(sessao, "acesso"), assinarToken(sessao, "refresh")]);
  return json({ token, refresh_token: refresh });
});
