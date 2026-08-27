# Migdolus Monitor — migdolus.avilaops.com

Plataforma de inteligência geográfica e operacional para o monitoramento de
**Migdolus fryanus** (broca-gigante da cana) em armadilhas de feromônio.

Integra **coleta em campo (offline + GPS)**, **nuvem/banco geoespacial** e
**painel web com mapas de calor**, atendendo tanto usinas estruturadas com
bases cartográficas quanto fazendas sem nenhum histórico de mapas.

```text
[ App Campo (Offline/GPS) ] ──(Sincronização)──> [ API + PostGIS ] ──> [ Painel Web / Mapas de Calor / PDF ]
```

## Por que existe

O monitoramento hoje é feito em planilha e caderneta: o pragueiro instala a
armadilha, anota a contagem, tira foto no WhatsApp e alguém lança no Excel.
Resultado: armadilhas perdidas no canavial, septo de feromônio vencido sem
ninguém perceber e laudo para a usina montado à mão.

E o que está em jogo é grande: nos resultados da **bp bioenergy** com coleta
massal por feromônio (3 safras, 21/22 → 23/24), as capturas caíram **94 %**
(352 → 21 machos/armadilha), as larvas no solo **87,5 %** e o TCH da cana de
4º corte ficou **96 % acima** da área sem controle (26 → 51 t/ha). As
armadilhas a **30 m** foram as mais eficientes, e o controle precisa ser mantido
por **3 anos ininterruptos** — ou seja, o programa só funciona com malha certa,
feromônio sempre ativo e dados comparáveis safra a safra. Detalhes em
[docs/agronomia.md](docs/agronomia.md).

O Migdolus Monitor resolve os quatro pontos de uma vez:

| Módulo | Funcionalidade principal | Benefício prático |
| --- | --- | --- |
| **GPS nativo** | Marcação automática do ponto na instalação e em cada vistoria | Dispensa mapas prévios da usina e localiza a armadilha no meio do canavial |
| **Cronômetro de ciclo** | Contagem regressiva para a troca do septo (aviso aos 20 dias, crítico aos 30) | Evita perda de atratividade por esquecimento de prazo |
| **Auditoria visual** | Foto da bacia com carimbo de data, hora e coordenadas, vinculada ao talhão | Comprova o trabalho de campo com transparência para a usina |
| **Estatística espacial** | Média, densidade e interpolação (IDW/kriging) por talhão e fazenda | Elimina o lançamento manual no Excel e gera o mapa de calor sozinho |

## Estado atual (21/08/2026)

| Peça | Status |
| --- | --- |
| Painel + API | **No ar** em <https://migdolus.avilaops.com> (Hetzner, Docker, Caddy, DNS-only) |
| Banco | Postgres 18 + PostGIS 3.6 do host, banco `migdolus`, esquema aplicado |
| Organização piloto | "Avila Ops — Piloto Migdolus", admin `nicolas@avilaops.com` |
| App de campo | Código completo (Expo SDK 57), typecheck e expo-doctor limpos; **APK ainda não gerado** |
| Alertas n8n, laudo PDF, R2, IDW | Etapa 5 — pendentes |

## Módulos

### 1. App Campo (mobile, offline-first)

- **Georreferenciamento automático (GPS offline)** — latitude/longitude/precisão
  registradas no ato da instalação e de cada vistoria, sem sinal de operadora.
- **Localizador de armadilhas** — mapa offline (tiles pré-baixados por fazenda)
  com os pontos instalados, bússola e distância até a armadilha mais próxima.
- **Controle de ciclo e idade da armadilha** — dias desde a instalação/última
  troca de septo; badge amarelo aos 20 dias, vermelho aos 30.
- **Foto georreferenciada** — câmera com carimbo automático (data, hora,
  coordenadas, código da armadilha) gravado na imagem e nos metadados.
- **Lançamento rápido de contagem** — teclado numérico, um toque por vistoria,
  densidade (adultos/armadilha/dia) calculada na hora.
- **Fila de sincronização** — tudo fica em SQLite local e sobe em lote quando
  houver rede (Wi-Fi da sede ou 4G na estrada), com retentativa idempotente.

### 2. Painel Web (escritório / usina)

- **Mapa de calor georreferenciado** — pontos verde/amarelo/vermelho por faixa
  de captura, heatmap por talhão e fazenda, filtro por período.
- **Gerador de malha cartográfica** — desenho de talhões e limites direto no
  navegador (polígonos) para quem não tem shapefile/KML; importação de
  KML/GeoJSON/SHP para quem tem.
- **Controle de troca de feromônio** — status em tempo real das armadilhas
  próximas do vencimento de 30 dias, com alerta por WhatsApp/e-mail.
- **Relatórios automatizados** — laudo técnico em PDF com fotos, mapa de calor
  e gráfico de evolução temporal, por fazenda/talhão/período.

### 3. API + Banco geoespacial

- PostgreSQL + PostGIS no Hetzner (Docker), API em TypeScript.
- Endpoints de sincronização em lote (push/pull) com resolução de conflito por
  `updated_at` e chave idempotente por dispositivo.
- Armazenamento de fotos em objeto (Cloudflare R2) com URL assinada.

## Decisões de plataforma

| Decisão | Escolha | Motivo |
| --- | --- | --- |
| Mobile | **Expo / React Native**, Android + iPhone desde o piloto (mesmo código, EAS Build) | Celular de campo é Android básico; agrônomos/gerência usam iPhone — cliente confirmou os dois em 27/08/2026 |
| Mapa offline | **MapLibre GL Native** com tiles MBTiles baixados por fazenda | Livre de custo por visualização, funciona sem rede |
| Banco local | **SQLite (expo-sqlite)** com fila de sync | Simples, confiável, sem servidor no aparelho |
| Backend | **Route handlers do Next.js** + `pg` + PostGIS (API dentro do painel) | Um só processo Node no CX23 de 4 GB; extraível para serviço próprio depois |
| Painel | **Next.js** + MapLibre GL JS + Recharts | Padrão dos demais sites da Avila Ops |
| PDF | Renderização server-side (Playwright) do mesmo componente do painel | Um único layout para tela e laudo |
| Hospedagem | Docker no **Hetzner**, Cloudflare só DNS/proxy/CDN/R2 | Padrão do workspace |
| Automação | **n8n** para alertas de septo, disparo de laudo e follow-up comercial | Padrão do workspace |

> **Decidido em 27/08/2026 — Android + iPhone no piloto.** O cliente confirmou
> que o piloto precisa dos dois. Android sai primeiro (APK distribuído direto ou
> Play Store interno) e o iOS vem do mesmo código via EAS Build — exige conta
> Apple Developer e build na nuvem (não há build iOS em Windows). Ver etapa 6 do
> [ROADMAP](ROADMAP.md).

## Estrutura do repositório

```text
migdolus.avilaops.com/
├── README.md            ← este arquivo
├── ARQUITETURA.md       ← modelo de dados, sync offline, GPS, mapa de calor, PDF
├── ROADMAP.md           ← fases de entrega
├── COMERCIAL.md         ← planos, precificação e prospecção
├── docs/
│   ├── blueprint.md     ← blueprint original do cliente (v2, com GPS e contador de dias)
│   └── agronomia.md     ← referência técnica do Migdolus e das armadilhas
├── apps/
│   ├── campo/           ← app mobile (Expo SDK 57 + MapLibre + SQLite)
│   └── painel/          ← painel web **e API** (Next.js 16, route handlers em src/app/api)
├── db/
│   └── schema.sql       ← esquema PostGIS inicial
├── n8n/                 ← fluxos (alerta de septo, laudo, prospecção)
└── deploy/              ← docker-compose, Caddyfile, setup-db.sh, deploy.sh, cloudflare-dns.mjs
```

## Como começar (dev)

```bash
# banco local com PostGIS (qualquer Postgres 16+ com a extensão)
psql "$DATABASE_URL" -f db/schema.sql

# painel + API
cd apps/painel && npm i && npm run dev

# app de campo
cd apps/campo && npm i && npx expo start
```

Variáveis de ambiente: copie `.env.example` para `.env` (nunca versionar `.env`;
em produção o serviço lê `/etc/avilaops/migdolus.env`).
