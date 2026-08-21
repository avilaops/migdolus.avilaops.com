import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { sessaoDaRequisicao, type Sessao, type Papel } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function erro(status: number, mensagem: string, detalhes?: unknown) {
  return NextResponse.json({ erro: mensagem, detalhes }, { status });
}

type Handler<C> = (req: NextRequest, ctx: C & { sessao: Sessao }) => Promise<Response>;

/**
 * Envolve um handler exigindo sessão válida (Bearer do app ou cookie do painel).
 * Converte ApiError/ZodError em respostas JSON com status adequado.
 */
export function comSessao<C extends object = object>(handler: Handler<C>, papeis?: Papel[]) {
  return async (req: NextRequest, ctx?: C): Promise<Response> => {
    try {
      const sessao = await sessaoDaRequisicao(req);
      if (!sessao) return erro(401, "Não autenticado");
      if (papeis && !papeis.includes(sessao.papel)) return erro(403, "Sem permissão");
      return await handler(req, { ...(ctx as C), sessao });
    } catch (e) {
      return tratarErro(e);
    }
  };
}

export function semSessao<C extends object = object>(handler: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx?: C): Promise<Response> => {
    try {
      return await handler(req, ctx as C);
    } catch (e) {
      return tratarErro(e);
    }
  };
}

function tratarErro(e: unknown): Response {
  if (e instanceof ApiError) return erro(e.status, e.message, e.detalhes);
  if (e instanceof ZodError) return erro(400, "Dados inválidos", e.issues);
  console.error("[api]", e);
  return erro(500, "Erro interno");
}

export async function lerCorpo<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    throw new ApiError(400, "Corpo JSON inválido");
  }
  return schema.parse(corpo);
}

export function param(req: NextRequest, nome: string): string | null {
  return req.nextUrl.searchParams.get(nome);
}
