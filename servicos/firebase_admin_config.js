import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("[firebase_admin_config] Credenciais administrativas do Firebase nao configuradas.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminDb() {
  return getFirestore(getAdminApp());
}

function getAdminAuth() {
  return getAuth(getAdminApp());
}

class LazyAdminDb {
  collection(...args) {
    return getAdminDb().collection(...args);
  }

  doc(...args) {
    return getAdminDb().doc(...args);
  }

  batch(...args) {
    return getAdminDb().batch(...args);
  }

  runTransaction(...args) {
    return getAdminDb().runTransaction(...args);
  }
}

class LazyAdminAuth {
  createUser(...args) {
    return getAdminAuth().createUser(...args);
  }

  deleteUser(...args) {
    return getAdminAuth().deleteUser(...args);
  }

  getUserByEmail(...args) {
    return getAdminAuth().getUserByEmail(...args);
  }

  listUsers(...args) {
    return getAdminAuth().listUsers(...args);
  }

  setCustomUserClaims(...args) {
    return getAdminAuth().setCustomUserClaims(...args);
  }

  updateUser(...args) {
    return getAdminAuth().updateUser(...args);
  }

  verifyIdToken(...args) {
    return getAdminAuth().verifyIdToken(...args);
  }

  verifySessionCookie(...args) {
    return getAdminAuth().verifySessionCookie(...args);
  }

  revokeRefreshTokens(...args) {
    return getAdminAuth().revokeRefreshTokens(...args);
  }
}

const adminDb = new LazyAdminDb();
const adminAuth = new LazyAdminAuth();

function b64urlDecode(str) {
  const padded =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function verificarSessaoAdmin(request) {
  const cookies = {};
  const cookieHeader = request.headers.get("cookie") || "";

  cookieHeader.split(";").forEach((cookie) => {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx > -1) {
      cookies[cookie.substring(0, eqIdx).trim()] = cookie
        .substring(eqIdx + 1)
        .trim();
    }
  });

  const sessionCookie = cookies["__session"];
  if (!sessionCookie) {
    throw new Error("Nao autorizado: Sessao administrativa ausente.");
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("Nao autorizado: ADMIN_SECRET nao configurado.");
  }

  const partes = sessionCookie.split(".");
  if (partes.length !== 2) {
    throw new Error("Nao autorizado: Token de sessao invalido.");
  }

  const [payloadB64, sigB64] = partes;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = b64urlDecode(sigB64);
    const dataBytes = new TextEncoder().encode(payloadB64);
    const valido = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);

    if (!valido) {
      throw new Error("Nao autorizado: Assinatura do token invalida.");
    }

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadB64))
    );
    const agora = Math.floor(Date.now() / 1000);
    if (payload.exp < agora) {
      throw new Error("Nao autorizado: Sessao expirada.");
    }

    return {
      uid: payload.uid,
      email: payload.email,
      claims: { admin: true },
    };
  } catch (err) {
    throw new Error(
      err.message || "Nao autorizado: Falha na validacao da sessao."
    );
  }
}

function sanitizarDadosAuditoria(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  const chavesSensiveis = [
    "password",
    "senha",
    "token",
    "apikey",
    "private_key",
    "secret",
    "privateKey",
    "cookie",
    "session",
    "credential",
    "auth",
    "gemini_api_key",
    "whatsapp_key",
    "evolution_api_key",
    "EVOLUTION_API_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "VERCEL_OIDC_TOKEN",
  ];

  const limpar = (target) => {
    for (const key in target) {
      if (chavesSensiveis.some((s) => key.toLowerCase().includes(s))) {
        target[key] = "[REDUZIDO_POR_SEGURANCA]";
      } else if (typeof target[key] === "object" && target[key] !== null) {
        limpar(target[key]);
      }
    }
  };

  limpar(clone);
  return clone;
}

export async function registrarAuditoria(
  adminUser,
  acao,
  recurso,
  recursoId,
  valoresAnteriores = null,
  valoresNovos = null,
  request = null
) {
  try {
    const logRef = adminDb.collection("auditoria_administrativa").doc();

    let ip = "unknown";
    let requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    if (request) {
      ip =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown";
      if (ip.includes(",")) ip = ip.split(",")[0].trim();
      requestId = request.headers.get("x-request-id") || requestId;
    }

    const log = {
      id: logRef.id,
      administrador_uid: adminUser.uid,
      administrador_email: adminUser.email,
      acao,
      recurso,
      recurso_id: recursoId,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      valores_anteriores: sanitizarDadosAuditoria(valoresAnteriores),
      valores_novos: sanitizarDadosAuditoria(valoresNovos),
      ip,
    };

    await logRef.set(log);
  } catch (err) {
    console.error("[Auditoria] Falha ao registrar log:", err.message);
  }
}

export async function verificarRateLimit(ip, emailNormalizado) {
  const agora = new Date();
  const emailSanitizado = (emailNormalizado || "anonimo").toLowerCase().trim();
  const ipNormalizado = ip || "unknown";

  const chave = `rl_${Buffer.from(`${ipNormalizado}:${emailSanitizado}`).toString("hex")}`;
  const docRef = adminDb.collection("rate_limits").doc(chave);

  try {
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      let expiresAt;
      if (data.expires_at && typeof data.expires_at.toDate === "function") {
        expiresAt = data.expires_at.toDate();
      } else {
        expiresAt = new Date(data.expires_at);
      }

      if (agora < expiresAt) {
        if (data.attempts >= 5) {
          return { permitido: false, bloqueadoAte: expiresAt };
        }
        await docRef.update({ attempts: FieldValue.increment(1) });
      } else {
        const novaExpiracao = new Date(agora.getTime() + 60 * 1000);
        await docRef.set({
          ip: ipNormalizado,
          email: emailSanitizado,
          attempts: 1,
          expires_at: novaExpiracao.toISOString(),
        });
      }
    } else {
      const expiracao = new Date(agora.getTime() + 60 * 1000);
      await docRef.set({
        ip: ipNormalizado,
        email: emailSanitizado,
        attempts: 1,
        expires_at: expiracao.toISOString(),
      });
    }

    return { permitido: true, bloqueadoAte: null };
  } catch (err) {
    console.error("[RateLimit] Erro no Firestore:", err.message);
    return { permitido: true, bloqueadoAte: null };
  }
}

export async function resetarRateLimit(ip, emailNormalizado) {
  const emailSanitizado = (emailNormalizado || "anonimo").toLowerCase().trim();
  const ipNormalizado = ip || "unknown";
  const chave = `rl_${Buffer.from(`${ipNormalizado}:${emailSanitizado}`).toString("hex")}`;
  const docRef = adminDb.collection("rate_limits").doc(chave);
  try {
    await docRef.delete();
  } catch (e) {
    // Ignora silenciosamente.
  }
}

export { adminAuth, adminDb };

