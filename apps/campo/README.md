# App Campo — Migdolus Monitor (Expo / React Native)

Aplicativo do pragueiro. **Offline-first**, Android primeiro, iOS pelo mesmo
código (EAS Build).

## Telas (MVP — etapa 1 do roadmap)

| Tela | O que faz |
|---|---|
| Login | E-mail/senha → JWT; guarda refresh token; funciona offline após o 1º login |
| Minhas armadilhas | Lista ordenada por distância, badge de septo (verde/amarelo/vermelho), última contagem |
| Mapa | MapLibre com tiles offline da fazenda, pontos das armadilhas, bússola/distância até a selecionada |
| Instalar armadilha | Código (sugerido pela malha planejada), GPS automático (aguarda precisão ≤ 10 m), foto, septo inicial |
| Vistoria | Teclado numérico (adultos), foto carimbada, troca de septo (sim/não), observações; densidade calculada na hora |
| Sincronização | Fila pendente, último envio, botão "enviar agora", download do pacote de mapa |

## Stack prevista

- `expo` (SDK atual), `expo-router`, TypeScript
- `expo-location` (GPS), `expo-camera` + `expo-image-manipulator` (foto + carimbo)
- `expo-sqlite` (banco local + outbox), `expo-file-system` (fotos e MBTiles)
- `@maplibre/maplibre-react-native` (mapa offline)
- `expo-notifications` (aviso local de septo aos 20/30 dias)
- `expo-task-manager` + `expo-background-fetch` (sync em segundo plano quando houver rede)

## Inicialização (quando for implementar)

```bash
npx create-expo-app@latest . --template tabs
npx expo install expo-location expo-camera expo-sqlite expo-file-system expo-notifications
npm i @maplibre/maplibre-react-native
```

Build Android de campo: `eas build -p android --profile preview` (APK direto) —
ver `eas.json` quando criado.
