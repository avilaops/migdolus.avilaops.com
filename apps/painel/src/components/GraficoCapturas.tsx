"use client";

import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function GraficoCapturas({ dados }: { dados: Array<{ semana: string; adultos: number; vistorias: number; media: number }> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--borda)" vertical={false} />
          <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis tick={{ fontSize: 11, fill: "var(--texto-suave)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--marca-clara)", opacity: 0.45 }}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--borda)", fontSize: 12, boxShadow: "0 4px 16px rgba(15,31,23,0.12)" }}
            formatter={(v, nome) => [v as number, nome === "adultos" ? "Adultos capturados" : "Vistorias"]}
            labelFormatter={(l) => `Semana de ${l}`}
          />
          <Bar dataKey="adultos" fill="var(--marca)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
