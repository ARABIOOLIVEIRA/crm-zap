import { createHash } from "crypto";
import { adminDb, registrarAuditoria } from "@/servicos/firebase_admin_config";

export function autorizado(request) {
  const header = request.headers.get("x-crm-zap-token") || "";
  const esperado = process.env.EXTENSION_IMPORT_SECRET || process.env.ADMIN_SECRET || "";
  return Boolean(esperado && header && header === esperado);
}

export function normalizarTelefone(valor) {
  const numeros = String(valor || "").replace(/\D/g, "");
  if (!numeros) return "";
  return numeros.startsWith("55") ? numeros : `55${numeros}`;
}

export function normalizarPayload(body = {}) {
  const contact = body.contact || {};
  const conversation = body.conversation || {};
  const destination = body.destination || "";
  const whatsapp = normalizarTelefone(contact.whatsapp || contact.phone);
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.filter((m) => m.selected !== false).slice(0, 300)
    : [];

  return {
    destination,
    metadataOnly: Boolean(body.metadataOnly),
    contact: {
      name: String(contact.name || "").trim(),
      companyName: String(contact.companyName || contact.name || "").trim(),
      whatsapp,
      phone: normalizarTelefone(contact.phone || whatsapp),
      city: String(contact.city || "Uberlandia").trim(),
      niche: String(contact.niche || "WhatsApp").trim(),
      notes: String(contact.notes || "").trim(),
    },
    conversation: {
      name: String(conversation.name || contact.name || "Conversa WhatsApp").trim(),
      temporaryConversationId: String(conversation.temporaryConversationId || "").trim(),
      summary: conversation.summary || {},
      messages,
    },
  };
}

export function validarPayload(payload) {
  const errors = [];
  if (!payload.contact.name) errors.push("Nome do contato obrigatorio.");
  if (!payload.destination) errors.push("Destino no CRM obrigatorio.");
  if (!payload.contact.whatsapp && payload.destination !== "conversation_only") {
    errors.push("WhatsApp obrigatorio para criar ou atualizar cadastro.");
  }
  if (!payload.conversation.messages.length) errors.push("Selecione ao menos uma mensagem.");
  if (payload.conversation.messages.length > 300) errors.push("Limite de 300 mensagens por importacao.");
  if (JSON.stringify(payload).length > 950000) errors.push("Payload muito grande.");
  return errors;
}

export function hashMensagem(message, conversationKey) {
  const raw = [
    conversationKey,
    message.direction || "",
    message.type || "",
    message.content || "",
    message.timestamp || "",
    message.sequence || "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export async function encontrarEmpresa(payload) {
  const empresas = adminDb.collection("empresas");
  if (payload.contact.whatsapp) {
    const byPhone = await empresas.where("whatsapp", "==", payload.contact.whatsapp).limit(1).get();
    if (!byPhone.empty) return byPhone.docs[0];
  }
  if (payload.contact.companyName) {
    const byName = await empresas.where("nome", "==", payload.contact.companyName).limit(1).get();
    if (!byName.empty) return byName.docs[0];
  }
  return null;
}

export async function encontrarContato(payload) {
  const contatos = adminDb.collection("contatos");
  if (payload.contact.whatsapp) {
    const byPhone = await contatos.where("whatsapp", "==", payload.contact.whatsapp).limit(1).get();
    if (!byPhone.empty) return byPhone.docs[0];
  }
  return null;
}

export async function registrarAuditoriaExtensao(acao, recursoId, valoresNovos, request) {
  await registrarAuditoria(
    { uid: "chrome-extension", email: "extensao@crm-zap.local" },
    acao,
    "extensao_chrome",
    recursoId,
    null,
    valoresNovos,
    request
  );
}
