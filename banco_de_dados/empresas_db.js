import {
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../servicos/firebase_config";

const COLECAO_NOME = "empresas";

export const STATUS_LEAD = [
  "Novo lead",
  "Contatado",
  "Respondeu",
  "Aguardando retorno",
  "Reuniao marcada",
  "Proposta enviada",
  "Fechado",
  "Perdido",
];

export function normalizarTelefone(valor) {
  const somenteNumeros = String(valor || "").replace(/\D/g, "");
  if (!somenteNumeros) return "";
  return somenteNumeros.startsWith("55") ? somenteNumeros : `55${somenteNumeros}`;
}

export function criarMensagemPadrao(empresa) {
  const nome = empresa?.nome || "a empresa";
  const nicho = empresa?.nicho || empresa?.categoria || "segmento";
  return `Oi, vi ${nome} no Maps e achei que existe uma oportunidade de mostrar melhor o trabalho de voces em video. Posso te mandar uma ideia rapida?`;
}

export function criarLinkWhatsApp(empresa) {
  const telefone = normalizarTelefone(empresa?.whatsapp || empresa?.telefone);
  if (!telefone) return "";
  const mensagem = empresa?.mensagem_sugerida || criarMensagemPadrao(empresa);
  return `https://web.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(mensagem)}`;
}

function prepararEmpresa(dados) {
  const agora = new Date().toISOString();
  const whatsapp = normalizarTelefone(dados.whatsapp || dados.telefone);
  const nicho = dados.nicho || dados.categoria || "Geral";
  const mensagem = dados.mensagem_sugerida || criarMensagemPadrao({ ...dados, nicho });

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
    site: dados.site || dados.instagram || "",
    instagram: dados.instagram || dados.site || "",
    avaliacao_google: Number(dados.avaliacao_google || dados.avaliacao) || 0,
    total_avaliacoes: Number(dados.total_avaliacoes) || 0,
    origem: dados.origem || "Manual",
    status: dados.status || "Novo lead",
    etapa_funil: dados.etapa_funil || dados.status || "Novo lead",
    observacoes: dados.observacoes || "",
    mensagem_sugerida: mensagem,
    ultimo_contato: dados.ultimo_contato || null,
    proximo_followup: dados.proximo_followup || null,
    latitude: dados.latitude !== undefined ? Number(dados.latitude) : null,
    longitude: dados.longitude !== undefined ? Number(dados.longitude) : null,
    fotos: dados.fotos || [],
    tags: dados.tags || [nicho].filter(Boolean),
    atualizado_em: agora,
    criado_em: dados.criado_em || agora,
  };
}

export async function listarEmpresas(filtros = {}) {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams();
    if (filtros.lista_id) params.set("lista_id", filtros.lista_id);
    const url = params.toString() ? `/api/admin/empresas?${params}` : "/api/admin/empresas";
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Falha ao listar empresas.");
    }
    const data = await res.json();
    return data.empresas || [];
  }

  try {
    return [];
  } catch (erro) {
    console.error("Erro ao listar empresas:", erro);
    return [];
  }
}

export async function obterEmpresaPorId(id) {
  const docRef = doc(db, COLECAO_NOME, id);
  try {
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (erro) {
    console.error(`Erro ao obter empresa ${id}:`, erro);
    return null;
  }
}

async function chamarApi(payload, mensagemErro) {
  const res = await fetch("/api/admin/empresas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || mensagemErro);
  }

  return res.json();
}

export async function cadastrarEmpresa(dados) {
  if (typeof window !== "undefined") {
    const resData = await chamarApi(
      { acao: "cadastrar", empresa: prepararEmpresa(dados) },
      "Falha ao cadastrar empresa."
    );
    return resData.id;
  }
}

export async function editarEmpresa(id, dadosNovos) {
  if (typeof window !== "undefined") {
    await chamarApi(
      { acao: "editar", id, empresa: prepararEmpresa(dadosNovos) },
      "Falha ao editar empresa."
    );
    return;
  }

  const docRef = doc(db, COLECAO_NOME, id);
  await updateDoc(docRef, prepararEmpresa(dadosNovos));
}

export async function atualizarCamposEmpresa(id, campos) {
  if (typeof window !== "undefined") {
    await chamarApi(
      { acao: "atualizarCampos", id, campos },
      "Falha ao atualizar empresa."
    );
    return;
  }

  const docRef = doc(db, COLECAO_NOME, id);
  await updateDoc(docRef, { ...campos, atualizado_em: new Date().toISOString() });
}

export async function excluirEmpresa(id) {
  if (typeof window !== "undefined") {
    await chamarApi({ acao: "excluir", id }, "Falha ao excluir empresa.");
    return;
  }

  const docRef = doc(db, COLECAO_NOME, id);
  await deleteDoc(docRef);
}

export async function excluirEmpresasEmLote(ids) {
  if (typeof window !== "undefined") {
    await chamarApi({ acao: "excluirLote", ids }, "Falha ao excluir empresas.");
    return;
  }

  if (!ids?.length) return;
  const tamanhoDoLote = 400;
  for (let i = 0; i < ids.length; i += tamanhoDoLote) {
    const pedaco = ids.slice(i, i + tamanhoDoLote);
    const batch = writeBatch(db);
    pedaco.forEach((id) => batch.delete(doc(db, COLECAO_NOME, id)));
    await batch.commit();
  }
}

export async function importarEmpresasEmLote(listaEmpresas) {
  const empresas = (listaEmpresas || []).map(prepararEmpresa);
  if (typeof window !== "undefined") {
    const resData = await chamarApi(
      { acao: "importarLote", listaEmpresas: empresas },
      "Falha ao importar empresas."
    );
    return resData.total;
  }
}

export async function importarEmpresasEmLoteComLista(listaEmpresas, listaProspecao) {
  const empresas = (listaEmpresas || []).map(prepararEmpresa);
  if (typeof window !== "undefined") {
    const resData = await chamarApi(
      { acao: "importarLote", listaEmpresas: empresas, listaProspecao },
      "Falha ao importar empresas."
    );
    return resData;
  }
}

export async function listarListasProspecao() {
  const res = await fetch("/api/admin/listas-prospeccao", { method: "GET" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Falha ao listar campanhas.");
  }
  const data = await res.json();
  return data.listas || [];
}

export async function criarListaProspecao(dados) {
  const res = await fetch("/api/admin/listas-prospeccao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Falha ao criar campanha.");
  }
  const data = await res.json();
  return data.lista;
}

export async function adicionarEmpresasNaCampanha(listaId, empresaIds) {
  const res = await fetch("/api/admin/listas-prospeccao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "vincularEmpresas", lista_id: listaId, empresa_ids: empresaIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Falha ao adicionar empresas na campanha.");
  }
  return res.json();
}

export async function excluirCampanha(id) {
  const res = await fetch(`/api/admin/listas-prospeccao?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Falha ao excluir campanha.");
  }
  return res.json();
}
