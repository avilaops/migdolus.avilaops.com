# App Campo — Migdolus Monitor (Expo SDK 57 / React Native)

Aplicativo do pragueiro. **Offline-first**, Android primeiro, iOS pelo mesmo
código (EAS Build). Fala com `https://migdolus.avilaops.com/api`.

## Estado (21/08/2026)

Código completo e tipado (`npm run typecheck` limpo, `expo-doctor` 21/21).
**Ainda não gerou APK** — próximo passo é `npx eas init` + `eas build -p android --profile preview`.

## Telas

| Rota | O que faz |
| --- | --- |
| `entrar` | E-mail/senha → JWT + refresh no SecureStore; funciona offline após o 1º login |
| `(tabs)/index` | Minhas armadilhas: ordenadas por distância, badge do septo (verde/amarelo/vermelho), última contagem, filtros "trocar septo" / "a instalar", busca por código |
| `(tabs)/mapa` | MapLibre com satélite (estilo servido pela API), talhões, pontos coloridos por infestação e borda pelo septo, posição do usuário; **download do mapa offline** da área (zoom 12–17) via `OfflineManager` |
| `(tabs)/sync` | Fila pendente, enviar agora, último envio, erros por item, sair do aparelho |
| `armadilha/nova` | Instalar: GPS automático (aguarda ≤ 10 m por 15 s), fazenda/talhão, código sugerido, finalidade, lote do septo, foto carimbada; ou **confirmar ponto planejado** (`?planejada=<id>`) |
| `armadilha/[id]` | Localizador (distância + seta de rumo), última contagem, dias do septo, histórico, galeria de fotos, abrir no app de mapas |
| `vistoria/[armadilhaId]` | Teclado numérico, densidade adultos/armadilha/dia, toggle de troca de septo (sugerido quando vencendo), observações, foto da bacia com carimbo |

## Como funciona por dentro

- `src/db.ts` — SQLite (`expo-sqlite`): `fazenda`, `talhao`, `armadilha`, `ciclo`, `vistoria`, `foto`, `outbox`, `config`. Toda escrita enfileira no `outbox`.
- `src/sync.ts` — `POST /sync/push` (lote idempotente por `client_id`), upload de fotos multipart, `GET /sync/pull?since=` incremental; alteração local pendente vence sobre o pull.
- `src/gps.ts` — `watchPosition` até precisão alvo; haversine e rumo para o localizador.
- `src/foto.tsx` — `expo-camera` + `react-native-view-shot`: o carimbo (código, data/hora, coordenadas, precisão) é gravado **na imagem**.
- `src/api.ts` — fetch com Bearer, refresh automático em 401.
- `src/sessao.tsx` — contexto de login; `device_id` estável por aparelho.

## Rodar

```bash
npm install
npx expo run:android          # dev build (MapLibre não roda no Expo Go)
npm run typecheck
```

## Build de campo (APK)

```bash
npx eas init                                  # grava o projectId em app.json
eas build -p android --profile preview        # APK para instalar direto
```

`eas.json` já tem os perfis `preview` (APK interno) e `production` (AAB).
