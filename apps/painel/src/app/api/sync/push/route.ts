import { z } from "zod";
import type { NextRequest } from "next/server";
import { comSessao, lerCorpo, json } from "@/lib/api";
import { transaction } from "@/lib/db";

// Lote enviado pelo app de campo. Tudo é idempotente por client_id:
// reenviar o mesmo lote não duplica nada.
const Ponto = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

const Armadilha = z.object({
  client_id: z.string().uuid(),
  fazenda_id: z.string().uuid(),
  talhao_id: z.string().uuid().nullable().optional(),
  codigo: z.string().min(1).max(40),
  finalidade: z.enum(["monitoramento", "coleta_massal"]).default("monitoramento"),
  ponto: Ponto,
  precisao_m: z.number().nullable().optional(),
  instalada_em: z.string().datetime({ offset: true }),
  status: z.enum(["planejada", "ativa", "removida", "perdida"]).default("ativa"),
  observacoes: z.string().max(2000).nullable().optional(),
  // Quando a armadilha veio da malha planejada, o app manda o id do servidor
  // para confirmar o ponto em vez de criar outro.
  id_servidor: z.string().uuid().nullable().optional(),
});

const Ciclo = z.object({
  client_id: z.string().uuid(),
  armadilha_client_id: z.string().uuid().nullable().optional(),
  armadilha_id: z.string().uuid().nullable().optional(),
  lote_septo: z.string().max(80).nullable().optional(),
  inicio: z.string().datetime({ offset: true }),
  fim_previsto: z.string().datetime({ offset: true }).nullable().optional(),
  trocado_em: z.string().datetime({ offset: true }).nullable().optional(),
});

const Vistoria = z.object({
  client_id: z.string().uuid(),
  armadilha_client_id: z.string().uuid().nullable().optional(),
  armadilha_id: z.string().uuid().nullable().optional(),
  realizada_em: z.string().datetime({ offset: true }),
  adultos: z.number().int().min(0).max(100000),
  ponto: Ponto.nullable().optional(),
  precisao_m: z.number().nullable().optional(),
  precisao_baixa: z.boolean().default(false),
  troca_septo: z.boolean().default(false),
  observacoes: z.string().max(2000).nullable().optional(),
  corrige_vistoria_client_id: z.string().uuid().nullable().optional(),
});

const Trincheira = z.object({
  client_id: z.string().uuid(),
  talhao_id: z.string().uuid(),
  realizada_em: z.string().datetime({ offset: true }),
  larvas: z.number().int().min(0),
  ponto: Ponto.nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

const Lote = z.object({
  device_id: z.string().min(1).max(120),
  armadilhas: z.array(Armadilha).default([]),
  ciclos: z.array(Ciclo).default([]),
  vistorias: z.array(Vistoria).default([]),
  trincheiras: z.array(Trincheira).default([]),
});

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const lote = await lerCorpo(req, Lote);
  const org = sessao.organizacaoId;

  const resultado = await transaction(async (q) => {
    const mapaArmadilhas = new Map<string, string>(); // client_id -> id

    const [{ dias_septo }] = await q<{ dias_septo: number }>(`SELECT dias_septo FROM organizacao WHERE id = $1`, [org]);

    for (const a of lote.armadilhas) {
      // fazenda precisa ser da organização da sessão
      const [faz] = await q<{ id: string }>(`SELECT id FROM fazenda WHERE id = $1 AND organizacao_id = $2`, [a.fazenda_id, org]);
      if (!faz) continue;

      if (a.id_servidor) {
        // confirmação de ponto planejado: atualiza posição real e ativa
        const [row] = await q<{ id: string }>(
          `UPDATE armadilha SET client_id = COALESCE(client_id, $2), device_id = $3,
                  geom = ST_SetSRID(ST_MakePoint($4, $5), 4326), precisao_m = $6,
                  instalada_em = $7, instalada_por = $8, status = $9, observacoes = COALESCE($10, observacoes),
                  finalidade = $11, atualizado_em = now()
            WHERE id = $1 AND fazenda_id = $12 RETURNING id`,
          [a.id_servidor, a.client_id, lote.device_id, a.ponto.lon, a.ponto.lat, a.precisao_m ?? null, a.instalada_em,
           sessao.usuarioId, a.status, a.observacoes ?? null, a.finalidade, a.fazenda_id],
        );
        if (row) { mapaArmadilhas.set(a.client_id, row.id); continue; }
      }

      const [row] = await q<{ id: string }>(
        `INSERT INTO armadilha (client_id, device_id, talhao_id, fazenda_id, codigo, finalidade, geom, precisao_m,
                                instalada_em, instalada_por, status, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, $11, $12, $13)
         ON CONFLICT (client_id) DO UPDATE SET
           talhao_id = EXCLUDED.talhao_id, codigo = EXCLUDED.codigo, finalidade = EXCLUDED.finalidade,
           geom = EXCLUDED.geom, precisao_m = EXCLUDED.precisao_m, status = EXCLUDED.status,
           observacoes = EXCLUDED.observacoes, atualizado_em = now()
         RETURNING id`,
        [a.client_id, lote.device_id, a.talhao_id ?? null, a.fazenda_id, a.codigo, a.finalidade, a.ponto.lon, a.ponto.lat,
         a.precisao_m ?? null, a.instalada_em, sessao.usuarioId, a.status, a.observacoes ?? null],
      );
      mapaArmadilhas.set(a.client_id, row.id);
    }

    const resolverArmadilha = async (clientId?: string | null, id?: string | null): Promise<string | null> => {
      if (id) return id;
      if (!clientId) return null;
      const local = mapaArmadilhas.get(clientId);
      if (local) return local;
      const [row] = await q<{ id: string }>(`SELECT id FROM armadilha WHERE client_id = $1`, [clientId]);
      return row?.id ?? null;
    };

    const ciclosOk: string[] = [];
    for (const c of lote.ciclos) {
      const armadilhaId = await resolverArmadilha(c.armadilha_client_id, c.armadilha_id);
      if (!armadilhaId) continue;
      await q(
        `INSERT INTO ciclo_feromonio (client_id, armadilha_id, lote_septo, inicio, fim_previsto, trocado_em, trocado_por)
         VALUES ($1, $2, $3, $4, COALESCE($5, $4::timestamptz + make_interval(days => $6)), $7, $8)
         ON CONFLICT (client_id) DO UPDATE SET trocado_em = COALESCE(EXCLUDED.trocado_em, ciclo_feromonio.trocado_em),
                                              lote_septo = COALESCE(EXCLUDED.lote_septo, ciclo_feromonio.lote_septo)`,
        [c.client_id, armadilhaId, c.lote_septo ?? null, c.inicio, c.fim_previsto ?? null, dias_septo, c.trocado_em ?? null, sessao.usuarioId],
      );
      // Um septo novo fecha o anterior da mesma armadilha.
      if (!c.trocado_em) {
        await q(
          `UPDATE ciclo_feromonio SET trocado_em = $2, trocado_por = $3
            WHERE armadilha_id = $1 AND trocado_em IS NULL AND client_id <> $4 AND inicio < $2`,
          [armadilhaId, c.inicio, sessao.usuarioId, c.client_id],
        );
      }
      ciclosOk.push(c.client_id);
    }

    const vistoriasOk: Array<{ client_id: string; id: string }> = [];
    for (const v of lote.vistorias) {
      const armadilhaId = await resolverArmadilha(v.armadilha_client_id, v.armadilha_id);
      if (!armadilhaId) continue;
      let corrigeId: string | null = null;
      if (v.corrige_vistoria_client_id) {
        const [c] = await q<{ id: string }>(`SELECT id FROM vistoria WHERE client_id = $1`, [v.corrige_vistoria_client_id]);
        corrigeId = c?.id ?? null;
      }
      // Vistoria é imutável: ON CONFLICT DO NOTHING. Distância calculada no servidor.
      const [row] = await q<{ id: string }>(
        `INSERT INTO vistoria (client_id, device_id, armadilha_id, usuario_id, realizada_em, adultos, geom, precisao_m,
                               distancia_m, precisao_baixa, troca_septo, corrige_vistoria_id, observacoes)
         SELECT $1, $2, a.id, $3, $4, $5,
                CASE WHEN $6::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($6, $7), 4326) END,
                $8,
                CASE WHEN $6::float8 IS NULL THEN NULL
                     ELSE round(ST_Distance(a.geom::geography, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)::numeric, 1) END,
                $9, $10, $11, $12
         FROM armadilha a WHERE a.id = $13
         ON CONFLICT (client_id) DO NOTHING
         RETURNING id`,
        [v.client_id, lote.device_id, sessao.usuarioId, v.realizada_em, v.adultos,
         v.ponto?.lon ?? null, v.ponto?.lat ?? null, v.precisao_m ?? null,
         v.precisao_baixa, v.troca_septo, corrigeId, v.observacoes ?? null, armadilhaId],
      );
      if (row) vistoriasOk.push({ client_id: v.client_id, id: row.id });
      else {
        const [ex] = await q<{ id: string }>(`SELECT id FROM vistoria WHERE client_id = $1`, [v.client_id]);
        if (ex) vistoriasOk.push({ client_id: v.client_id, id: ex.id });
      }
    }

    for (const t of lote.trincheiras) {
      await q(
        `INSERT INTO trincheira (client_id, talhao_id, usuario_id, realizada_em, larvas, geom, observacoes)
         SELECT $1, t.id, $2, $3, $4,
                CASE WHEN $5::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5, $6), 4326) END, $7
         FROM talhao t JOIN fazenda f ON f.id = t.fazenda_id
         WHERE t.id = $8 AND f.organizacao_id = $9
         ON CONFLICT (client_id) DO NOTHING`,
        [t.client_id, sessao.usuarioId, t.realizada_em, t.larvas, t.ponto?.lon ?? null, t.ponto?.lat ?? null, t.observacoes ?? null, t.talhao_id, org],
      );
    }

    const total = lote.armadilhas.length + lote.ciclos.length + lote.vistorias.length + lote.trincheiras.length;
    await q(`INSERT INTO sync_evento (device_id, usuario_id, registros) VALUES ($1, $2, $3)`, [lote.device_id, sessao.usuarioId, total]);

    return {
      armadilhas: Object.fromEntries(mapaArmadilhas),
      ciclos: ciclosOk,
      vistorias: vistoriasOk,
      recebido_em: new Date().toISOString(),
    };
  });

  return json(resultado);
});
