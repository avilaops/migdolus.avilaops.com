# Painel + API — Migdolus Monitor (Next.js 16, standalone)

Em produção em **https://migdolus.avilaops.com** (container `migdolus-painel`,
Hetzner, porta 3070 atrás do Caddy). A **API do app de campo vive aqui**, em
`src/app/api/*` (route handlers) — um único processo Node para poupar RAM no CX23.

## Páginas

| Rota | O que mostra |
| --- | --- |
| `/entrar` | Login (mesma API do app) |
| `/` | Visão geral: KPIs (ativas, septo vencido, adultos 7/30 d), capturas por semana (Recharts), troca de septo, últimas vistorias |
| `/mapa` | Mapa de calor (MapLibre GL JS, satélite Esri): pontos por nível de infestação, borda pelo septo, heatmap ponderado, filtro por fazenda e período, painel lateral da armadilha |
| `/armadilhas` | Tabela com status de septo, vence em, última vistoria, contagem, nível, coordenadas; filtros por faixa/fazenda e busca |
| `/talhoes` | Fazendas e talhões: **desenhar polígono no mapa** ou **importar GeoJSON/KML**, área em ha, **gerar malha de armadilhas** (30 m, `gerar_malha()` no PostGIS) → pontos `planejados` que aparecem no app |
| `/configuracoes` | Parâmetros agronômicos (dias do septo, aviso, malha, faixas), usuários (criar, ativar/desativar, redefinir senha), instruções do app |

UI: shadcn (estilo base-nova / Base UI) com tokens da marca — Sidebar
colapsável, Card, Table, Dialog, Tabs, Select, Switch, Sonner. Componentes do
21st.dev ficam para quando a cota da conta liberar (ver Todoist).

## API

| Método | Rota | Função |
| --- | --- | --- |
| `POST` | `/api/setup` | Primeiro acesso (exige `SETUP_TOKEN`; só funciona sem usuários) |
| `POST` | `/api/auth/login` · `/api/auth/refresh` · `/api/auth/sair` | JWT curto + refresh (app) e cookie httpOnly (painel) |
| `POST` | `/api/sync/push` | Lote do aparelho (armadilhas, ciclos, vistorias, trincheiras), `ON CONFLICT (client_id)`; vistoria imutável |
| `GET` | `/api/sync/pull?since=` | Organização/parâmetros, fazendas, talhões (GeoJSON), armadilhas com status, ciclos, últimas vistorias |
| `POST` | `/api/fotos` · `GET /api/fotos/:id` | Upload multipart → `/data/fotos` (volume); leitura autenticada |
| `GET` | `/api/armadilhas` | `v_armadilha_status` com filtros |
| `GET` | `/api/mapa/heat` · `/api/mapa/estilo` | GeoJSON ponderado para o heatmap · estilo MapLibre (usado pelo app e pelo pacote offline) |
| `GET/POST` | `/api/fazendas` · `/api/talhoes` · `DELETE /api/talhoes?id=` | Cartografia |
| `POST` | `/api/talhoes/:id/malha` | Gera armadilhas planejadas (espaçamento, prefixo, finalidade) |
| `GET/POST/PATCH` | `/api/usuarios` | Gestão de usuários (admin/gestor) |
| `GET/PATCH` | `/api/configuracoes` | Parâmetros da organização |
| `GET` | `/api/resumo` | KPIs da visão geral |

Autenticação: `src/lib/auth.ts` (jose + bcryptjs); `src/proxy.ts` protege as
páginas; rotas usam `comSessao()` de `src/lib/api.ts`.

## Rodar local

```bash
cp ../../.env.example ../../.env   # DATABASE_URL, JWT_SECRET, SETUP_TOKEN, FOTOS_DIR
npm install && npm run dev
```

## Deploy

`../../deploy/deploy.sh` — build local da imagem (`output: standalone`),
`docker save | ssh docker load`, `docker compose up -d`, bloco do Caddy.
O container usa `network_mode: bridge` para enxergar o Postgres do host em
`172.17.0.1`.
