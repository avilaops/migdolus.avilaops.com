import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { comSessao, json, ApiError } from "@/lib/api";
import { one, query } from "@/lib/db";

// Upload multipart vindo do app: campo `arquivo` (jpeg) + metadados.
// Por enquanto grava em disco (volume /data/fotos); R2 entra na etapa 5.
export const FOTOS_DIR = process.env.FOTOS_DIR || "/data/fotos";

export const POST = comSessao(async (req: NextRequest, { sessao }) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) throw new ApiError(400, "Campo 'arquivo' ausente");
  if (arquivo.size > 12 * 1024 * 1024) throw new ApiError(413, "Foto maior que 12 MB");

  const clientId = String(form.get("client_id") || randomUUID());
  const vistoriaClientId = form.get("vistoria_client_id") ? String(form.get("vistoria_client_id")) : null;
  const armadilhaClientId = form.get("armadilha_client_id") ? String(form.get("armadilha_client_id")) : null;
  const tiradaEm = form.get("tirada_em") ? String(form.get("tirada_em")) : null;
  const lat = form.get("lat") ? Number(form.get("lat")) : null;
  const lon = form.get("lon") ? Number(form.get("lon")) : null;

  // idempotência
  const existente = await one<{ id: string; object_key: string }>(`SELECT id, object_key FROM foto WHERE client_id = $1`, [clientId]);
  if (existente) return json({ id: existente.id, client_id: clientId, url: `/api/fotos/${existente.id}` });

  const vistoria = vistoriaClientId
    ? await one<{ id: string; armadilha_id: string }>(`SELECT id, armadilha_id FROM vistoria WHERE client_id = $1`, [vistoriaClientId])
    : null;
  const armadilha = armadilhaClientId
    ? await one<{ id: string }>(`SELECT id FROM armadilha WHERE client_id = $1`, [armadilhaClientId])
    : null;
  const armadilhaId = vistoria?.armadilha_id ?? armadilha?.id ?? null;
  if (!vistoria && !armadilha) throw new ApiError(404, "Vistoria/armadilha da foto ainda não sincronizada — envie o lote antes das fotos");

  const dia = (tiradaEm && !Number.isNaN(Date.parse(tiradaEm)) ? new Date(tiradaEm) : new Date()).toISOString().slice(0, 10);
  const dir = path.join(FOTOS_DIR, sessao.organizacaoId, dia);
  await mkdir(dir, { recursive: true });
  const nome = `${clientId}.jpg`;
  const buf = Buffer.from(await arquivo.arrayBuffer());
  await writeFile(path.join(dir, nome), buf);
  const objectKey = path.posix.join(sessao.organizacaoId, dia, nome);

  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(buf).digest("hex");

  const [row] = await query<{ id: string }>(
    `INSERT INTO foto (client_id, vistoria_id, armadilha_id, object_key, sha256, tirada_em, geom)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($7, $8), 4326) END)
     RETURNING id`,
    [clientId, vistoria?.id ?? null, armadilhaId, objectKey, sha, tiradaEm, lon, lat],
  );
  if (vistoria) await query(`UPDATE vistoria SET completa = true WHERE id = $1`, [vistoria.id]);

  return json({ id: row.id, client_id: clientId, url: `/api/fotos/${row.id}` }, { status: 201 });
});

export const GET = comSessao(async (req: NextRequest, { sessao }) => {
  const armadilhaId = req.nextUrl.searchParams.get("armadilha");
  const rows = await query(
    `SELECT f.id, f.vistoria_id, f.armadilha_id, f.tirada_em, ST_Y(f.geom) AS lat, ST_X(f.geom) AS lon, a.codigo
       FROM foto f JOIN armadilha a ON a.id = f.armadilha_id JOIN fazenda fz ON fz.id = a.fazenda_id
      WHERE fz.organizacao_id = $1 AND ($2::uuid IS NULL OR f.armadilha_id = $2)
      ORDER BY f.tirada_em DESC NULLS LAST LIMIT 200`,
    [sessao.organizacaoId, armadilhaId],
  );
  return json(rows);
});
