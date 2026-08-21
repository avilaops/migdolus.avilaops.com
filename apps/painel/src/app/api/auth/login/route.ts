import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { semSessao, lerCorpo, ApiError } from "@/lib/api";
import { assinarToken, conferirSenha, usuarioPorEmail, COOKIE_NAME, type Sessao } from "@/lib/auth";
import { one } from "@/lib/db";

const Schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  // O app de campo manda device_id para registrar o aparelho no log de sync.
  device_id: z.string().optional(),
});

export const POST = semSessao(async (req: NextRequest) => {
  const { email, senha } = await lerCorpo(req, Schema);
  const u = await usuarioPorEmail(email);
  if (!u || !u.ativo || !(await conferirSenha(senha, u.senha_hash))) {
    throw new ApiError(401, "E-mail ou senha incorretos");
  }
  const sessao: Sessao = { usuarioId: u.id, organizacaoId: u.organizacao_id, nome: u.nome, papel: u.papel };
  const [token, refresh, cookieToken] = await Promise.all([
    assinarToken(sessao, "acesso"),
    assinarToken(sessao, "refresh"),
    // Painel web: token de acesso longo guardado em cookie httpOnly.
    assinarToken(sessao, "acesso", process.env.REFRESH_TTL || "30d"),
  ]);
  const org = await one<{ id: string; nome: string; dias_septo: number; dias_septo_aviso: number; espacamento_malha_m: string; faixa_media_min: number; faixa_alta_min: number }>(
    `SELECT id, nome, dias_septo, dias_septo_aviso, espacamento_malha_m, faixa_media_min, faixa_alta_min FROM organizacao WHERE id = $1`,
    [u.organizacao_id],
  );

  const res = NextResponse.json({
    token,
    refresh_token: refresh,
    usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel },
    organizacao: org,
  });
  // Cookie para o painel web; o app ignora e usa o Bearer.
  res.cookies.set(COOKIE_NAME, cookieToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
});
