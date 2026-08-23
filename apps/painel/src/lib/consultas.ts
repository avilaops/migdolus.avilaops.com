import { query, one } from "./db";

// Consultas compartilhadas entre páginas (Server Components) e rotas /api.

export interface Resumo {
  armadilhas_ativas: number;
  armadilhas_planejadas: number;
  septo_aviso: number;
  septo_critico: number;
  sem_septo: number;
  vistorias_7d: number;
  adultos_7d: number;
  adultos_30d: number;
  fotos_total: number;
  fazendas: number;
  talhoes: number;
  pragueiros_ativos_7d: number;
  ultima_sync: string | null;
}

export async function resumoDaOrganizacao(org: string): Promise<Resumo> {
  const r = await one<Record<string, string | null>>(
    `WITH arm AS (
       SELECT s.* FROM v_armadilha_status s JOIN fazenda f ON f.id = s.fazenda_id WHERE f.organizacao_id = $1
     ), vis AS (
       SELECT v.* FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
        WHERE f.organizacao_id = $1 AND v.corrige_vistoria_id IS NULL
     )
     SELECT
       (SELECT count(*) FROM arm WHERE status = 'ativa')                                  AS armadilhas_ativas,
       (SELECT count(*) FROM arm WHERE status = 'planejada')                              AS armadilhas_planejadas,
       (SELECT count(*) FROM arm WHERE status = 'ativa' AND faixa_septo = 'aviso')        AS septo_aviso,
       (SELECT count(*) FROM arm WHERE status = 'ativa' AND faixa_septo = 'critico')      AS septo_critico,
       (SELECT count(*) FROM arm WHERE status = 'ativa' AND faixa_septo = 'sem_septo')    AS sem_septo,
       (SELECT count(*) FROM vis WHERE realizada_em >= now() - interval '7 days')         AS vistorias_7d,
       (SELECT COALESCE(sum(adultos),0) FROM vis WHERE realizada_em >= now() - interval '7 days')  AS adultos_7d,
       (SELECT COALESCE(sum(adultos),0) FROM vis WHERE realizada_em >= now() - interval '30 days') AS adultos_30d,
       (SELECT count(*) FROM foto fo JOIN armadilha a ON a.id = fo.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id WHERE f.organizacao_id = $1) AS fotos_total,
       (SELECT count(*) FROM fazenda WHERE organizacao_id = $1)                            AS fazendas,
       (SELECT count(*) FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id WHERE f.organizacao_id = $1) AS talhoes,
       (SELECT count(DISTINCT usuario_id) FROM vis WHERE realizada_em >= now() - interval '7 days') AS pragueiros_ativos_7d,
       (SELECT max(recebido_em)::text FROM sync_evento se JOIN usuario u ON u.id = se.usuario_id WHERE u.organizacao_id = $1) AS ultima_sync`,
    [org],
  );
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    armadilhas_ativas: n("armadilhas_ativas"),
    armadilhas_planejadas: n("armadilhas_planejadas"),
    septo_aviso: n("septo_aviso"),
    septo_critico: n("septo_critico"),
    sem_septo: n("sem_septo"),
    vistorias_7d: n("vistorias_7d"),
    adultos_7d: n("adultos_7d"),
    adultos_30d: n("adultos_30d"),
    fotos_total: n("fotos_total"),
    fazendas: n("fazendas"),
    talhoes: n("talhoes"),
    pragueiros_ativos_7d: n("pragueiros_ativos_7d"),
    ultima_sync: r?.ultima_sync ?? null,
  };
}

export interface ArmadilhaStatus {
  id: string;
  codigo: string;
  fazenda_id: string;
  fazenda: string;
  talhao: string | null;
  finalidade: string;
  status: string;
  lat: number;
  lon: number;
  septo_inicio: string | null;
  septo_fim_previsto: string | null;
  dias_septo: number | null;
  faixa_septo: "ok" | "aviso" | "critico" | "sem_septo";
  ultima_vistoria_em: string | null;
  ultima_contagem: number | null;
  nivel_infestacao: "baixo" | "medio" | "alto" | null;
}

export interface PaginaArmadilhas {
  linhas: ArmadilhaStatus[];
  total: number;
  pagina: number;
  porPagina: number;
}

/**
 * Lista paginada no servidor: filtros (fazenda, faixa, busca) e LIMIT/OFFSET no SQL.
 * A tabela nunca carrega o cadastro inteiro — 1 milhão de armadilhas continua custando uma página.
 */
export async function armadilhasComStatus(
  org: string,
  opts: { fazenda?: string | null; faixa?: string | null; busca?: string | null; pagina?: number; porPagina?: number } = {},
): Promise<PaginaArmadilhas> {
  const porPagina = Math.min(Math.max(opts.porPagina ?? 50, 10), 200);
  const pagina = Math.max(opts.pagina ?? 1, 1);
  const busca = opts.busca?.trim() ? `%${opts.busca.trim()}%` : null;
  const where = `FROM v_armadilha_status s
       JOIN fazenda f ON f.id = s.fazenda_id
       LEFT JOIN talhao t ON t.id = s.talhao_id
      WHERE f.organizacao_id = $1 AND s.status <> 'removida'
        AND ($2::uuid IS NULL OR s.fazenda_id = $2)
        AND ($3::text IS NULL OR s.faixa_septo = $3)
        AND ($4::text IS NULL OR s.codigo ILIKE $4 OR t.nome ILIKE $4)`;
  const params = [org, opts.fazenda ?? null, opts.faixa ?? null, busca];
  const [linhas, contagem] = await Promise.all([
    query<ArmadilhaStatus>(
      `SELECT s.id, s.codigo, s.fazenda_id, f.nome AS fazenda, t.nome AS talhao, s.finalidade, s.status,
              ST_Y(s.geom) AS lat, ST_X(s.geom) AS lon,
              s.septo_inicio, s.septo_fim_previsto, s.dias_septo, s.faixa_septo,
              s.ultima_vistoria_em, s.ultima_contagem, s.nivel_infestacao
         ${where}
        ORDER BY CASE s.faixa_septo WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 WHEN 'sem_septo' THEN 2 ELSE 3 END, s.codigo
        LIMIT $5 OFFSET $6`,
      [...params, porPagina, (pagina - 1) * porPagina],
    ),
    query<{ total: string }>(`SELECT count(*) AS total ${where}`, params),
  ]);
  return { linhas, total: Number(contagem[0]?.total ?? 0), pagina, porPagina };
}

/** Contadores por status/faixa para os chips da tela (independem da página atual). */
export async function contagemArmadilhas(org: string, fazenda?: string | null) {
  const r = await query<{ faixa_septo: string; status: string; n: string }>(
    `SELECT s.faixa_septo, s.status, count(*) AS n
       FROM v_armadilha_status s JOIN fazenda f ON f.id = s.fazenda_id
      WHERE f.organizacao_id = $1 AND s.status <> 'removida' AND ($2::uuid IS NULL OR s.fazenda_id = $2)
      GROUP BY s.faixa_septo, s.status`,
    [org, fazenda ?? null],
  );
  const soma = (fn: (x: { faixa_septo: string; status: string }) => boolean) => r.filter(fn).reduce((acc, x) => acc + Number(x.n), 0);
  return {
    total: soma(() => true),
    ativas: soma((x) => x.status === "ativa"),
    planejadas: soma((x) => x.status === "planejada"),
    critico: soma((x) => x.status === "ativa" && x.faixa_septo === "critico"),
    aviso: soma((x) => x.status === "ativa" && x.faixa_septo === "aviso"),
    ok: soma((x) => x.status === "ativa" && x.faixa_septo === "ok"),
    sem_septo: soma((x) => x.status === "ativa" && x.faixa_septo === "sem_septo"),
  };
}

export interface VistoriaRecente {
  id: string;
  realizada_em: string;
  adultos: number;
  troca_septo: boolean;
  codigo: string;
  fazenda: string;
  talhao: string | null;
  pragueiro: string | null;
  distancia_m: string | null;
  fotos: number;
}

export async function vistoriasRecentes(org: string, limite = 20) {
  return query<VistoriaRecente>(
    `SELECT v.id, v.realizada_em, v.adultos, v.troca_septo, a.codigo, f.nome AS fazenda, t.nome AS talhao, u.nome AS pragueiro, v.distancia_m,
            (SELECT count(*) FROM foto fo WHERE fo.vistoria_id = v.id)::int AS fotos
       FROM vistoria v
       JOIN armadilha a ON a.id = v.armadilha_id
       JOIN fazenda f ON f.id = a.fazenda_id
       LEFT JOIN talhao t ON t.id = a.talhao_id
       LEFT JOIN usuario u ON u.id = v.usuario_id
      WHERE f.organizacao_id = $1 AND v.corrige_vistoria_id IS NULL
      ORDER BY v.realizada_em DESC LIMIT $2`,
    [org, limite],
  );
}

export async function capturasPorSemana(org: string, semanas = 12) {
  return query<{ semana: string; adultos: number; vistorias: number; media: number }>(
    `SELECT to_char(date_trunc('week', v.realizada_em), 'DD/MM') AS semana,
            sum(v.adultos)::int AS adultos, count(*)::int AS vistorias, round(avg(v.adultos), 1)::float AS media
       FROM vistoria v JOIN armadilha a ON a.id = v.armadilha_id JOIN fazenda f ON f.id = a.fazenda_id
      WHERE f.organizacao_id = $1 AND v.corrige_vistoria_id IS NULL
        AND v.realizada_em >= date_trunc('week', now()) - make_interval(weeks => $2)
      GROUP BY date_trunc('week', v.realizada_em) ORDER BY date_trunc('week', v.realizada_em)`,
    [org, semanas],
  );
}

export async function fazendasDaOrganizacao(org: string) {
  return query<{ id: string; nome: string; talhoes: number; armadilhas_ativas: number; armadilhas_planejadas: number }>(
    `SELECT f.id, f.nome,
            (SELECT count(*) FROM talhao t WHERE t.fazenda_id = f.id)::int AS talhoes,
            (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'ativa')::int AS armadilhas_ativas,
            (SELECT count(*) FROM armadilha a WHERE a.fazenda_id = f.id AND a.status = 'planejada')::int AS armadilhas_planejadas
       FROM fazenda f WHERE f.organizacao_id = $1 ORDER BY f.nome`,
    [org],
  );
}
