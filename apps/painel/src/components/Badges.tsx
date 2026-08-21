import { ROTULO_FAIXA, ROTULO_NIVEL } from "@/lib/formatar";

const COR_FAIXA: Record<string, string> = {
  ok: "bg-marca-clara text-marca-escura",
  aviso: "bg-amber-100 text-amber-800",
  critico: "bg-red-100 text-red-800",
  sem_septo: "bg-gray-100 text-gray-600",
};

export function BadgeSepto({ faixa, dias }: { faixa: string; dias?: number | null }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_FAIXA[faixa] ?? COR_FAIXA.sem_septo}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROTULO_FAIXA[faixa] ?? faixa}
      {dias !== null && dias !== undefined && faixa !== "sem_septo" && <span className="opacity-70">· {dias} d</span>}
    </span>
  );
}

const COR_NIVEL: Record<string, string> = {
  baixo: "bg-marca-clara text-marca-escura",
  medio: "bg-amber-100 text-amber-800",
  alto: "bg-red-100 text-red-800",
};

export function BadgeNivel({ nivel }: { nivel: string | null }) {
  if (!nivel) return <span className="text-texto-suave text-xs">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_NIVEL[nivel] ?? ""}`}>{ROTULO_NIVEL[nivel] ?? nivel}</span>
  );
}
