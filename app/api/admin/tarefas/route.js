import { NextResponse } from "next/server";
import {
  adminDb,
  registrarAuditoria,
  verificarSessaoAdmin,
} from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

const COLECAO = "tarefas";
const HISTORICO = "historico_cliente";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function classificarRotina(tarefa) {
  if (tarefa.status === "concluida" || tarefa.status === "cancelada") return tarefa.status;
  if (!tarefa.data_prevista) return "sem_data";
  if (tarefa.data_prevista < hojeIso()) return "atrasada";
  if (tarefa.data_prevista === hojeIso()) return "hoje";
  return "proxima";
}

function prepararTarefa(dados = {}, existente = {}) {
  const agora = new Date().toISOString();
  return {
    titulo: String(dados.titulo || existente.titulo || "").trim(),
    descricao: dados.descricao ?? existente.descricao ?? "",
    cliente_id: dados.cliente_id ?? existente.cliente_id ?? "",
    cliente_nome: dados.cliente_nome ?? existente.cliente_nome ?? "",
    area: dados.area || existente.area || "administracao",
    responsavel: dados.responsavel || existente.responsavel || "",
    data_prevista: dados.data_prevista || existente.data_prevista || "",
    status: dados.status || existente.status || "pendente",
    prioridade: dados.prioridade || existente.prioridade || "normal",
    atualizado_em: agora,
    criado_em: existente.criado_em || dados.criado_em || agora,
  };
}

async function registrarHistoricoTarefa({ tarefa, adminUser, titulo, descricao }) {
  if (!tarefa.cliente_id) return null;
  const agora = new Date();
  const ref = adminDb.collection(HISTORICO).doc();
  const item = {
    id: ref.id,
    cliente_id: tarefa.cliente_id,
    area: tarefa.area || "administracao",
    tipo_evento: "tarefa",
    titulo,
    descricao,
    dados: { tarefa_id: tarefa.id, status: tarefa.status, data_prevista: tarefa.data_prevista },
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

export async function GET(request) {
  try {
    await verificarSessaoAdmin(request);
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id") || "";
    const snap = clienteId
      ? await adminDb.collection(COLECAO).where("cliente_id", "==", clienteId).get()
      : await adminDb.collection(COLECAO).limit(500).get();
    const tarefas = snap.docs.map((doc) => {
      const tarefa = doc.data();
      return { ...tarefa, rotina_status: classificarRotina(tarefa) };
    });
    tarefas.sort((a, b) => String(a.data_prevista || "9999-99-99").localeCompare(String(b.data_prevista || "9999-99-99")));
    return NextResponse.json({ status: "success", tarefas });
  } catch (error) {
    console.error("[APIs/Tarefas] Falha:", error.message);
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

    if (body.acao === "criar") {
      const tarefa = prepararTarefa(body.tarefa);
      if (!tarefa.titulo) {
        return NextResponse.json({ status: "error", message: "Titulo da tarefa e obrigatorio." }, { status: 400 });
      }
      const ref = adminDb.collection(COLECAO).doc();
      const nova = { ...tarefa, id: ref.id };
      await ref.set(nova);
      await registrarHistoricoTarefa({
        tarefa: nova,
        adminUser,
        titulo: "Tarefa criada",
        descricao: `${nova.titulo}${nova.data_prevista ? ` para ${nova.data_prevista}` : ""}.`,
      });
      await registrarAuditoria(adminUser, "criar_tarefa", COLECAO, ref.id, null, nova, request);
      return NextResponse.json({ status: "success", tarefa: nova });
    }

    if (body.acao === "atualizar") {
      const id = body.id;
      if (!id) return NextResponse.json({ status: "error", message: "ID ausente." }, { status: 400 });
      const ref = adminDb.collection(COLECAO).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Tarefa nao encontrada." }, { status: 404 });
      }
      const anterior = snap.data();
      const atualizada = prepararTarefa(body.tarefa, anterior);
      await ref.update(atualizada);
      await registrarHistoricoTarefa({
        tarefa: { ...anterior, ...atualizada, id },
        adminUser,
        titulo: atualizada.status === "concluida" ? "Tarefa concluida" : "Tarefa atualizada",
        descricao: body.descricao || atualizada.titulo,
      });
      await registrarAuditoria(adminUser, "atualizar_tarefa", COLECAO, id, anterior, atualizada, request);
      return NextResponse.json({ status: "success", tarefa: { ...anterior, ...atualizada, id } });
    }

    return NextResponse.json({ status: "error", message: "Acao nao suportada." }, { status: 400 });
  } catch (error) {
    console.error("[APIs/Tarefas POST] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}
