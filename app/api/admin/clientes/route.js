import { NextResponse } from "next/server";
import {
  adminDb,
  registrarAuditoria,
  verificarSessaoAdmin,
} from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

const COLECAO = "clientes";
const HISTORICO = "historico_cliente";

function normalizarTelefone(valor) {
  const somenteNumeros = String(valor || "").replace(/\D/g, "");
  if (!somenteNumeros) return "";
  return somenteNumeros.startsWith("55") ? somenteNumeros : `55${somenteNumeros}`;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prepararCliente(dados = {}, existente = {}) {
  const agora = new Date().toISOString();
  const whatsapp = normalizarTelefone(dados.whatsapp || dados.telefone || existente.whatsapp);
  const nome = String(dados.nome || existente.nome || "").trim();

  return {
    nome,
    nome_normalizado: normalizarTexto(nome),
    empresa: String(dados.empresa || existente.empresa || "").trim(),
    whatsapp,
    telefone: dados.telefone || whatsapp,
    email: String(dados.email || existente.email || "").trim().toLowerCase(),
    cidade: dados.cidade || existente.cidade || "Uberlandia",
    origem: dados.origem || existente.origem || "Manual",
    responsavel: dados.responsavel || existente.responsavel || "",
    status: dados.status || existente.status || "Ativo",
    observacoes: dados.observacoes || existente.observacoes || "",
    tags: Array.isArray(dados.tags) ? dados.tags : (existente.tags || []),
    atualizado_em: agora,
    criado_em: existente.criado_em || dados.criado_em || agora,
  };
}

async function registrarHistorico({ clienteId, adminUser, area, tipo, titulo, descricao, dados = {} }) {
  const agora = new Date();
  const ref = adminDb.collection(HISTORICO).doc();
  const item = {
    id: ref.id,
    cliente_id: clienteId,
    area: area || "administracao",
    tipo_evento: tipo || "registro",
    titulo: titulo || "Registro",
    descricao: descricao || "",
    dados,
    ano: String(agora.getFullYear()),
    mes: String(agora.getMonth() + 1).padStart(2, "0"),
    dia: String(agora.getDate()).padStart(2, "0"),
    data_evento: agora.toISOString(),
    criado_em: agora.toISOString(),
    criado_por: adminUser.email || adminUser.uid || "admin",
  };
  await ref.set(item);
  return item;
}

async function buscarHistorico(clienteId) {
  const snap = await adminDb.collection(HISTORICO).where("cliente_id", "==", clienteId).limit(100).get();
  return snap.docs
    .map((doc) => doc.data())
    .sort((a, b) => String(b.data_evento || "").localeCompare(String(a.data_evento || "")));
}

export async function GET(request) {
  try {
    await verificarSessaoAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const busca = normalizarTexto(searchParams.get("busca") || "");

    if (id) {
      const snap = await adminDb.collection(COLECAO).doc(id).get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Cliente nao encontrado." }, { status: 404 });
      }
      return NextResponse.json({ status: "success", cliente: snap.data(), historico: await buscarHistorico(id) });
    }

    const snap = await adminDb.collection(COLECAO).limit(400).get();
    let clientes = snap.docs.map((doc) => doc.data());
    if (busca) {
      clientes = clientes.filter((cliente) => normalizarTexto([
        cliente.nome,
        cliente.empresa,
        cliente.whatsapp,
        cliente.email,
        cliente.cidade,
        cliente.status,
      ].join(" ")).includes(busca));
    }
    clientes.sort((a, b) => String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || "")));
    return NextResponse.json({ status: "success", clientes });
  } catch (error) {
    console.error("[APIs/Clientes] Falha:", error.message);
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
    const { acao } = body;
    const clientesRef = adminDb.collection(COLECAO);

    if (acao === "cadastrar") {
      const cliente = prepararCliente(body.cliente);
      if (!cliente.nome) {
        return NextResponse.json({ status: "error", message: "Nome do cliente e obrigatorio." }, { status: 400 });
      }
      const docRef = clientesRef.doc();
      const novo = { ...cliente, id: docRef.id };
      await docRef.set(novo);
      await registrarHistorico({
        clienteId: docRef.id,
        adminUser,
        area: body.area || "administracao",
        tipo: "cliente_criado",
        titulo: "Cliente cadastrado",
        descricao: `Cadastro criado por ${adminUser.email || "administrador"}.`,
        dados: novo,
      });
      await registrarAuditoria(adminUser, "cadastrar_cliente", COLECAO, docRef.id, null, novo, request);
      return NextResponse.json({ status: "success", cliente: novo });
    }

    if (acao === "editar") {
      const id = body.id;
      if (!id) return NextResponse.json({ status: "error", message: "ID ausente." }, { status: 400 });
      const docRef = clientesRef.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Cliente nao encontrado." }, { status: 404 });
      }
      const anterior = snap.data();
      const atualizado = prepararCliente(body.cliente, anterior);
      await docRef.update(atualizado);
      await registrarHistorico({
        clienteId: id,
        adminUser,
        area: body.area || "administracao",
        tipo: "cliente_alterado",
        titulo: "Cadastro alterado",
        descricao: body.descricao || "Dados do cliente atualizados.",
        dados: atualizado,
      });
      await registrarAuditoria(adminUser, "editar_cliente", COLECAO, id, anterior, atualizado, request);
      return NextResponse.json({ status: "success", cliente: { ...anterior, ...atualizado, id } });
    }

    if (acao === "historico") {
      const id = body.id;
      if (!id) return NextResponse.json({ status: "error", message: "ID ausente." }, { status: 400 });
      const snap = await clientesRef.doc(id).get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Cliente nao encontrado." }, { status: 404 });
      }
      const item = await registrarHistorico({
        clienteId: id,
        adminUser,
        area: body.area,
        tipo: body.tipo_evento,
        titulo: body.titulo,
        descricao: body.descricao,
        dados: body.dados || {},
      });
      await clientesRef.doc(id).update({ atualizado_em: new Date().toISOString() });
      return NextResponse.json({ status: "success", historico: item });
    }

    return NextResponse.json({ status: "error", message: "Acao nao suportada." }, { status: 400 });
  } catch (error) {
    console.error("[APIs/Clientes POST] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}
