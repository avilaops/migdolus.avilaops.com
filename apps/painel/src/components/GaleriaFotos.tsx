"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { dataHora } from "@/lib/formatar";

export interface FotoItem { id: string; url: string; tirada_em: string | null; lat: number | null; lon: number | null }

export function GaleriaFotos({ fotos, codigo }: { fotos: FotoItem[]; codigo: string }) {
  const [aberta, setAberta] = useState<FotoItem | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {fotos.map((f) => (
          <button key={f.id} onClick={() => setAberta(f)} className="group relative aspect-square overflow-hidden rounded-lg border border-borda bg-fundo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`${codigo} — ${dataHora(f.tirada_em)}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-[10px] text-white text-left">{dataHora(f.tirada_em)}</span>
          </button>
        ))}
      </div>
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Foto da armadilha {codigo}</DialogTitle>
          {aberta && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={aberta.url} alt={codigo} className="w-full rounded-md" />
              <figcaption className="px-2 py-2 text-xs text-texto-suave font-mono">
                {codigo} · {dataHora(aberta.tirada_em)}{aberta.lat !== null && aberta.lon !== null ? ` · ${Number(aberta.lat).toFixed(6)}, ${Number(aberta.lon).toFixed(6)}` : ""}
                {" · "}<a className="text-marca hover:underline" href={aberta.url} target="_blank" rel="noreferrer">abrir original</a>
              </figcaption>
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
