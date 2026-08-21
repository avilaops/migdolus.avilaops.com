# Comercial — Migdolus Monitor

## Cliente

- **Usinas e grupos sucroenergéticos** (departamento de fitossanidade / MIP).
- **Consultorias de monitoramento de pragas** que atendem várias usinas e
  fornecedores de cana.
- **Fornecedores de cana / fazendas independentes** sem base cartográfica.

## Argumento de venda (números da bp bioenergy, 3 safras de coleta massal)

| Indicador | Resultado |
|---|---|
| Capturas de *Migdolus* | **−94 %** (352 → 21 machos/armadilha) após 3 safras |
| Larvas no solo | **−87,5 %** (8 → 1 larva/trincheira) |
| Produtividade (TCH, cana de 4º corte) | **+96 %** (26 → 51 t/ha) vs. área sem controle |
| Espaçamento mais eficiente | armadilhas a **30 m** |
| Duração mínima do programa | **3 anos ininterruptos** (ciclo de vida da praga) |

Tradução para o cliente: o programa de coleta massal **dobra a produtividade**
do talhão atacado, mas só funciona se for mantido por três safras com a malha
certa e o feromônio sempre ativo — exatamente o que o sistema garante
(malha de 30 m gerada automaticamente, alerta de troca de septo, comparativo
entre safras para provar o resultado).

## Planos (sempre três)

| | **Campo** (entrada) | **Usina** (o que vendemos) | **Grupo** (âncora) |
|---|---|---|---|
| Armadilhas | até 100 | até 1.000 | ilimitadas |
| Usuários de campo | 2 | 10 | ilimitados |
| Fazendas | 1 | 10 | ilimitadas |
| App offline + GPS | ✔ | ✔ | ✔ |
| Contador de septo + alertas WhatsApp | — | ✔ | ✔ |
| Mapa de calor + IDW | básico (pontos) | ✔ | ✔ |
| Editor de talhões / malha de 30 m / importação SHP | — | ✔ | ✔ |
| Comparativo entre safras (capturas, larvas, TCH) | — | ✔ | ✔ |
| Laudo PDF automático | — | ✔ | ✔ + marca branca |
| Integração (API / n8n / ERP da usina) | — | — | ✔ |
| Suporte | e-mail | WhatsApp comercial | gerente dedicado + SLA |
| Preço sugerido | R$ 390/mês | **R$ 1.490/mês** | R$ 6.900/mês |

Pagamento pelos três gateways do workspace: **PayPal, Mercado Pago e Éfi**.

## Diferenciais a destacar na venda

1. Funciona **sem mapa prévio** — a malha nasce do GPS do próprio pragueiro.
2. **Nenhuma troca de septo esquecida** — o alerta chega no WhatsApp do responsável.
3. **Laudo com foto georreferenciada** — a usina audita sem ir a campo.
4. **Do caderno ao mapa de calor no mesmo dia**, sem Excel.
5. **Prova o retorno**: comparativo safra a safra com os mesmos indicadores da
   pesquisa (machos/armadilha, larvas/trincheira, TCH).

## Prospecção (fluxo n8n `n8n/prospeccao-usinas.json`)

- Base: usinas (UNICA/NovaCana), consultorias de MIP, cooperativas de
  fornecedores de cana em SP, GO, MG, MS, PR.
- Sequência: e-mail com laudo de exemplo → WhatsApp (Twilio) → convite para
  piloto de uma safra com desconto.
- Tarefas e follow-ups registrados no Todoist.
