import type { NextRequest } from "next/server";
import { comSessao, json, param } from "@/lib/api";
import { armadilhasComStatus } from "@/lib/consultas";

// Lista paginada de armadilhas com status de septo (v_armadilha_status).
// Parâmetros: fazenda, faixa (ok|aviso|critico|sem_septo), busca, pagina, por_pagina (máx. 200).
export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const resultado = await armadilhasComStatus(sessao.organizacaoId, {
    fazenda: param(req, "fazenda"),
    faixa: param(req, "faixa"),
    busca: param(req, "busca"),
    pagina: Number(param(req, "pagina") ?? 1) || 1,
    porPagina: Number(param(req, "por_pagina") ?? 50) || 50,
  });
  return json(resultado);
});
