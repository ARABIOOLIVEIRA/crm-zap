import { NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  registrarAuditoria,
  verificarSessaoAdmin,
} from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

const COLECAO = "usuarios_sistema";

function gerarSenhaTemporaria() {
  return `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8)}A1!`;
}

export async function GET(request) {
  try {
    await verificarSessaoAdmin(request);
    const [authUsers, perfisSnap] = await Promise.all([
      adminAuth.listUsers(100),
      adminDb.collection(COLECAO).get(),
    ]);
    const perfis = new Map(perfisSnap.docs.map((doc) => [doc.id, doc.data()]));
    const usuarios = authUsers.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      disabled: user.disabled,
      criado_em: user.metadata?.creationTime || "",
      ultimo_login: user.metadata?.lastSignInTime || "",
      perfil: perfis.get(user.uid)?.perfil || "sem_perfil",
      areas: perfis.get(user.uid)?.areas || [],
    }));
    return NextResponse.json({ status: "success", usuarios });
  } catch (error) {
    console.error("[APIs/Usuarios] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const adminUser = await verificarSessaoAdmin(request);
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ status: "error", message: "E-mail obrigatorio." }, { status: 400 });

    const senhaTemporaria = body.senha || gerarSenhaTemporaria();
    let user;
    let criado = false;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      user = await adminAuth.createUser({
        email,
        password: senhaTemporaria,
        emailVerified: true,
        disabled: false,
      });
      criado = true;
    }

    const perfil = {
      uid: user.uid,
      email,
      nome: body.nome || "",
      perfil: body.perfil || "operacao",
      areas: Array.isArray(body.areas) ? body.areas : [],
      atualizado_em: new Date().toISOString(),
      criado_em: new Date().toISOString(),
    };
    await adminDb.collection(COLECAO).doc(user.uid).set(perfil, { merge: true });
    await adminAuth.setCustomUserClaims(user.uid, {
      areas: perfil.areas,
      perfil: perfil.perfil,
    });
    await registrarAuditoria(adminUser, criado ? "criar_usuario" : "atualizar_usuario", COLECAO, user.uid, null, perfil, request);
    return NextResponse.json({
      status: "success",
      usuario: perfil,
      senha_temporaria: criado ? senhaTemporaria : null,
    });
  } catch (error) {
    console.error("[APIs/Usuarios POST] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}
