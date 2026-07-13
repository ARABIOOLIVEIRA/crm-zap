import { NextResponse } from "next/server";
import { adminDb } from "@/servicos/firebase_admin_config";
import {
  autorizado,
  encontrarContato,
  encontrarEmpresa,
  hashMensagem,
  normalizarPayload,
  registrarAuditoriaExtensao,
  validarPayload,
} from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!autorizado(request)) {
      return NextResponse.json({ status: "error", message: "Nao autorizado." }, { status: 401 });
    }

    const payload = normalizarPayload(await request.json());
    const errors = validarPayload(payload);
    if (errors.length) {
      return NextResponse.json({ status: "error", message: errors.join("\n"), errors }, { status: 400 });
    }

    const agora = new Date().toISOString();
    let empresaDoc = await encontrarEmpresa(payload);
    let empresaId = empresaDoc?.id || "";

    if (!empresaDoc && payload.destination !== "conversation_only") {
      const ref = adminDb.collection("empresas").doc();
      empresaId = ref.id;
      await ref.set({
        id: ref.id,
        nome: payload.contact.companyName || payload.contact.name,
        nicho: payload.contact.niche,
        categoria: payload.contact.niche,
        whatsapp: payload.contact.whatsapp,
        telefone: payload.contact.phone || payload.contact.whatsapp,
        cidade: payload.contact.city,
        origem: "Extensao Chrome",
        status: "Respondeu",
        etapa_funil: "Respondeu",
        observacoes: payload.contact.notes || "Criado pela extensao Chrome a partir da conversa aberta.",
        criado_em: agora,
        atualizado_em: agora,
        ultimo_contato: agora,
      });
    } else if (empresaDoc) {
      await empresaDoc.ref.update({
        whatsapp: payload.contact.whatsapp || empresaDoc.data().whatsapp || "",
        telefone: payload.contact.phone || empresaDoc.data().telefone || "",
        ultimo_contato: agora,
        atualizado_em: agora,
        status: "Respondeu",
        etapa_funil: "Respondeu",
      });
    }

    let contatoDoc = await encontrarContato(payload);
    let contatoId = contatoDoc?.id || "";
    if (!contatoDoc) {
      const ref = adminDb.collection("contatos").doc();
      contatoId = ref.id;
      await ref.set({
        id: ref.id,
        empresa_id: empresaId || null,
        nome: payload.contact.name,
        whatsapp: payload.contact.whatsapp,
        telefone: payload.contact.phone || payload.contact.whatsapp,
        cidade: payload.contact.city,
        origem: "Extensao Chrome",
        observacoes: payload.contact.notes || "",
        criado_em: agora,
        atualizado_em: agora,
      });
    } else {
      await contatoDoc.ref.update({
        empresa_id: empresaId || contatoDoc.data().empresa_id || null,
        nome: payload.contact.name || contatoDoc.data().nome,
        atualizado_em: agora,
      });
    }

    const conversaRef = adminDb.collection("conversas").doc(`${empresaId || "sem_empresa"}_${contatoId}`);
    await conversaRef.set({
      id: conversaRef.id,
      empresa_id: empresaId || null,
      contato_id: contatoId,
      nome: payload.conversation.name,
      origem: "Extensao Chrome",
      ultima_interacao: agora,
      atualizado_em: agora,
      criado_em: agora,
    }, { merge: true });

    let imported = 0;
    let duplicates = 0;
    const batch = adminDb.batch();
    const existingHashes = new Set();
    const hashes = payload.conversation.messages.map((m) => hashMensagem(m, conversaRef.id));

    for (let i = 0; i < hashes.length; i += 10) {
      const slice = hashes.slice(i, i + 10);
      const snap = await adminDb.collection("mensagens").where("hash", "in", slice).get();
      snap.forEach((doc) => existingHashes.add(doc.data().hash));
    }

    payload.conversation.messages.forEach((message, index) => {
      const hash = hashes[index];
      if (existingHashes.has(hash)) {
        duplicates++;
        return;
      }
      const ref = adminDb.collection("mensagens").doc();
      batch.set(ref, {
        id: ref.id,
        hash,
        conversa_id: conversaRef.id,
        empresa_id: empresaId || null,
        contato_id: contatoId,
        contact_name: payload.contact.name,
        whatsapp: payload.contact.whatsapp,
        direction: message.direction || "unknown",
        type: message.type || "text",
        content: String(message.content || message.description || "").slice(0, 4000),
        timestamp: message.timestamp || null,
        sequence: message.sequence || imported + 1,
        importado_em: agora,
        origem: "Extensao Chrome",
      });
      imported++;
    });

    if (imported > 0) await batch.commit();

    const atividadeRef = adminDb.collection("atividades").doc();
    await atividadeRef.set({
      id: atividadeRef.id,
      tipo: "importacao_conversa_whatsapp",
      empresa_id: empresaId || null,
      contato_id: contatoId,
      conversa_id: conversaRef.id,
      mensagens_importadas: imported,
      mensagens_duplicadas: duplicates,
      criado_em: agora,
      origem: "Extensao Chrome",
    });

    await registrarAuditoriaExtensao("importar_conversa", conversaRef.id, {
      empresaId,
      contatoId,
      imported,
      duplicates,
    }, request);

    return NextResponse.json({
      status: "success",
      empresaId,
      empresaNome: payload.contact.companyName || payload.contact.name,
      contatoId,
      contatoNome: payload.contact.name,
      conversaId: conversaRef.id,
      imported,
      duplicates,
      importedAt: agora,
    });
  } catch (erro) {
    console.error("[Extensao importar]", erro);
    return NextResponse.json({ status: "error", message: "Erro ao importar conversa." }, { status: 500 });
  }
}
