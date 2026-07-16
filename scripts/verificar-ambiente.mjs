import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const AMBIENTES = {
  development: {
    label: "Desenvolvimento",
    projectId: "lumio-crm-dev",
  },
  staging: {
    label: "Teste",
    projectId: "lumio-crm-staging",
  },
  production: {
    label: "Oficial",
    projectId: "lumio-crm-prod",
  },
};

const aliasesAntigosBloqueados = [
  "chama-no-zap",
  "sistema-lumio",
];

function carregarEnvLocal() {
  const arquivos = [".env.local", ".env"];
  for (const arquivo of arquivos) {
    const caminho = resolve(process.cwd(), arquivo);
    if (!existsSync(caminho)) continue;
    const linhas = readFileSync(caminho, "utf8").split(/\r?\n/);
    for (const linha of linhas) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#") || !limpa.includes("=")) continue;
      const [chave, ...partesValor] = limpa.split("=");
      if (!chave || process.env[chave]) continue;
      process.env[chave] = partesValor.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

carregarEnvLocal();

const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "";
const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "";

function falhar(mensagem) {
  console.error(`\n[ambiente] ${mensagem}\n`);
  process.exit(1);
}

if (!publicProjectId) {
  falhar("NEXT_PUBLIC_FIREBASE_PROJECT_ID nao informado.");
}

if (!adminProjectId) {
  falhar("FIREBASE_ADMIN_PROJECT_ID nao informado.");
}

for (const antigo of aliasesAntigosBloqueados) {
  if (publicProjectId.includes(antigo) || adminProjectId.includes(antigo)) {
    falhar(`Projeto antigo bloqueado detectado: "${antigo}". Use somente ${Object.values(AMBIENTES).map((item) => item.projectId).join(", ")}.`);
  }
}

if (!appEnv) {
  falhar("NEXT_PUBLIC_APP_ENV nao informado. Use development, staging ou production.");
}

const esperado = AMBIENTES[appEnv];

if (!esperado) {
  falhar(`Ambiente "${appEnv}" invalido. Use development, staging ou production.`);
}

if (publicProjectId !== esperado.projectId || adminProjectId !== esperado.projectId) {
  falhar(`Ambiente ${esperado.label} deve usar o Firebase "${esperado.projectId}". Atual: public=${publicProjectId}, admin=${adminProjectId}.`);
}

console.log(`[ambiente] OK: ${esperado.label} usando ${esperado.projectId}.`);
