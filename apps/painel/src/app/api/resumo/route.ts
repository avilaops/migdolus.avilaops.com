import type { NextRequest } from "next/server";
import { comSessao, json } from "@/lib/api";
import { resumoDaOrganizacao } from "@/lib/consultas";

export const GET = comSessao(async (_req: NextRequest, { sessao }) => {
  return json(await resumoDaOrganizacao(sessao.organizacaoId));
});
