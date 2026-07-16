# Firebase oficial do Lumio CRM

Este arquivo registra os ambientes limpos criados para este sistema.

Importante: estes projetos foram criados do zero para o Lumio CRM. Nao usar projetos antigos como `chama-no-zap`, `sistema-lumio` ou qualquer outro projeto iniciado antes.

## Ambientes

| Ambiente | Uso | Firebase Project ID | Nome no Firebase |
| --- | --- | --- | --- |
| Desenvolvimento | Testes locais e alteracoes em andamento | `lumio-crm-dev` | Lumio CRM Dev |
| Teste | Homologacao antes do oficial | `lumio-crm-staging` | Lumio CRM Teste |
| Oficial | Dados reais da Lumio | `lumio-crm-prod` | Lumio CRM Oficial |

## Apps Web

### Desenvolvimento

- App: `Lumio CRM Dev Web`
- App ID: `1:87342034597:web:4acfbaee88e059581e674c`
- Project ID: `lumio-crm-dev`
- Auth domain: `lumio-crm-dev.firebaseapp.com`
- Storage bucket: `lumio-crm-dev.firebasestorage.app`
- Sender ID: `87342034597`

### Teste

- App: `Lumio CRM Teste Web`
- App ID: `1:1017413533616:web:d35a215a4c15a97322a075`
- Project ID: `lumio-crm-staging`
- Auth domain: `lumio-crm-staging.firebaseapp.com`
- Storage bucket: `lumio-crm-staging.firebasestorage.app`
- Sender ID: `1017413533616`

### Oficial

- App: `Lumio CRM Oficial Web`
- App ID: `1:217220493765:web:25f256da59dba3f0dc9bac`
- Project ID: `lumio-crm-prod`
- Auth domain: `lumio-crm-prod.firebaseapp.com`
- Storage bucket: `lumio-crm-prod.firebasestorage.app`
- Sender ID: `217220493765`

## Bancos Firestore

Os tres bancos Firestore foram criados em `nam5`, no modo `FIRESTORE_NATIVE`, com:

- protecao contra exclusao ativada;
- recuperacao point-in-time ativada;
- bancos separados por ambiente.

| Ambiente | Banco |
| --- | --- |
| Desenvolvimento | `projects/lumio-crm-dev/databases/(default)` |
| Teste | `projects/lumio-crm-staging/databases/(default)` |
| Oficial | `projects/lumio-crm-prod/databases/(default)` |

## Faturamento

A conta de faturamento atual permite poucos projetos vinculados ao mesmo tempo.

Estado final deixado de forma intencional:

- `lumio-crm-prod`: faturamento ativo, por ser o ambiente oficial.
- `lumio-crm-dev`: banco criado e ambiente separado, sem faturamento ativo no momento.
- `lumio-crm-staging`: banco criado e ambiente separado, sem faturamento ativo no momento.

Se no futuro o Google liberar mais limite de faturamento, vincular tambem Dev e Teste. Ate la, nao misturar dados reais neles.

## Authentication

| Ambiente | Email/senha | Observacao |
| --- | --- | --- |
| Desenvolvimento | Ativado | Usuarios admin criados para teste local |
| Teste | Pendente | O Console pediu confirmacao manual do plano Blaze para concluir |
| Oficial | Ativado | Usuarios admin criados para uso real |

O arquivo local `.env.local` aponta para Desenvolvimento.

Os arquivos locais de Teste e Oficial foram guardados com nomes que o Next.js nao carrega automaticamente:

- `.env.lumio-staging.local`
- `.env.lumio-production.local`

Isso evita build local misturando banco de teste com banco oficial.

As senhas temporarias dos usuarios admin foram gravadas somente em `.env.admin-passwords.local`, que fica ignorado pelo Git.

## Trava de seguranca

Os comandos `npm run dev`, `npm run build` e `npm run start` executam a verificacao de ambiente antes de iniciar.

Se o sistema ainda estiver apontando para Firebase antigo ou para o ambiente errado, o comando para imediatamente.
