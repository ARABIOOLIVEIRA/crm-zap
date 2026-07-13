import { NextResponse } from "next/server";
import {
  adminDb,
  registrarAuditoria,
  verificarSessaoAdmin,
} from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

const COLECAO = "empresas";

function ordenarPorNome(lista) {
  return lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizarTelefone(valor) {
  const somenteNumeros = String(valor || "").replace(/\D/g, "");
  if (!somenteNumeros) return "";
  return somenteNumeros.startsWith("55") ? somenteNumeros : `55${somenteNumeros}`;
}

function criarMensagemPadrao(empresa) {
  const nome = empresa?.nome || "a empresa";
  return `Oi, vi ${nome} no Maps e achei que existe uma oportunidade de mostrar melhor o trabalho de voces em video. Posso te mandar uma ideia rapida?`;
}

async function atualizarQuantidadeCampanhas(listaIds = []) {
  const agora = new Date().toISOString();
  for (const listaId of Array.from(new Set(listaIds.filter(Boolean)))) {
    const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", listaId).get();
    await adminDb.collection("listas_prospeccao").doc(listaId).set({
      quantidade_empresas: rels.size,
      atualizado_em: agora,
    }, { merge: true });
  }
}

async function limparVinculosEmpresa(empresaId) {
  const rels = await adminDb.collection("lista_empresas").where("empresa_id", "==", empresaId).get();
  const listaIds = rels.docs.map((doc) => doc.data().lista_id).filter(Boolean);
  for (let i = 0; i < rels.docs.length; i += 400) {
    const pedaco = rels.docs.slice(i, i + 400);
    const batch = adminDb.batch();
    pedaco.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await atualizarQuantidadeCampanhas(listaIds);
  return listaIds;
}

function prepararEmpresa(dados = {}) {
  const agora = new Date().toISOString();
  const whatsapp = normalizarTelefone(dados.whatsapp || dados.telefone);
  const nicho = dados.nicho || dados.categoria || "Geral";

  return {
    nome: String(dados.nome || "").trim(),
    nicho,
    categoria: nicho,
    descricao: dados.descricao || "",
    bairro: dados.bairro || "",
    endereco: dados.endereco || "",
    cidade: dados.cidade || "Uberlandia",
    telefone: dados.telefone || whatsapp,
    whatsapp,
    whatsapp_normalizado: whatsapp,
    telefone_normalizado: normalizarTelefone(dados.telefone || whatsapp),
    google_place_id: dados.google_place_id || dados.place_id || "",
    nome_normalizado: normalizarTexto(dados.nome),
    site: dados.site || dados.instagram || "",
    instagram: dados.instagram || dados.site || "",
    avaliacao_google: Number(dados.avaliacao_google || dados.avaliacao) || 0,
    total_avaliacoes: Number(dados.total_avaliacoes) || 0,
    origem: dados.origem || "Manual",
    status: dados.status || "Novo lead",
    etapa_funil: dados.etapa_funil || dados.status || "Novo lead",
    observacoes: dados.observacoes || "",
    mensagem_sugerida: dados.mensagem_sugerida || criarMensagemPadrao(dados),
    ultimo_contato: dados.ultimo_contato || null,
    proximo_followup: dados.proximo_followup || null,
    latitude: dados.latitude !== undefined ? Number(dados.latitude) : null,
    longitude: dados.longitude !== undefined ? Number(dados.longitude) : null,
    fotos: Array.isArray(dados.fotos) ? dados.fotos : [],
    tags: Array.isArray(dados.tags) ? dados.tags : [nicho].filter(Boolean),
    lista_ids: Array.isArray(dados.lista_ids) ? dados.lista_ids : [],
    atualizado_em: agora,
    criado_em: dados.criado_em || agora,
  };
}

async function encontrarEmpresaExistente(colecaoRef, empresa) {
  if (empresa.google_place_id) {
    const snap = await colecaoRef.where("google_place_id", "==", empresa.google_place_id).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (empresa.whatsapp_normalizado) {
    const snap = await colecaoRef.where("whatsapp_normalizado", "==", empresa.whatsapp_normalizado).limit(1).get();
    if (!snap.empty) return snap.docs[0];
    const legado = await colecaoRef.where("whatsapp", "==", empresa.whatsapp_normalizado).limit(1).get();
    if (!legado.empty) return legado.docs[0];
  }
  if (empresa.telefone_normalizado) {
    const snap = await colecaoRef.where("telefone_normalizado", "==", empresa.telefone_normalizado).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (empresa.nome_normalizado) {
    const snap = await colecaoRef.where("nome_normalizado", "==", empresa.nome_normalizado).limit(5).get();
    const cidade = empresa.cidade || "Uberlandia";
    const match = snap.docs.find((doc) => (doc.data().cidade || "Uberlandia") === cidade);
    if (match) return match;
  }
  return null;
}

async function criarOuAtualizarLista(adminUser, listaData, request) {
  if (!listaData?.nome) return null;
  const agora = new Date().toISOString();
  const listasRef = adminDb.collection("listas_prospeccao");
  const docRef = listaData.id ? listasRef.doc(listaData.id) : listasRef.doc();
  const snap = await docRef.get();
  const lista = {
    id: docRef.id,
    nome: String(listaData.nome || "Campanha de prospeccao").trim(),
    descricao: listaData.descricao || "",
    nicho: listaData.nicho || "",
    cidade: listaData.cidade || "Uberlandia",
    estado: listaData.estado || "MG",
    termo_busca: listaData.termo_busca || "",
    origem: listaData.origem || "google_maps",
    status: listaData.status || "ativa",
    atualizado_em: agora,
    criado_em: snap.exists ? snap.data().criado_em : agora,
  };
  await docRef.set(lista, { merge: true });
  await registrarAuditoria(adminUser, snap.exists ? "atualizar_lista_prospeccao" : "criar_lista_prospeccao", "listas_prospeccao", docRef.id, snap.exists ? snap.data() : null, lista, request);
  return lista;
}

async function vincularEmpresaLista({ lista, empresaId, resultadoNovo, ordem, adminUser, request }) {
  if (!lista?.id || !empresaId) return;
  const agora = new Date().toISOString();
  const relRef = adminDb.collection("lista_empresas").doc(`${lista.id}_${empresaId}`);
  const relSnap = await relRef.get();
  if (!relSnap.exists) {
    await relRef.set({
      id: relRef.id,
      lista_id: lista.id,
      empresa_id: empresaId,
      origem: lista.origem || "google_maps",
      resultado_novo: Boolean(resultadoNovo),
      ordem_importacao: ordem,
      adicionada_em: agora,
    });
    await registrarAuditoria(adminUser, "vincular_empresa_lista", "lista_empresas", relRef.id, null, { lista_id: lista.id, empresa_id: empresaId, resultado_novo: Boolean(resultadoNovo) }, request);
  }
  const empresaRef = adminDb.collection(COLECAO).doc(empresaId);
  const empresaSnap = await empresaRef.get();
  if (empresaSnap.exists) {
    const atual = empresaSnap.data();
    const listaIds = Array.from(new Set([...(atual.lista_ids || []), lista.id]));
    await empresaRef.update({ lista_ids: listaIds, atualizado_em: agora });
  }
}

export async function POST(request) {
  try {
    const adminUser = await verificarSessaoAdmin(request);
    const body = await request.json();
    const { acao } = body;
    const colecaoRef = adminDb.collection(COLECAO);

    if (acao === "cadastrar") {
      const empresa = prepararEmpresa(body.empresa);
      if (!empresa.nome) {
        return NextResponse.json(
          { status: "error", message: "Nome da empresa e obrigatorio." },
          { status: 400 }
        );
      }

      const docRef = colecaoRef.doc();
      const novaEmpresa = { ...empresa, id: docRef.id };
      await docRef.set(novaEmpresa);
      await registrarAuditoria(adminUser, "cadastrar", COLECAO, docRef.id, null, novaEmpresa, request);
      return NextResponse.json({ status: "success", id: docRef.id });
    }

    if (acao === "editar") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ status: "error", message: "ID ausente." }, { status: 400 });
      }

      const docRef = colecaoRef.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Empresa nao encontrada." }, { status: 404 });
      }

      const valoresAnteriores = snap.data();
      const dadosNovos = prepararEmpresa({ ...valoresAnteriores, ...body.empresa, id });
      await docRef.update(dadosNovos);
      await registrarAuditoria(adminUser, "editar", COLECAO, id, valoresAnteriores, dadosNovos, request);
      return NextResponse.json({ status: "success" });
    }

    if (acao === "atualizarCampos") {
      const { id, campos } = body;
      if (!id || !campos || typeof campos !== "object") {
        return NextResponse.json({ status: "error", message: "Atualizacao invalida." }, { status: 400 });
      }

      const docRef = colecaoRef.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Empresa nao encontrada." }, { status: 404 });
      }

      const dadosNovos = {
        ...campos,
        atualizado_em: new Date().toISOString(),
      };
      await docRef.update(dadosNovos);
      await registrarAuditoria(adminUser, "atualizar_campos", COLECAO, id, snap.data(), dadosNovos, request);
      return NextResponse.json({ status: "success" });
    }

    if (acao === "excluir") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ status: "error", message: "ID ausente." }, { status: 400 });
      }

      const docRef = colecaoRef.doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return NextResponse.json({ status: "error", message: "Empresa nao encontrada." }, { status: 404 });
      }

      const campanhasLimpas = await limparVinculosEmpresa(id);
      await docRef.delete();
      await registrarAuditoria(adminUser, "excluir", COLECAO, id, snap.data(), { campanhas_limpas: campanhasLimpas }, request);
      return NextResponse.json({ status: "success" });
    }

    if (acao === "excluirLote") {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const tamanhoDoLote = 400;

      const campanhasAfetadas = [];
      for (const id of ids) {
        campanhasAfetadas.push(...await limparVinculosEmpresa(id));
      }

      for (let i = 0; i < ids.length; i += tamanhoDoLote) {
        const pedaco = ids.slice(i, i + tamanhoDoLote);
        const batch = adminDb.batch();
        pedaco.forEach((id) => batch.delete(colecaoRef.doc(id)));
        await batch.commit();
      }

      await registrarAuditoria(adminUser, "excluir_lote", COLECAO, "lote", { ids }, { campanhas_limpas: Array.from(new Set(campanhasAfetadas)) }, request);
      return NextResponse.json({ status: "success" });
    }

    if (acao === "importarLote") {
      const listaEmpresas = Array.isArray(body.listaEmpresas) ? body.listaEmpresas : [];
      let contador = 0;
      let existentes = 0;
      let semWhatsapp = 0;
      let vinculadas = 0;
      const tamanhoDoLote = 400;
      const lista = await criarOuAtualizarLista(adminUser, body.listaProspecao, request);

      for (let i = 0; i < listaEmpresas.length; i += tamanhoDoLote) {
        const pedaco = listaEmpresas.slice(i, i + tamanhoDoLote);
        const batch = adminDb.batch();
        const vinculosPendentes = [];

        for (const empresaData of pedaco) {
          const empresa = prepararEmpresa(empresaData);
          if (!empresa.nome) continue;
          if (!empresa.whatsapp_normalizado) semWhatsapp++;
          const existente = await encontrarEmpresaExistente(colecaoRef, empresa);
          if (existente) {
            existentes++;
            const dadosAtuais = existente.data();
            const atualizacaoSegura = {
              google_place_id: dadosAtuais.google_place_id || empresa.google_place_id || "",
              whatsapp_normalizado: dadosAtuais.whatsapp_normalizado || empresa.whatsapp_normalizado || "",
              telefone_normalizado: dadosAtuais.telefone_normalizado || empresa.telefone_normalizado || "",
              nome_normalizado: dadosAtuais.nome_normalizado || empresa.nome_normalizado || "",
              atualizado_em: new Date().toISOString(),
            };
            batch.update(existente.ref, atualizacaoSegura);
            vinculosPendentes.push({ empresaId: existente.id, novo: false });
            continue;
          }
          const docRef = colecaoRef.doc();
          batch.set(docRef, { ...empresa, id: docRef.id, lista_ids: lista ? [lista.id] : [] });
          vinculosPendentes.push({ empresaId: docRef.id, novo: true });
          contador++;
        }

        await batch.commit();
        for (let idx = 0; idx < vinculosPendentes.length; idx++) {
          await vincularEmpresaLista({ lista, empresaId: vinculosPendentes[idx].empresaId, resultadoNovo: vinculosPendentes[idx].novo, ordem: i + idx + 1, adminUser, request });
          vinculadas++;
        }
      }

      if (lista?.id) {
        const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", lista.id).get();
        await adminDb.collection("listas_prospeccao").doc(lista.id).set({
          quantidade_empresas: rels.size,
          quantidade_novas: contador,
          quantidade_existentes: existentes,
          atualizado_em: new Date().toISOString(),
        }, { merge: true });
      }

      await registrarAuditoria(adminUser, "importar_lote", COLECAO, "lote", null, { totalImportado: contador, existentes, semWhatsapp, vinculadas, lista_id: lista?.id || null }, request);
      return NextResponse.json({ status: "success", total: contador, novas: contador, existentes, semWhatsapp, vinculadas, lista });
    }

    return NextResponse.json({ status: "error", message: "Acao nao suportada." }, { status: 400 });
  } catch (error) {
    console.error("[APIs/Empresas] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    await verificarSessaoAdmin(request);
    const { searchParams } = new URL(request.url);
    const listaId = searchParams.get("lista_id") || "";
    let snap;
    if (listaId) {
      const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", listaId).get();
      const ids = rels.docs.map((doc) => doc.data().empresa_id).filter(Boolean);
      const empresas = [];
      for (let i = 0; i < ids.length; i += 10) {
        const pedaco = ids.slice(i, i + 10);
        if (!pedaco.length) continue;
        const lote = await adminDb.collection(COLECAO).where("id", "in", pedaco).get();
        lote.forEach((doc) => empresas.push(doc.data()));
      }
      return NextResponse.json({ status: "success", empresas: ordenarPorNome(empresas) });
    }

    snap = await adminDb.collection(COLECAO).get();
    const empresas = [];
    snap.forEach((doc) => empresas.push(doc.data()));
    return NextResponse.json({ status: "success", empresas: ordenarPorNome(empresas) });
  } catch (error) {
    console.error("[APIs/Empresas GET] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}
