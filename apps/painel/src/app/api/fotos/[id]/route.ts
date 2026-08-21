import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { comSessao, ApiError } from "@/lib/api";
import { one } from "@/lib/db";

const FOTOS_DIR = process.env.FOTOS_DIR || "/data/fotos";

export const GET = comSessao<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params, sessao }) => {
  const { id } = await params;
  const foto = await one<{ object_key: string }>(
    `SELECT f.object_key FROM foto f JOIN armadilha a ON a.id = f.armadilha_id JOIN fazenda fz ON fz.id = a.fazenda_id
      WHERE f.id = $1 AND fz.organizacao_id = $2`,
    [id, sessao.organizacaoId],
  );
  if (!foto) throw new ApiError(404, "Foto não encontrada");
  const caminho = path.join(FOTOS_DIR, ...foto.object_key.split("/"));
  try {
    const buf = await readFile(caminho);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    throw new ApiError(404, "Arquivo da foto não encontrado");
  }
});
