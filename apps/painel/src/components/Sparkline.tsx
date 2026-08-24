"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

// Mini-tendência para cartões KPI: sem eixos, sem grade — só a forma da série.
export function Sparkline({ dados, cor = "var(--marca)" }: { dados: number[]; cor?: string }) {
  if (dados.length < 2) return null;
  const serie = dados.map((v, i) => ({ i, v }));
  return (
    <div className="h-9 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={serie} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={1.8} fill="url(#spark)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
