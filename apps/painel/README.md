# Painel Web — Migdolus Monitor (Next.js)

Painel do escritório / usina em `https://migdolus.avilaops.com`.

## Páginas (ordem de entrega)

| Rota | O que mostra |
|---|---|
| `/entrar` | Login (mesma API do app) |
| `/` | Visão geral: armadilhas ativas, septos vencendo, capturas da semana, mapa resumido |
| `/mapa` | Mapa de calor (MapLibre GL JS): pontos verde/amarelo/vermelho, heatmap ponderado, filtro por fazenda/talhão/período, camada IDW |
| `/armadilhas` | Tabela com status de septo ("vence em X dias"), última contagem, pragueiro, ações |
| `/talhoes` | Editor de malha cartográfica: desenhar polígonos, importar KML/GeoJSON/SHP, gerar malha de 30 m, exportar pacote de mapa offline |
| `/safras` | Comparativo entre safras: curva de revoada mensal sobreposta, % de queda, larvas/trincheira, TCH |
| `/relatorios` | Gerar laudo PDF por fazenda/período; histórico de laudos enviados |
| `/configuracoes` | Parâmetros da organização (dias do septo, faixas, espaçamento), usuários, integrações |

## Stack prevista

- Next.js (App Router) + TypeScript + Tailwind
- `maplibre-gl`, `@mapbox/mapbox-gl-draw` (desenho de talhões), `@turf/turf`
- `recharts` (curva de revoada, comparativo de safras)
- Playwright no servidor para renderizar o laudo em PDF (rota de impressão)
- Visual: clean, tecnológico, com autoridade — padrão Avila Ops; copy em português.

## Inicialização (quando for implementar)

```bash
npx create-next-app@latest . --ts --tailwind --app --src-dir
npm i maplibre-gl @mapbox/mapbox-gl-draw @turf/turf recharts
```
