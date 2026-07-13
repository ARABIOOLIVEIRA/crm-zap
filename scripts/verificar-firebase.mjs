import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ADMIN_EMAIL = "adm@gmail.com";

function carregarEnv(caminho) {
  try {
    const conteudo = readFileSync(caminho, "utf8");
    for (const linha of conteudo.split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const idx = limpa.indexOf("=");
      if (idx === -1) continue;
      const chave = limpa.slice(0, idx).trim();
      let valor = limpa.slice(idx + 1);
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
      if (process.env[chave] === undefined) {
        process.env[chave] = valor;
      }
    }
  } catch {
    // Arquivo opcional.
  }
}

carregarEnv(resolve(process.cwd(), ".env.local"));

function statusEnv(nome) {
  const valor = process.env[nome];
  if (valor === undefined) return "ausente";
  if (String(valor).trim() === "") return "vazia";
  return "presente";
}

function exigir(nome) {
  const status = statusEnv(nome);
  if (status !== "presente") {
    throw new Error(`${nome} ${status}`);
  }
}

async function verificarProvedorEmailSenha() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return "nao verificado: NEXT_PUBLIC_FIREBASE_API_KEY ausente";

  const resposta = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "verificacao-email-password-nao-existe@example.invalid",
        password: "senha-dummy-nao-usada",
        returnSecureToken: true,
      }),
    }
  );

  const body = await resposta.json().catch(() => ({}));
  const message = body?.error?.message || "";

  if (message.includes("EMAIL_NOT_FOUND") || message.includes("INVALID_LOGIN_CREDENTIALS")) {
    return "habilitado";
  }
  if (message.includes("OPERATION_NOT_ALLOWED")) {
    return "desabilitado";
  }
  return `nao conclusivo: ${message || resposta.status}`;
}

async function main() {
  console.log("Verificacao Firebase local");
  for (const nome of [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
    "ADMIN_SECRET",
    "ADMIN_EMAILS",
  ]) {
    console.log(`${nome}: ${statusEnv(nome)}`);
  }

  exigir("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  exigir("NEXT_PUBLIC_FIREBASE_API_KEY");
  exigir("FIREBASE_ADMIN_PROJECT_ID");
  exigir("FIREBASE_ADMIN_CLIENT_EMAIL");
  exigir("FIREBASE_ADMIN_PRIVATE_KEY");
  exigir("ADMIN_SECRET");
  exigir("ADMIN_EMAILS");

  const adminEmails = process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(ADMIN_EMAIL)) {
    throw new Error(`ADMIN_EMAILS nao contem ${ADMIN_EMAIL}`);
  }

  if (process.env.FIREBASE_ADMIN_PROJECT_ID !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_ADMIN_PROJECT_ID diverge de NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });

  const auth = getAuth(app);
  try {
    const user = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`${ADMIN_EMAIL}: existe no Firebase Authentication`);
    console.log(`Usuario desativado: ${user.disabled ? "sim" : "nao"}`);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error(`${ADMIN_EMAIL} nao existe no Firebase Authentication. Crie manualmente no Firebase Console.`);
    }
    throw error;
  }

  const providerStatus = await verificarProvedorEmailSenha();
  console.log(`Provedor Email/Password: ${providerStatus}`);
}

main().catch((error) => {
  console.error(`Falha na verificacao: ${error.message}`);
  process.exit(1);
});