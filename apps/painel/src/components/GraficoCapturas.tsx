"use client";

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function GraficoCapturas({ dados }: { dados: Array<{ semana: string; adultos: number; vistorias: number; media: number }> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--borda)" vertical={false} />
          <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="a" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="m" orientation="right" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid var(--borda)", fontSize: 12 }}
            formatter={(v, nome) => [v as number, nome === "adultos" ? "Adultos capturados" : nome === "media" ? "Média por vistoria" : "Vistorias"]}
            labelFormatter={(l) => `Semana de ${l}`}
          />
          <Bar yAxisId="a" dataKey="adultos" fill="var(--marca)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Line yAxisId="m" type="monotone" dataKey="media" stroke="var(--aviso)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
