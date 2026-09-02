# Fluxos n8n: Migdolus Monitor

Todo serviço vira fluxo no n8n (`https://n8n.avilaops.com`), integrado com SMTP e Twilio.

| Fluxo | Onde | Gatilho | O que faz | Estado |
| --- | --- | --- | --- | --- |
| **Alerta diário de troca de septo** | [vo4IUcpxOXXuqmHK](https://n8n.avilaops.com/workflow/vo4IUcpxOXXuqmHK) | Schedule 07:05 | `GET /api/alertas/septo` (header `x-alertas-token`) → uma mensagem por organização → **e-mail** (SMTP) aos gestores/agrônomos → um item por contato → **WhatsApp** (Twilio) para quem tem telefone | Criado em 21/08/2026; **não publicado**, faltam as credenciais abaixo |
| Laudo semanal | - | Cron segunda 06:00 | Gera/abre o laudo (`/laudo?fazenda&de&ate`) e envia ao contato da usina | a criar (depende do PDF server-side) |
| Resumo de sync | - | Webhook `sync/push` | Resumo diário por pragueiro (vistorias, fotos pendentes, armadilhas sem vistoria há > 7 dias) | a criar |
| Prospecção de usinas | - | Manual / planilha | E-mail com laudo de exemplo → WhatsApp (Twilio) → convite para piloto; follow-ups no Todoist | a criar |

## Para publicar o alerta de septo

1. Em n8n › Credentials, criar **Header Auth** chamada `Migdolus Alertas (x-alertas-token)`:
   nome do header `x-alertas-token`, valor = `ALERTAS_TOKEN` de `/etc/avilaops/migdolus.env` no Hetzner
   (`grep ALERTAS_TOKEN /etc/avilaops/migdolus.env`).
2. Selecionar essa credencial no nó "Buscar septos vencendo (API Migdolus)".
3. (Opcional) Criar credencial **Twilio** e preencher o número remetente no nó "WhatsApp (Twilio)";
   sem isso o ramo de WhatsApp falha em silêncio (`continueRegularOutput`) e só o e-mail sai.
4. Ajustar o remetente do e-mail se não for `nicolas@avilaops.com`.
5. Publicar (ativar) o workflow.

A API (`apps/painel/src/app/api/alertas/septo/route.ts`) já devolve, por organização,
as armadilhas em `aviso`/`critico`, os contatos e a **mensagem pronta**, o fluxo só encaminha.
