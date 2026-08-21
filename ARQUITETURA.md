# Arquitetura — Migdolus Monitor

## Visão geral

```text
┌──────────────────────┐     HTTPS (lote, idempotente)     ┌──────────────────────┐
│  App Campo (Expo)    │ ───────────────────────────────►  │  API (Fastify/TS)    │
│  • SQLite local      │ ◄───────────────────────────────  │  • /sync/push /pull  │
│  • fila de sync      │        pull incremental           │  • /relatorios/pdf   │
│  • GPS + câmera      │                                   │  • /alertas          │
│  • tiles offline     │                                   └──────────┬───────────┘
└──────────────────────┘                                              │
                                                          ┌───────────▼───────────┐
┌──────────────────────┐                                  │ PostgreSQL + PostGIS  │
│  Painel Web (Next)   │ ◄──────────────────────────────► │ Cloudflare R2 (fotos) │
│  • heatmap MapLibre  │                                  └───────────┬───────────┘
│  • editor de talhões │                                              │
│  • status de septo   │                                  ┌───────────▼───────────┐
│  • laudo PDF         │                                  │ n8n (alertas, laudos, │
└──────────────────────┘                                  │ prospecção, WhatsApp) │
                                                          └───────────────────────┘
```

## Modelo de dados (resumo — ver `db/schema.sql`)

| Tabela | Papel |
| --- | --- |
| `organizacao` | Tenant: usina, consultoria ou fazenda independente; parâmetros (dias do septo, faixas de captura) |
| `usuario` | Pragueiro, agrônomo, gestor (papéis) |
| `fazenda` | Unidade produtiva; limite opcional (`MultiPolygon`) |
| `talhao` | Subdivisão da fazenda; polígono desenhado no painel ou importado; área em ha |
| `safra` | Período de monitoramento (ex.: 2026/27) — permite comparar safras como nos resultados da bp |
| `armadilha` | Ponto fixo (`Point, 4326`), código, finalidade (`monitoramento` ou `coleta_massal`), data de instalação, status |
| `ciclo_feromonio` | Cada septo instalado: `inicio`, `fim_previsto` (+30 d), `trocado_em` |
| `vistoria` | Visita à armadilha: contagem de adultos, GPS da visita, precisão, foto(s), observações |
| `foto` | Arquivo no R2, hash, EXIF (lat/lon/hora), carimbo aplicado |
| `trincheira` | Amostragem de larvas no solo (larvas/trincheira) — indicador de eficácia do controle |
| `producao_talhao` | TCH por talhão/safra (manual ou importado do ERP) — mede ganho de produtividade |
| `sync_evento` | Log de push por dispositivo (`device_id`, `client_id`, `recebido_em`) |

Regras derivadas (views/materialized views):

- `v_armadilha_status` — dias desde o último septo, faixa (`ok` < 20, `aviso`
  20–29, `critico` ≥ 30), última contagem, densidade média (adultos/armadilha/dia).
- `v_talhao_indicadores` — média, máximo, total de capturas e nível de infestação
  por período; alimenta o heatmap e o laudo.
- `v_safra_comparativo` — machos/armadilha por mês e por safra (curva de revoada
  Nov–Mai), queda percentual entre safras, larvas/trincheira e TCH.

## Sincronização offline-first

1. Cada registro criado no aparelho recebe `client_id` (UUID v7) e `device_id`.
2. A fila local (`outbox`) guarda operações em ordem; fotos ficam em arquivo até
   o upload.
3. `POST /sync/push` recebe o lote e faz `UPSERT ... ON CONFLICT (client_id)`;
   a resposta devolve o `server_id` e o `updated_at` canônico.
4. `GET /sync/pull?since=<cursor>` devolve só o que mudou desde o último cursor
   (armadilhas de outros pragueiros, talhões novos, ajustes do escritório).
5. Conflito: **última escrita vence por campo**, exceto contagem de vistoria,
   que nunca é sobrescrita — uma vistoria é imutável depois de enviada
   (correções geram nova vistoria com `corrige_vistoria_id`).
6. Fotos: upload direto para o R2 com URL assinada emitida pela API; a vistoria
   referencia o `object_key` e só é marcada `completa` após o upload.

## GPS e precisão

- Captura com `expo-location` em alta precisão; aguarda até `accuracy <= 10 m`
  por no máximo 15 s, senão grava com a melhor leitura e sinaliza `precisao_baixa`.
- Na vistoria, se a distância até o ponto cadastrado da armadilha for > 30 m, o
  app pergunta se a armadilha foi realocada (atualiza o ponto) ou se é outra.
- Coordenadas sempre em WGS-84 (EPSG:4326); distâncias via PostGIS `geography`.

## Malha de coleta massal (30 m)

Os resultados da bp bioenergy mostram que **armadilhas espaçadas de 30 m** foram
as mais eficientes por área. O painel gera a malha automaticamente:

1. usuário desenha/importa o talhão;
2. escolhe o espaçamento (padrão 30 m, editável) e a orientação;
3. o sistema gera os pontos (`ST_GeneratePoints`/grade regular recortada pelo
   polígono), numera sequencialmente e envia para o app como "armadilhas a
   instalar";
4. no campo, o pragueiro instala e confirma cada ponto com o GPS real — a malha
   planejada vira malha instalada.

## Mapa offline

- Por fazenda, o painel gera um pacote **MBTiles** (zoom 12–17) com imagem de
  satélite + limites de talhões; o app baixa uma vez via Wi-Fi.
- Renderização com **MapLibre GL Native**; os pontos das armadilhas vêm do
  SQLite local, coloridos pelo status do septo e pela última contagem.

## Contador de ciclo do feromônio

- `fim_previsto = inicio + 30 dias` (parametrizável por organização: alguns
  septos duram 45 dias).
- Aviso aos 20 dias e alerta crítico aos 30, no app (badge + notificação local)
  e no painel (coluna "vence em"); n8n dispara WhatsApp/e-mail ao responsável.
- Programa de 3 safras: o painel mostra em que ano do ciclo de controle cada
  talhão está (o controle precisa ser mantido por 3 anos ininterruptos).

## Mapa de calor e estatística espacial

- Camada de pontos (verde/amarelo/vermelho por faixa de captura, configurável).
- Heatmap MapLibre ponderado pela contagem.
- Interpolação **IDW** no servidor (PostGIS + raster ou `turf` em worker) para
  gerar a superfície por talhão, exportada como GeoTIFF/PNG para o laudo.
- Níveis de infestação (baixo/médio/alto) parametrizados por organização.
- Modelos estatísticos para comparativo entre safras (GLM binomial negativa,
  como na apresentação da bp) ficam num serviço Python opcional (`services/stats`),
  fora do caminho crítico.

## Laudo em PDF

- Rota `GET /relatorios/:fazenda/:periodo.pdf` renderiza a página do painel em
  modo impressão com Playwright headless e devolve o PDF.
- Conteúdo: capa, resumo executivo, mapa de calor, tabela por talhão, curva de
  revoada mensal, comparativo entre safras (% de queda), galeria de fotos
  georreferenciadas, armadilhas com septo vencido, larvas/trincheira e TCH
  quando houver.

## Segurança e multi-tenant

- Row Level Security por `organizacao_id`; JWT curto + refresh no app.
- Fotos e laudos só por URL assinada com validade.
- Segredos fora do repositório (`/etc/avilaops/migdolus.env`, chmod 600).
