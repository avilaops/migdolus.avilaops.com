import type { Metadata } from "next";
import { sessaoAtual } from "@/lib/auth";
import { fazendasDaOrganizacao } from "@/lib/consultas";
import { RelatoriosClient } from "@/components/RelatoriosClient";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  const sessao = (await sessaoAtual())!;
  const fazendas = await fazendasDaOrganizacao(sessao.organizacaoId);
  return <RelatoriosClient fazendas={fazendas.map((f) => ({ id: f.id, nome: f.nome, armadilhas: f.armadilhas_ativas }))} />;
}
