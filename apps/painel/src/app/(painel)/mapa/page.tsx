import type { Metadata } from "next";
import { sessaoAtual } from "@/lib/auth";
import { fazendasDaOrganizacao } from "@/lib/consultas";
import { MapaClient } from "@/components/MapaClient";

export const metadata: Metadata = { title: "Mapa de calor" };

export default async function MapaPage() {
  const sessao = (await sessaoAtual())!;
  const fazendas = await fazendasDaOrganizacao(sessao.organizacaoId);
  return (
    <div className="space-y-4 h-full flex flex-col">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mapa de calor</h1>
        <p className="text-sm text-texto-suave mt-1">
          Pontos coloridos pelo nível de infestação; o calor é ponderado pelos adultos capturados no período.
        </p>
      </header>
      <MapaClient fazendas={fazendas.map((f) => ({ id: f.id, nome: f.nome }))} />
    </div>
  );
}
