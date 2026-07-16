# Sistema Lumio

Sistema interno da Lumio para evoluir o CRM comercial e, futuramente, centralizar clientes, recepção, agendamentos, fichas digitais de gravação, assinatura e documentos.

## Ambientes

Este projeto não deve reutilizar Firebase antigo ou banco de outro projeto.

- Desenvolvimento: `lumio-crm-dev`
- Teste: `lumio-crm-staging`
- Oficial: `lumio-crm-prod`

Leia [docs/AMBIENTES.md](docs/AMBIENTES.md) antes de configurar deploy, Firebase ou Vercel.

## Configuração Local

Copie um dos exemplos abaixo para `.env.local` e preencha as chaves reais fora do Git:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Antes de build/deploy:

```bash
npm run check:env
npm run lint
npm run build
```

## Desenvolvimento

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
