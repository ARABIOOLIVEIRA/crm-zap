import { NextResponse } from "next/server";
import { adminDb, verificarSessaoAdmin } from "@/servicos/firebase_admin_config";

export const dynamic = "force-dynamic";

const ETAPAS_COM_RESPOSTA = new Set([
  "Respondeu",
  "Aguardando retorno",
  "Reuniao marcada",
  "Proposta enviada",
  "Fechado",
]);

const ETAPAS_FUNIL = [
  "Novo lead",
  "Contatado",
  "Respondeu",
  "Aguardando retorno",
  "Reuniao marcada",
  "Proposta enviada",
  "Fechado",
  "Perdido",
];

function inicioDoDiaLocal() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

function dataDoCampo(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function contarEmpresas(empresas) {
  const hoje = inicioDoDiaLocal();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  return empresas.reduce((acc, empresa) => {
    const etapa = empresa.etapa_funil || empresa.status || "Novo lead";
    const status = etapa;
    const teveContato = Boolean(empresa.ultimo_contato) || empresa.abordagem_status === "envio_confirmado";
    const followup = dataDoCampo(empresa.proximo_followup);

    acc.total += 1;
    acc.etapas[ETAPAS_FUNIL.includes(etapa) ? etapa : "Novo lead"] += 1;
    if (empresa.whatsapp || empresa.telefone) acc.comWhatsApp += 1;
    if (empresa.abordagem_status === "whatsapp_aberto") acc.whatsAppsAbertos += 1;
    if (teveContato || status !== "Novo lead") acc.contatosRegistrados += 1;
    if (status === "Contatado" || etapa === "Contatado") acc.contatados += 1;
    if (status === "Aguardando retorno" || etapa === "Aguardando retorno") acc.aguardandoRetorno += 1;
    if (ETAPAS_COM_RESPOSTA.has(status) || ETAPAS_COM_RESPOSTA.has(etapa)) acc.responderam += 1;
    if (status === "Fechado" || etapa === "Fechado") acc.fechados += 1;
    if (status === "Perdido" || etapa === "Perdido") acc.perdidos += 1;
    if (!teveContato && status === "Novo lead") acc.aguardandoAbordagem += 1;
    if (followup) {
      if (followup < hoje) acc.followupsAtrasados += 1;
      if (followup >= hoje && followup < amanha) acc.followupsHoje += 1;
    }

    return acc;
  }, {
    total: 0,
    comWhatsApp: 0,
    whatsAppsAbertos: 0,
    contatosRegistrados: 0,
    contatados: 0,
    aguardandoRetorno: 0,
    responderam: 0,
    fechados: 0,
    perdidos: 0,
    aguardandoAbordagem: 0,
    followupsHoje: 0,
    followupsAtrasados: 0,
    etapas: ETAPAS_FUNIL.reduce((acc, etapa) => ({ ...acc, [etapa]: 0 }), {}),
  });
}

export async function GET(request) {
  try {
    await verificarSessaoAdmin(request);
    const { searchParams } = new URL(request.url);
    const listaId = searchParams.get("lista_id") || "";

    let empresas = [];
    if (listaId) {
      const rels = await adminDb.collection("lista_empresas").where("lista_id", "==", listaId).get();
      const ids = rels.docs.map((doc) => doc.data().empresa_id).filter(Boolean);
      for (let i = 0; i < ids.length; i += 10) {
        const pedaco = ids.slice(i, i + 10);
        if (!pedaco.length) continue;
        const snap = await adminDb.collection("empresas").where("id", "in", pedaco).get();
        snap.forEach((doc) => empresas.push({ id: doc.id, ...doc.data() }));
      }
    } else {
      const empresasSnap = await adminDb.collection("empresas").get();
      empresas = empresasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    const resumoEmpresas = contarEmpresas(empresas);

    const listasProspecaoSnap = await adminDb.collection("listas_prospeccao").get().catch(() => ({ size: 0 }));

    return NextResponse.json({
      status: "success",
      metricas: {
        ...resumoEmpresas,
        listasProspecao: listasProspecaoSnap.size,
        taxaResposta: resumoEmpresas.total
          ? Math.round((resumoEmpresas.responderam / resumoEmpresas.total) * 100)
          : 0,
        taxaFechamento: resumoEmpresas.total
          ? Math.round((resumoEmpresas.fechados / resumoEmpresas.total) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error("[APIs/Dashboard] Falha:", error.message);
    if (error.message.includes("Nao autorizado")) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 401 });
    }
    return NextResponse.json({ status: "error", message: "Erro interno no servidor." }, { status: 500 });
  }
}
