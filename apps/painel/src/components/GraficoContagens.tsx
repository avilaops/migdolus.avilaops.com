"use client";

import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Scatter } from "recharts";

export function GraficoContagens({ dados }: { dados: Array<{ data: string; adultos: number; troca: boolean }> }) {
  const trocas = dados.filter((d) => d.troca).map((d) => ({ ...d, marcador: d.adultos }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="gradAdultos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--marca)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--marca)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--borda)" vertical={false} />
          <XAxis dataKey="data" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--borda)", fontSize: 12 }} formatter={(v, n) => [v as number, n === "marcador" ? "Troca de septo" : "Adultos"]} />
          <Area type="monotone" dataKey="adultos" stroke="var(--marca)" strokeWidth={2} fill="url(#gradAdultos)" dot={{ r: 3 }} />
          <Scatter data={trocas} dataKey="marcador" fill="var(--aviso)" shape="diamond" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-texto-suave mt-1">◆ troca de septo</p>
    </div>
  );
}
