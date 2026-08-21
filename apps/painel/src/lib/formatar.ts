export function dataHora(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function data(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function numero(v: number | string | null | undefined, casas = 0): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export const ROTULO_FAIXA: Record<string, string> = {
  ok: "Em dia",
  aviso: "Trocar em breve",
  critico: "Septo vencido",
  sem_septo: "Sem septo",
};

export const ROTULO_NIVEL: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const ROTULO_PAPEL: Record<string, string> = {
  pragueiro: "Pragueiro",
  agronomo: "Agrônomo",
  gestor: "Gestor",
  admin: "Administrador",
};
