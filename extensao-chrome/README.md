# CRM ZAP Importador

Extensao Chrome MV3 para ler e importar manualmente a conversa aberta do WhatsApp Web.

## O que ela faz

- Detecta a conversa aberta.
- Bloqueia importacao de grupos nesta versao.
- Le nome do contato e mensagens carregadas na tela.
- Mostra uma tela de validacao antes do envio.
- Permite editar contato, empresa, numero, nicho e observacoes.
- Permite selecionar/desmarcar mensagens.
- Valida dados na API do CRM.
- Importa somente depois da confirmacao manual.
- Deduplica mensagens no backend por hash.

## O que ela nao faz

- Nao envia mensagens.
- Nao responde mensagens.
- Nao clica automaticamente.
- Nao navega entre conversas.
- Nao rola a conversa automaticamente.
- Nao importa grupos.
- Nao varre contatos.
- Nao escreve direto no Firebase.

## Como instalar

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `extensao-chrome`.
5. Recarregue a extensao no Chrome se ela ja estava instalada.
6. Abra ou recarregue `https://web.whatsapp.com`.
7. Clique no icone da extensao para abrir o painel lateral.
8. Configure:
   - URL do CRM: `https://crm-zap-five.vercel.app`
   - Token: valor de `EXTENSION_IMPORT_SECRET` ou `ADMIN_SECRET`
9. Clique em `Ler conversa aberta`.
10. Revise os dados.
11. Clique em `Validar dados`.
12. Clique em `Enviar para o CRM`.

## Arquivos principais

- `manifest.json`
- `background.js`
- `sidepanel.html`
- `sidepanel.js`
- `selectors.js`
- `contact-reader.js`
- `conversation-reader.js`
- `normalizer.js`
- `validator.js`
- `api-client.js`
- `storage.js`
