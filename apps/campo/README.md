# App Campo — Migdolus Monitor (Expo SDK 57 / React Native)

Aplicativo do pragueiro. **Offline-first**, Android + iPhone (cliente confirmou os dois
em 27/08/2026), mesmo código; iOS via EAS Build. Fala com `https://migdolus.avilaops.com/api`.

## Estado (27/08/2026)

Código completo e tipado (`npm run typecheck` limpo, `expo-doctor` 21/21).
**APK gerado em 27/08/2026** (build local, `gradlew assembleRelease`, 10 min, 106 MB, arm64-v8a + x86_64,
versionName 0.1.0): cópia em `dist/migdolus-campo-20260827.apk` (ignorado pelo git) e download em
`https://migdolus.avilaops.com/apk/migdolus-campo.apk` (Caddy serve `/opt/migdolus/apk/`; enviar por scp).
Próximo passo: instalar no celular de campo e validar GPS/offline/sync. iOS: `eas build -p ios` (conta Apple Developer).

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
| `trincheira/nova` | Larvas por trincheira (talhão, contagem, GPS opcional) — sobe no mesmo lote de sync |

Recursos sem tela: **avisos locais** de troca de septo (20/30 dias, agrupados por dia, reagendados a cada sync) e **mapa offline por fazenda**.

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

**Local (sem EAS), como foi feito em 21/08/2026** — máquina Windows com Android SDK em
`C:\devndroid-sdk` e JDK 17 em `C:\dev\jdk17`:

```bash
npx expo prebuild -p android --no-install       # gera android/ (está no .gitignore)
# Windows: o CMake estoura MAX_PATH (260) com o caminho D:vilaops.com\...; use um junction curto
cmd /c mklink /J C:\mc D:vilaops.com\migdolus.avilaops.compps\campo
cd C:\mcndroid && gradlew.bat assembleRelease --no-daemon
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Ajustes já feitos em `android/gradle.properties` (gerado pelo prebuild — refazer após novo prebuild):
`org.gradle.jvmargs=-Xmx1280m` (8 GB de RAM), `org.gradle.parallel=false`, `org.gradle.workers.max=2`,
`reactNativeArchitectures=arm64-v8a,x86_64` (campo + emulador; omite armeabi-v7a/x86).
O MapLibre não roda no Expo Go — precisa deste build (ou `npx expo run:android`).

**EAS (nuvem)**: `npx eas init` + `eas build -p android --profile preview` (`eas.json` já tem
`preview` = APK interno e `production` = AAB). Precisa de `eas login` interativo.
