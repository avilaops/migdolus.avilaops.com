# API — Migdolus Monitor (Fastify + TypeScript + Prisma/PostGIS)

Serviço único que atende o app de campo e o painel. Porta padrão `3070`.

## Endpoints (MVP)

| Método | Rota | Função |
|---|---|---|
| `POST` | `/auth/login` · `/auth/refresh` | JWT curto + refresh |
| `POST` | `/sync/push` | Lote do aparelho: armadilhas, ciclos, vistorias, fotos (metadados), trincheiras. `UPSERT ON CONFLICT (client_id)` |
| `GET`  | `/sync/pull?since=` | Tudo que mudou desde o cursor (armadilhas de outros, talhões, malha planejada, parâmetros) |
| `POST` | `/fotos/url-upload` | URL assinada do R2 para upload direto |
| `GET`  | `/fazendas/:id/mapa-offline.mbtiles` | Pacote de tiles da fazenda |
| `POST` | `/talhoes/:id/malha?espacamento=30` | Gera armadilhas `planejadas` via `gerar_malha()` |
| `GET`  | `/mapa/heat?fazenda=&de=&ate=` | GeoJSON ponderado para o heatmap |
| `GET`  | `/mapa/idw?talhao=&de=&ate=` | Superfície interpolada (PNG/GeoTIFF) |
| `GET`  | `/armadilhas/status` | `v_armadilha_status` com filtros |
| `GET`  | `/safras/comparativo` | `v_safra_comparativo` |
| `GET`  | `/relatorios/:fazenda/:periodo.pdf` | Laudo PDF (Playwright) |
| `POST` | `/alertas/septo/varrer` | Cron diário: dispara webhook do n8n para septos em `aviso`/`critico` |

## Regras

- Vistoria é imutável depois de enviada; correção = nova vistoria com
  `corrige_vistoria_id`.
- RLS por `organizacao_id`; nunca expor ID de outra organização.
- Segredos via env (`/etc/avilaops/migdolus.env` em produção).

## Inicialização (quando for implementar)

```bash
npm init -y && npm i fastify @fastify/jwt @fastify/cors @prisma/client pg zod
npm i -D typescript tsx prisma @types/node
npx prisma init --datasource-provider postgresql
```
