# ZapPulse — painel de prospecção WhatsApp

Painel + motor de disparo. O servidor é a fonte da verdade: tudo fica em `data/db.json`
e o worker roda no servidor, mesmo com o navegador fechado.

## Rodar

```bash
npm install
cp .env.example .env        # ajuste PANEL_PASSWORD, etc.
npm run dev                 # desenvolvimento (http://localhost:3000)
# produção:
npm run build && npm start
```

Use um servidor que fique ligado (VPS). O worker só envia enquanto o processo estiver rodando.

## Como conectar um chip (3 provedores)

| Provedor | Quando usar |
|---|---|
| **Direto no WhatsApp (Baileys)** — padrão | Não precisa de Evolution. Cadastre o chip, leia o QR Code. A sessão fica em `data/baileys/`. |
| **Evolution API** | Se você já tem a Evolution. Configure URL + chave global (botão "Evolution API"). |
| **Modo teste** | Nada é enviado ao WhatsApp. Serve para validar lotes, templates, limites e inbox. |

Cada chip tem o seu provedor, então dá para migrar aos poucos.

## Fluxo

1. **Chips**: cadastre, leia o QR, deixe em *Warming* (aquecimento automático entre seus chips, precisa de ≥2 chips online e um template de aquecimento) e promova para *Ativo*.
2. **Campanhas → Templates**: crie um template de prospecção. Spintax `{Olá|Oi}` e variáveis `{{name}}`, `{{first_name}}`, `{{city}}`, `{{company}}`.
3. **Criar lote** (nasce pausado) → importe o CSV (Nome, Cidade, Telefone, Empresa) → **ative**.
4. O worker envia 1 mensagem por intervalo (±jitter), alternando chips ativos e online.
5. **Inbox**: respostas chegam sozinhas (Baileys direto; Evolution via webhook). "PARAR/SAIR" etc. bloqueia o número em todos os lotes.

### Proteções do motor
- limite por hora **e** por dia por chip; rodízio pelo chip menos usado;
- janela de horário/dias da semana (Configurações → padrão seg–sáb 08–20h);
- "digitando…" proporcional ao tamanho da mensagem; intervalo com variação aleatória;
- número sem WhatsApp → lead marcado como falho, sem punir o chip;
- 3 falhas seguidas → chip em pausa de 10 min; 3 tentativas por lead;
- deduplicação por telefone (tolera o 9º dígito) e bloqueio de opt-out.

## Evolution fora do ar?
Crie o chip como **Direto no WhatsApp**, ou troque o provedor padrão em *Configurações*. O painel mostra o erro real da Evolution (timeout, HTTP 502…) no chip em vez de falhar em silêncio.

## Segurança
- Defina `PANEL_PASSWORD` (Basic Auth). Webhooks usam `?token=` próprio.
- Faça backup de `data/` (contém os leads e as sessões do WhatsApp).
- Prospecção em massa viola os termos do WhatsApp e pode causar banimento: use apenas contatos que tenham base legal (LGPD), com opt-out, volumes baixos e chips aquecidos.

## Testes
`npm test` roda o motor com o provedor de teste e a integração Evolution contra um servidor falso.
