# Roadmap — Migdolus Monitor

| Etapa | Entrega | Critério de pronto |
|---|---|---|
| **0. Fundação** | Repositório, esquema PostGIS, docker-compose no Hetzner, DNS `migdolus.avilaops.com` no padrão avilaops.com | `docker compose up` sobe banco + API + painel vazio em produção |
| **1. App Campo — mínimo de campo** | Cadastro de armadilha com GPS, vistoria com contagem + foto carimbada, SQLite + fila de sync, lista "minhas armadilhas" com dias de septo | Pragueiro trabalha um dia inteiro sem rede e sincroniza à noite |
| **2. API de sync + painel básico** | `/sync/push`/`/pull`, login, mapa com pontos por status, tabela de armadilhas, status de septo | Escritório vê no mesmo dia o que foi coletado no campo |
| **3. Mapa offline + localizador** | Pacote MBTiles por fazenda, mapa no app, bússola/distância até a armadilha | Pragueiro acha armadilha em talhão de 50 ha sem ajuda |
| **4. Malha cartográfica + heatmap** | Editor de talhões (desenho + importação KML/GeoJSON/SHP), gerador de malha de 30 m para coleta massal, heatmap ponderado, IDW por talhão | Usina sem shapefile monta a fazenda inteira e a malha de armadilhas no navegador |
| **5. Laudo PDF + alertas n8n** | PDF automático por período, comparativo entre safras, WhatsApp/e-mail de septo vencendo, resumo semanal | Laudo sai sem tocar no Excel; ninguém perde troca de septo |
| **6. iOS + Play Store** | Build iOS via EAS, publicação interna nas lojas, atualização OTA | Agrônomo com iPhone usa o mesmo app |
| **7. Comercial** | Planos no portal `cliente.avilaops.com`, checkout PayPal/Mercado Pago/Éfi, fluxo de prospecção n8n para usinas e consultorias | Primeira usina pagante fora do piloto |

Piloto sugerido: **1 usina ou consultoria, 2 pragueiros, ~100 armadilhas, uma
safra de monitoramento (nov–mai)** — suficiente para validar sync, GPS, a curva
de revoada e o laudo.
