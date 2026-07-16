# Ambientes Do Sistema Lumio

Este projeto deve nascer separado por ambientes. Não reutilizar Firebase antigo, Vercel antigo ou banco de outro projeto.

## Ambientes

| Ambiente | Nome visual | Firebase Project ID | Uso |
| --- | --- | --- | --- |
| Desenvolvimento | Desenvolvimento | `lumio-crm-dev` | Testes locais, refatorações, módulos novos e dados fictícios. |
| Teste | Teste | `lumio-crm-staging` | Homologar antes de ir para o oficial. Pode ter dados de exemplo ou amostras controladas. |
| Oficial | Oficial | `lumio-crm-prod` | Dados reais da Lumio. Não testar mudança direto aqui. |

## Regras

1. Produção não compartilha Firebase com teste.
2. Produção não compartilha Storage com teste.
3. Produção não compartilha service account com teste.
4. Staging não deve receber massa completa de dados reais.
5. Desenvolvimento pode quebrar, mas nunca aponta para `lumio-crm-prod`.
6. Módulos novos entram primeiro em desenvolvimento, depois teste, depois oficial.

## Vercel

Criar projetos/ambientes separados na Vercel:

| Ambiente | Vercel |
| --- | --- |
| Oficial | Projeto ou branch de produção ligado a `lumio-crm-prod` |
| Teste | Preview/staging ligado a `lumio-crm-staging` |
| Desenvolvimento | Local com `.env.local` ligado a `lumio-crm-dev` |

## Variáveis

Use os arquivos:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Copie o exemplo correto para o ambiente correto e preencha as chaves reais apenas fora do Git.

## Antes de publicar

Rode:

```bash
npm run check:env
npm run lint
npm run build
```

## Próxima fase do produto

Quando os ambientes estiverem seguros, os novos módulos devem seguir esta ordem:

1. Clientes centralizados.
2. Recepção e agendamentos.
3. Fichas digitais de gravação.
4. Assinatura digital.
5. Geração de documento para impressão.
6. Armazenamento redundante das fichas.
