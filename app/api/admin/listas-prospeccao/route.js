import { NextResponse } from "next/server";
import { adminDb, registrarAuditoria, verificarSessaoAdmin } from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const adminUser = await verificarSessaoAdmin(request);
    const snap = await adminDb.collection("listas_prospeccao").get();
    const listas = [];
    snap.forEach((doc) => listas.push(doc.data()));
    listas.sort((a, b) => String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || "")));
    return NextResponse.json({ status: "success", listas });
  } catch (error) {
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro ao listar listas." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const adminUser = await verificarSessaoAdmin(request);
    const body = await request.json();
    const agora = new Date().toISOString();

    if (body.acao === "vincularEmpresas") {
      const listaId = body.lista_id;
      const ids = Array.isArray(body.empresa_ids) ? body.empresa_ids.filter(Boolean) : [];
      if (!listaId || !ids.length) {
        return NextResponse.json({ status: "error", message: "Campanha ou empresas ausentes." }, { status: 400 });
      }

      for (let i = 0; i < ids.length; i += 400) {
        const pedaco = ids.slice(i, i + 400);
        const batch = adminDb.batch();
        for (const empresaId of pedaco) {
          const relRef = adminDb.collection("lista_empresas").doc(`${listaId}_${empresaId}`);
          batch.set(relRef, {
            id: relRef.id,
            lista_id: listaId,
            empresa_id: empresaId,
            origem: "manual",
            resultado_novo: false,
            adicionada_em: agora,
          }, { merge: true });
        }
        await batch.commit();
      }

      for (const empresaId of ids) {
        const ref = adminDb.collection("empresas").doc(empresaId);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const atuais = snap.data().lista_ids || [];
        await ref.update({
          lista_ids: Array.from(new Set([...atuais, listaId])),
          atualizado_em: agora,
        });
      }

      const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", listaId).get();
      await adminDb.collection("listas_prospeccao").doc(listaId).set({
        quantidade_empresas: rels.size,
        atualizado_em: agora,
      }, { merge: true });

      await registrarAuditoria(adminUser, "vincular_empresas_campanha", "listas_prospeccao", listaId, null, { empresa_ids: ids }, request);

      return NextResponse.json({ status: "success", vinculadas: ids.length });
    }

    const ref = body.id ? adminDb.collection("listas_prospeccao").doc(body.id) : adminDb.collection("listas_prospeccao").doc();
    const lista = {
      id: ref.id,
      nome: String(body.nome || "Campanha de prospeccao").trim(),
      descricao: body.descricao || "",
      nicho: body.nicho || "",
      cidade: body.cidade || "Uberlandia",
      estado: body.estado || "MG",
      termo_busca: body.termo_busca || "",
      origem: body.origem || "manual",
      status: body.status || "ativa",
      atualizado_em: agora,
      criado_em: body.criado_em || agora,
    };
    await ref.set(lista, { merge: true });
    await registrarAuditoria(adminUser, body.id ? "editar_campanha" : "criar_campanha", "listas_prospeccao", ref.id, null, lista, request);
    return NextResponse.json({ status: "success", lista });
  } catch (error) {
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro ao salvar lista." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const adminUser = await verificarSessaoAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ status: "error", message: "ID da campanha ausente." }, { status: 400 });
    }

    const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", id).get();
    const empresaIds = rels.docs.map((doc) => doc.data().empresa_id).filter(Boolean);

    for (let i = 0; i < rels.docs.length; i += 400) {
      const pedaco = rels.docs.slice(i, i + 400);
      const batch = adminDb.batch();
      pedaco.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    for (const empresaId of empresaIds) {
      const ref = adminDb.collection("empresas").doc(empresaId);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const listaIds = (snap.data().lista_ids || []).filter((listaId) => listaId !== id);
      await ref.update({ lista_ids: listaIds, atualizado_em: new Date().toISOString() });
    }

    const listaRef = adminDb.collection("listas_prospeccao").doc(id);
    const listaSnap = await listaRef.get();
    await listaRef.delete();
    await registrarAuditoria(adminUser, "excluir_campanha", "listas_prospeccao", id, listaSnap.exists ? listaSnap.data() : null, { empresas_desvinculadas: empresaIds.length }, request);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro ao excluir campanha." }, { status: 500 });
  }
}
