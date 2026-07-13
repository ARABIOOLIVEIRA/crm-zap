import { NextResponse } from "next/server";

/**
 * Proxy (Middleware) do Next.js 16.
 * Verifica o cookie de sessão __session assinado com HMAC-SHA256 URL-safe.
 */

function b64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - str.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function b64urlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function verificarTokenSessao(token) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;

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

    if (!valido) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    const agora = Math.floor(Date.now() / 1000);
    if (payload.exp < agora) return null;

    return payload;
  } catch {
    return null;
  }
}

function extrairSessionCookie(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx > -1) {
      const key = part.substring(0, eqIdx).trim();
      if (key === "__session") return part.substring(eqIdx + 1).trim();
    }
  }
  return null;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const isPainelRoute = pathname.startsWith("/painel");
  const isAuthRoute = pathname === "/login";
  const isSetupRoute = pathname === "/setup";
  const isEvolutionApi = pathname.startsWith("/api/evolution");

  const sessionCookie = extrairSessionCookie(request);

  // ─── SETUP: sempre acessível ──────────────────────────────────────────────
  if (isSetupRoute) {
    return NextResponse.next();
  }

  // ─── EVOLUTION API: bypass authentication, let route handlers manage it ────────
  if (isEvolutionApi) {
    return NextResponse.next();
  }

  // ─── ROTA PROTEGIDA (/painel/*) ──────────────────────────────────────────
  if (isPainelRoute) {
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const sessao = await verificarTokenSessao(sessionCookie);
    if (!sessao) {
      console.warn(`[Proxy] Sessão inválida ou expirada para ${pathname}`);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set("__session", "", { maxAge: 0, path: "/" });
      return response;
    }

    return NextResponse.next();
  }

  // ─── LOGIN: redireciona para painel se já autenticado ────────────────────
  if (isAuthRoute && sessionCookie) {
    const sessao = await verificarTokenSessao(sessionCookie);
    if (sessao) {
      return NextResponse.redirect(new URL("/painel/campanhas", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/login", "/setup", "/api/evolution/:path*"],
};
