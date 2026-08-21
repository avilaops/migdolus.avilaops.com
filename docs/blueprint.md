# Blueprint do cliente — v2 (GPS nativo + contador de dias)

> Texto recebido em 21/08/2026, preservado como referência de origem.

## 1. Visão geral atualizada

O sistema integra coleta em campo, geolocalização autônoma (GPS) e painel
analítico web, permitindo atender tanto usinas estruturadas com arquivos de
mapas quanto fazendas sem nenhum histórico cartográfico prévio.

```text
[ App Campo (Offline/GPS) ] ──(Sincronização)──> [ Nuvem / Banco de Dados ] ──> [ Painel Web / Mapas de Calor ]
```

## 2. Aplicativo mobile (operação em campo)

- **Georreferenciamento automático (GPS offline):** registro automático das
  coordenadas exatas (latitude/longitude) no momento da instalação e de cada
  vistoria, mesmo sem sinal de operadora.
- **Localizador de armadilhas no mapa:** mapa interno offline com pontos das
  armadilhas instaladas para orientar o pragueiro a encontrar cada uma em
  talhões extensos.
- **Controle de ciclo e idade da armadilha:** cálculo automático dos dias de
  instalação (aviso aos 20 dias, alerta crítico aos 30 dias para troca do septo
  de feromônio).
- **Registro com foto georreferenciada:** captura da foto da bacia com carimbo
  automático de data, hora e coordenadas para auditoria junto ao cliente/usina.
- **Lançamento rápido de contagem:** digitação simplificada do número de
  adultos capturados com cálculo instantâneo da densidade populacional.

## 3. Painel web e gestão (escritório / usina)

- **Mapa de calor georreferenciado:** visualização espacial das infestações
  (pontos verdes, amarelos e vermelhos) para identificar focos por talhão e
  fazenda.
- **Gerador de malha cartográfica:** criação de talhões e demarcações no
  próprio sistema para usinas sem bases georreferenciadas prontas.
- **Controle de troca de feromônio:** painel de status em tempo real mostrando
  quais armadilhas estão próximas do vencimento de 30 dias.
- **Relatórios automatizados para clientes:** exportação de laudos técnicos em
  PDF com fotos, mapas de calor e gráficos de evolução temporal.

## 4. Matriz de funcionalidades

| Módulo | Funcionalidade principal | Benefício prático |
|---|---|---|
| GPS nativo | Marcação de ponto no ato da instalação | Dispensa mapas prévios da usina e localiza armadilhas no meio do canavial |
| Cronômetro de ciclo | Contagem regressiva para troca de feromônio | Evita perda de atratividade da armadilha por esquecimento de prazo |
| Auditoria visual | Galeria de fotos vinculada ao talhão e data | Comprova o trabalho de campo com transparência para a usina |
| Estatística espacial | Cálculo de média e interpolação de dados | Elimina a necessidade de lançar dados manualmente no Excel |

## Pergunta em aberto

Com a necessidade do GPS e mapas offline no campo, o aplicativo deve rodar em
celulares mais básicos (Android padrão de campo) ou há necessidade de suporte
simultâneo para iPhones? → **Decisão provisória:** Android primeiro, iOS pelo
mesmo código Expo quando necessário (ver README).
