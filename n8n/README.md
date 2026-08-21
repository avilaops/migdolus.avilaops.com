# Fluxos n8n — Migdolus Monitor

Todo serviço vira fluxo no n8n, integrado com Twilio (WhatsApp/SMS) e e-mail.

| Fluxo (arquivo) | Gatilho | O que faz |
|---|---|---|
| `alerta-septo.json` | Webhook da API (`/alertas/septo/varrer`, cron 07:00) | WhatsApp/e-mail ao pragueiro e ao gestor com a lista de armadilhas em `aviso` (20 d) e `critico` (30 d), link para o mapa |
| `laudo-semanal.json` | Cron segunda 06:00 | Gera o PDF via API e envia ao contato da usina; registra no Todoist se houver talhão em nível alto |
| `resumo-sync.json` | Webhook `sync/push` | Resumo diário por pragueiro (vistorias, fotos pendentes, armadilhas sem vistoria há > 7 dias) |
| `prospeccao-usinas.json` | Manual / planilha | Sequência de prospecção para usinas e consultorias: e-mail com laudo de exemplo → WhatsApp (Twilio) → convite para piloto; follow-ups no Todoist |

Os JSONs serão exportados do n8n quando os fluxos forem criados (etapa 5 do roadmap).
