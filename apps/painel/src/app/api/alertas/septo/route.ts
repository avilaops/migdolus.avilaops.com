import type { NextRequest } from "next/server";
import { json, erro } from "@/lib/api";
import { query } from "@/lib/db";

// Varredura diária de septos (chamada pelo n8n com o token ALERTAS_TOKEN).
// Devolve, por organização, as armadilhas em aviso/crítico e os contatos
// (gestores/agrônomos com telefone ou e-mail) para o n8n disparar WhatsApp/e-mail.
// Não dispara nada sozinho: o envio é responsabilidade do fluxo n8n/alerta-septo.json.
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-alertas-token") ?? req.nextUrl.searchParams.get("token");
  const esperado = process.env.ALERTAS_TOKEN;
  if (!esperado || token !== esperado) return erro(401, "Token de alertas inválido");

  const linhas = await query<{
    organizacao_id: string; organizacao: string; fazenda: string; codigo: string; talhao: string | null;
    faixa_septo: string; dias_septo: number | null; septo_fim_previsto: string | null; lat: number; lon: number;
  }>(
    `SELECT o.id AS organizacao_id, o.nome AS organizacao, f.nome AS fazenda, s.codigo, t.nome AS talhao,
            s.faixa_septo, s.dias_septo, s.septo_fim_previsto, ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon
       FROM v_armadilha_status s
       JOIN fazenda f ON f.id = s.fazenda_id
       JOIN organizacao o ON o.id = f.organizacao_id
       LEFT JOIN talhao t ON t.id = s.talhao_id
      WHERE s.status = 'ativa' AND s.faixa_septo IN ('aviso', 'critico')
      ORDER BY o.nome, CASE s.faixa_septo WHEN 'critico' THEN 0 ELSE 1 END, f.nome, s.codigo`,
  );
  const contatos = await query<{ organizacao_id: string; nome: string; email: string | null; telefone: string | null; papel: string }>(
    `SELECT organizacao_id, nome, email, telefone, papel FROM usuario WHERE ativo AND papel IN ('gestor','agronomo','admin')`,
  );

  const porOrg = new Map<string, { organizacao: string; criticas: typeof linhas; avisos: typeof linhas; contatos: typeof contatos }>();
  for (const l of linhas) {
    const g = porOrg.get(l.organizacao_id) ?? { organizacao: l.organizacao, criticas: [], avisos: [], contatos: contatos.filter((c) => c.organizacao_id === l.organizacao_id) };
    (l.faixa_septo === "critico" ? g.criticas : g.avisos).push(l);
    porOrg.set(l.organizacao_id, g);
  }

  const alertas = [...porOrg.entries()].map(([organizacao_id, g]) => ({
    organizacao_id,
    organizacao: g.organizacao,
    total_criticas: g.criticas.length,
    total_avisos: g.avisos.length,
    criticas: g.criticas,
    avisos: g.avisos,
    contatos: g.contatos,
    // Mensagem pronta para WhatsApp/e-mail — o n8n só encaminha.
    mensagem:
      `🪤 Migdolus Monitor — ${g.organizacao}\n` +
      (g.criticas.length ? `\n🔴 Septo VENCIDO (${g.criticas.length}):\n` + g.criticas.slice(0, 15).map((a) => `• ${a.codigo} — ${a.fazenda}${a.talhao ? "/" + a.talhao : ""} (${a.dias_septo} d)`).join("\n") + (g.criticas.length > 15 ? `\n…e mais ${g.criticas.length - 15}` : "") : "") +
      (g.avisos.length ? `\n\n🟡 Trocar em breve (${g.avisos.length}):\n` + g.avisos.slice(0, 15).map((a) => `• ${a.codigo} — ${a.fazenda}${a.talhao ? "/" + a.talhao : ""} (${a.dias_septo} d)`).join("\n") + (g.avisos.length > 15 ? `\n…e mais ${g.avisos.length - 15}` : "") : "") +
      `\n\nPainel: https://migdolus.avilaops.com/armadilhas?faixa=critico`,
  }));

  return json({ gerado_em: new Date().toISOString(), organizacoes: alertas.length, alertas });
}
