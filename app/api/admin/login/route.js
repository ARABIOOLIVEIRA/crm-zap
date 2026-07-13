import { NextResponse } from "next/server";
import { adminAuth } from "@/servicos/firebase_admin_config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Route Handler para login administrativo.
 *
 * Valida o Firebase ID Token com Firebase Admin Auth e cria uma sessao
 * administrativa HMAC compativel com proxy.js e verificarSessaoAdmin().
 */
function b64urlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function criarTokenSessao(uid, email, expiresAt) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET nao configurado.");

  const payloadJson = JSON.stringify({ uid, email, exp: expiresAt });
  const payloadB64 = b64urlEncode(new TextEncoder().encode(payloadJson));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = b64urlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

function obterEmailsAdmin() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ status: "error", message: "Formato invalido." }, { status: 400 });
    }

    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.host !== host) {
        return NextResponse.json({ status: "error", message: "Origem nao autorizada." }, { status: 403 });
      }
    }

    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ status: "error", message: "Token ausente." }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email = decoded.email;

    const adminEmails = obterEmailsAdmin();
    if (adminEmails.length === 0) {
      console.error("[Login] ADMIN_EMAILS nao configurado.");
      return NextResponse.json(
        { status: "error", message: "Autorizacao administrativa nao configurada." },
        { status: 500 }
      );
    }

    if (!email || !adminEmails.includes(email.toLowerCase())) {
      console.warn("[Login] E-mail autenticado sem permissao administrativa.");
      return NextResponse.json(
        { status: "error", message: "Credenciais incorretas ou acesso nao autorizado." },
        { status: 401 }
      );
    }

    const expiresIn = 60 * 60 * 24 * 5;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const sessionToken = await criarTokenSessao(uid, email, expiresAt);

    const response = NextResponse.json({ status: "success", message: "Autenticado com sucesso." });

    response.cookies.set("__session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });

    console.log(`[Login] Admin autenticado de IP: ${ip}`);
    return response;
  } catch (error) {
    console.error(`[Login] Falha de autenticacao de ${ip}:`, error.code || error.message);
    return NextResponse.json(
      { status: "error", message: "Credenciais incorretas ou acesso nao autorizado." },
      { status: 401 }
    );
  }
}
