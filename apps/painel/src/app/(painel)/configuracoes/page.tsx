import type { Metadata } from "next";
import { sessaoAtual } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { ConfiguracoesClient, type Organizacao, type Usuario } from "@/components/ConfiguracoesClient";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const sessao = (await sessaoAtual())!;
  const podeGerir = ["admin", "gestor"].includes(sessao.papel);
  const [org, usuarios] = await Promise.all([
    one<Organizacao>(
      `SELECT id, nome, tipo, plano, dias_septo, dias_septo_aviso, espacamento_malha_m::float AS espacamento_malha_m, faixa_media_min, faixa_alta_min FROM organizacao WHERE id = $1`,
      [sessao.organizacaoId],
    ),
    podeGerir
      ? query<Usuario>(`SELECT id, nome, email, telefone, papel, ativo, criado_em FROM usuario WHERE organizacao_id = $1 ORDER BY nome`, [sessao.organizacaoId])
      : Promise.resolve([] as Usuario[]),
  ]);
  return <ConfiguracoesClient org={org!} usuarios={usuarios} podeGerir={podeGerir} meuId={sessao.usuarioId} />;
}
