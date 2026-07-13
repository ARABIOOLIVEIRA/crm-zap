"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Botao from "../../../componentes/Botao";
import Input from "../../../componentes/Input";
import Modal from "../../../componentes/Modal";
import Tabela from "../../../componentes/Tabela";
import {
  STATUS_LEAD,
  adicionarEmpresasNaCampanha,
  atualizarCamposEmpresa,
  cadastrarEmpresa,
  criarLinkWhatsApp,
  criarMensagemPadrao,
  editarEmpresa,
  excluirEmpresa,
  excluirEmpresasEmLote,
  importarEmpresasEmLoteComLista,
  listarListasProspecao,
  listarEmpresas,
  normalizarTelefone,
} from "../../../banco_de_dados/empresas_db";
import { obterCampanhaAtiva, salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";
import { adicionarHistoricoEmpresa, criarItemHistorico } from "../../../utilitarios/historicoEmpresa";

const FORM_INICIAL = {
  nome: "",
  nicho: "",
  descricao: "",
  bairro: "",
  endereco: "",
  cidade: "Uberlandia",
  telefone: "",
  whatsapp: "",
  site: "",
  avaliacao_google: "",
  total_avaliacoes: "",
  origem: "Manual",
  status: "Novo lead",
  observacoes: "",
  mensagem_sugerida: "",
  proximo_followup: "",
};

function empresaDaLinhaPlanilha(linha) {
  const nome = String(linha.Nome || linha.nome || linha.Empresa || linha["Razao Social"] || "").trim();
  const whatsapp = normalizarTelefone(linha.WhatsApp || linha.whatsapp || linha.Telefone || linha.telefone || "");
  const endereco = String(linha.Endereco || linha.endereco || linha["Endereco"] || "").trim();
  const nicho = String(linha.Nicho || linha.nicho || linha.Categoria || linha.categoria || linha.Query_Busca || "Geral").trim();
  const avaliacao = linha["Nota Google"] || linha.Avaliacao || linha.avaliacao || linha.Nota || "";
  const site = String(linha.Site || linha.site || linha.Google_Maps_URL || linha.Link || "").trim();

  return {
    nome,
    nicho,
    endereco,
    bairro: String(linha.Bairro || linha.bairro || "").trim(),
    cidade: String(linha.Cidade || linha.cidade || "Uberlandia").trim(),
    telefone: whatsapp,
    whatsapp,
    site,
    avaliacao_google: avaliacao,
    origem: "Planilha",
    status: "Novo lead",
    observacoes: "",
  };
}

function textoResumoStatus(empresas) {
  const total = empresas.length;
  const comWhatsApp = empresas.filter((e) => e.whatsapp).length;
  const contatados = empresas.filter((e) => e.status && e.status !== "Novo lead").length;
  return { total, comWhatsApp, contatados };
}

function apenasNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function variantesTelefone(valor) {
  const numeros = apenasNumeros(valor);
  if (!numeros) return [];
  const semPais = numeros.startsWith("55") && numeros.length > 11 ? numeros.slice(2) : numeros;
  return Array.from(new Set([
    numeros,
    semPais,
    numeros.slice(-11),
    numeros.slice(-10),
    numeros.slice(-9),
    numeros.slice(-8),
    semPais.slice(-11),
    semPais.slice(-10),
    semPais.slice(-9),
    semPais.slice(-8),
  ].filter((item) => item.length >= 4)));
}

function telefoneCombina(busca, valores) {
  const buscaVariantes = variantesTelefone(busca);
  if (!buscaVariantes.length) return false;
  const valorVariantes = valores.flatMap(variantesTelefone);
  return buscaVariantes.some((buscaItem) =>
    valorVariantes.some((valorItem) => valorItem.includes(buscaItem) || buscaItem.includes(valorItem))
  );
}

function dadosFunilAposEnvio(empresa) {
  const etapaAtual = empresa?.etapa_funil || empresa?.status || "Novo lead";
  if (etapaAtual === "Novo lead") {
    return {
      status: "Contatado",
      etapa_funil: "Contatado",
      detalhe: "Funil avancou de Novo lead para Contatado.",
    };
  }
  return {
    detalhe: `Funil mantido em ${etapaAtual}.`,
  };
}

function chaveFilaCampanha(campanhaId) {
  return campanhaId ? `crm_zap_fila_abordagem_ids_${campanhaId}` : "crm_zap_fila_abordagem_ids";
}

export default function PaginaEmpresas() {
  const [empresas, setEmpresas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [selecionados, setSelecionados] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroLista, setFiltroLista] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [listas, setListas] = useState([]);
  const [cardAberto, setCardAberto] = useState(null);
  const [detalhesCard, setDetalhesCard] = useState({
    status: "Novo lead",
    observacoes: "",
    proximo_followup: "",
    followup_observacao: "",
    mensagem_sugerida: "",
  });

  const [modalBuscaAberto, setModalBuscaAberto] = useState(false);
  const [termoBuscaMaps, setTermoBuscaMaps] = useState("");
  const [nomeListaBusca, setNomeListaBusca] = useState("");
  const [nichoListaBusca, setNichoListaBusca] = useState("");
  const [cidadeListaBusca, setCidadeListaBusca] = useState("Uberlandia");
  const [listaExistenteBusca, setListaExistenteBusca] = useState("");
  const [resumoImportacao, setResumoImportacao] = useState(null);
  const [buscandoMaps, setBuscandoMaps] = useState(false);
  const [resultadosMaps, setResultadosMaps] = useState([]);
  const [selecionadosMaps, setSelecionadosMaps] = useState([]);
  const [importandoMaps, setImportandoMaps] = useState(false);

  async function carregarEmpresas() {
    setCarregando(true);
    try {
      const ativa = obterCampanhaAtiva();
      if (ativa && !filtroLista) setFiltroLista(ativa);
      const dados = await listarEmpresas(ativa ? { lista_id: ativa } : {});
      setEmpresas(dados);
      setListas(await listarListasProspecao().catch(() => []));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEmpresas();
  }, []);

  useEffect(() => {
    if (!listas.length || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("abrirBusca") !== "1") return;
    const campanhaAtual = listas.find((lista) => lista.id === (filtroLista || obterCampanhaAtiva()));
    if (campanhaAtual) {
      setListaExistenteBusca(campanhaAtual.id);
      setNomeListaBusca(campanhaAtual.nome || "");
      setNichoListaBusca(campanhaAtual.nicho || "");
      setCidadeListaBusca(campanhaAtual.cidade || "Uberlandia");
      setTermoBuscaMaps(campanhaAtual.termo_busca || campanhaAtual.nicho || campanhaAtual.nome || "");
    }
    setModalBuscaAberto(true);
    window.history.replaceState({}, "", "/painel/empresas");
  }, [listas, filtroLista]);

  useEffect(() => {
    if (!cardAberto) return;
    setDetalhesCard({
      status: cardAberto.etapa_funil || cardAberto.status || "Novo lead",
      observacoes: cardAberto.observacoes || "",
      proximo_followup: cardAberto.proximo_followup || "",
      followup_observacao: cardAberto.followup_observacao || "",
      mensagem_sugerida: cardAberto.mensagem_sugerida || criarMensagemPadrao(cardAberto),
    });
  }, [cardAberto]);

  async function aplicarFiltroLista(listaId) {
    setFiltroLista(listaId);
    salvarCampanhaAtiva(listaId);
    setCarregando(true);
    try {
      const dados = await listarEmpresas(listaId ? { lista_id: listaId } : {});
      setEmpresas(dados);
      setSelecionados([]);
    } finally {
      setCarregando(false);
    }
  }

  const empresasFiltradas = useMemo(() => {
    const texto = buscaTexto.toLowerCase().trim();
    return empresas.filter((empresa) => {
      const bateStatus = !filtroStatus || empresa.status === filtroStatus;
      const textoEmpresa = [empresa.nome, empresa.nicho, empresa.bairro, empresa.whatsapp, empresa.telefone, empresa.endereco]
          .filter(Boolean)
          .join(" ")
        .toLowerCase();
      const bateTexto =
        !texto ||
        textoEmpresa.includes(texto) ||
        telefoneCombina(texto, [empresa.whatsapp, empresa.telefone, empresa.whatsapp_normalizado, empresa.telefone_normalizado]);
      return bateStatus && bateTexto;
    });
  }, [empresas, filtroStatus, buscaTexto]);

  const resumo = useMemo(() => textoResumoStatus(empresas), [empresas]);

  async function atualizarEmpresaComHistorico(empresa, campos, titulo, detalhe) {
    const historico_atividades = adicionarHistoricoEmpresa(empresa, titulo, detalhe);
    await atualizarCamposEmpresa(empresa.id, { ...campos, historico_atividades });
    setEmpresas((lista) =>
      lista.map((item) => (item.id === empresa.id ? { ...item, ...campos, historico_atividades } : item))
    );
    setCardAberto((atual) => (atual?.id === empresa.id ? { ...atual, ...campos, historico_atividades } : atual));
  }

  function limparFormulario() {
    setForm(FORM_INICIAL);
    setEmpresaEditando(null);
  }

  function abrirCadastro() {
    limparFormulario();
    setModalAberto(true);
  }

  function abrirEdicao(empresa) {
    setEmpresaEditando(empresa);
    setForm({
      ...FORM_INICIAL,
      ...empresa,
      nicho: empresa.nicho || empresa.categoria || "",
      avaliacao_google: String(empresa.avaliacao_google || empresa.avaliacao || ""),
      total_avaliacoes: String(empresa.total_avaliacoes || ""),
      proximo_followup: empresa.proximo_followup || "",
    });
    setModalAberto(true);
  }

  function abrirCard(empresa) {
    setCardAberto(empresa);
  }

  async function salvarDetalhesCard() {
    if (!cardAberto) return;
    try {
      const campos = {
        status: detalhesCard.status,
        etapa_funil: detalhesCard.status,
        observacoes: detalhesCard.observacoes,
        proximo_followup: detalhesCard.proximo_followup || "",
        followup_status: detalhesCard.proximo_followup ? "pendente" : cardAberto.followup_status || "",
        followup_observacao: detalhesCard.followup_observacao,
        mensagem_sugerida: detalhesCard.mensagem_sugerida,
      };
      await atualizarEmpresaComHistorico(cardAberto, campos, "Card atualizado", "Dados, observacoes ou follow-up atualizados no card da empresa.");
      alert("Card salvo.");
    } catch (erro) {
      alert("Erro ao salvar card: " + erro.message);
    }
  }

  async function salvarEmpresa(e) {
    e.preventDefault();
    const dados = {
      ...form,
      whatsapp: normalizarTelefone(form.whatsapp || form.telefone),
      mensagem_sugerida: form.mensagem_sugerida || criarMensagemPadrao(form),
    };

    try {
      if (empresaEditando) {
        await editarEmpresa(empresaEditando.id, dados);
        await atualizarCamposEmpresa(empresaEditando.id, {
          historico_atividades: adicionarHistoricoEmpresa(empresaEditando, "Empresa editada", "Cadastro atualizado manualmente."),
        });
      } else {
        const id = await cadastrarEmpresa(dados);
        const historico_atividades = [criarItemHistorico("Empresa cadastrada", filtroLista ? "Criada dentro da campanha ativa." : "Criada manualmente.")];
        await atualizarCamposEmpresa(id, { historico_atividades });
        if (filtroLista) {
          await adicionarEmpresasNaCampanha(filtroLista, [id]);
        }
      }
      setModalAberto(false);
      limparFormulario();
      await carregarEmpresas();
    } catch (erro) {
      alert("Erro ao salvar empresa: " + erro.message);
    }
  }

  async function alterarStatus(empresa, status) {
    try {
      const campos = {
        status,
        etapa_funil: status,
        ultimo_contato: ["Contatado", "Respondeu"].includes(status) ? new Date().toISOString() : empresa.ultimo_contato || null,
      };
      await atualizarEmpresaComHistorico(empresa, campos, "Status alterado", `${empresa.status || "Novo lead"} -> ${status}`);
    } catch (erro) {
      alert("Erro ao atualizar status: " + erro.message);
    }
  }

  async function salvarObservacaoRapida(empresa, observacoes) {
    try {
      await atualizarEmpresaComHistorico(empresa, { observacoes }, "Observacao atualizada", observacoes || "Observacao limpa.");
    } catch (erro) {
      alert("Erro ao salvar observacao: " + erro.message);
    }
  }

  async function registrarContatoManual(empresa) {
    const link = criarLinkWhatsApp(empresa);
    if (!link) {
      alert("Esta empresa nao tem WhatsApp valido.");
      return;
    }
    try {
      const campos = {
        abordagem_status: "whatsapp_aberto",
        ultima_abordagem_em: new Date().toISOString(),
      };
      await atualizarEmpresaComHistorico(empresa, campos, "WhatsApp aberto", "Link do WhatsApp aberto pela aba Empresas.");
    } catch (erro) {
      alert("Nao consegui registrar a abertura no CRM: " + erro.message);
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function confirmarContatoManual(empresa) {
    try {
      const dadosFunil = dadosFunilAposEnvio(empresa);
      const campos = {
        abordagem_status: "envio_confirmado",
        ultimo_contato: new Date().toISOString(),
        ...(dadosFunil.status ? { status: dadosFunil.status, etapa_funil: dadosFunil.etapa_funil } : {}),
      };
      await atualizarEmpresaComHistorico(empresa, campos, "Mensagem enviada", `Contato marcado como enviado manualmente. ${dadosFunil.detalhe}`);
    } catch (erro) {
      alert("Erro ao marcar contato enviado: " + erro.message);
    }
  }

  async function marcarComoRespondeu(empresa) {
    try {
      const campos = {
        abordagem_status: "respondeu",
        ultimo_contato: new Date().toISOString(),
        status: "Respondeu",
        etapa_funil: "Respondeu",
      };
      await atualizarEmpresaComHistorico(empresa, campos, "Cliente respondeu", "Lead marcado como respondeu.");
    } catch (erro) {
      alert("Erro ao marcar como respondeu: " + erro.message);
    }
  }

  function criarFilaAbordagem() {
    if (!selecionados.length) return;
    window.localStorage.setItem(chaveFilaCampanha(filtroLista || obterCampanhaAtiva()), JSON.stringify(selecionados));
    window.localStorage.setItem("crm_zap_fila_abordagem_ids", JSON.stringify(selecionados));
    window.location.href = "/painel/abordagens";
  }

  async function adicionarSelecionadosNaCampanhaAtual() {
    if (!selecionados.length || !filtroLista) return;
    await adicionarEmpresasNaCampanha(filtroLista, selecionados);
    alert(`${selecionados.length} empresa(s) adicionada(s) na campanha atual.`);
    setSelecionados([]);
    await carregarEmpresas();
  }

  async function removerEmpresa(id) {
    if (!confirm("Excluir esta empresa do CRM?")) return;
    try {
      await excluirEmpresa(id);
      await carregarEmpresas();
    } catch (erro) {
      alert("Erro ao excluir empresa: " + erro.message);
    }
  }

  async function removerSelecionados() {
    if (!selecionados.length) return;
    if (!confirm(`Excluir ${selecionados.length} empresa(s) selecionada(s)?`)) return;
    try {
      await excluirEmpresasEmLote(selecionados);
      setSelecionados([]);
      await carregarEmpresas();
    } catch (erro) {
      alert("Erro ao excluir empresas: " + erro.message);
    }
  }

  function alternarSelecao(id) {
    setSelecionados((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    );
  }

  function alternarTodos() {
    if (selecionados.length === empresasFiltradas.length) {
      setSelecionados([]);
    } else {
      setSelecionados(empresasFiltradas.map((empresa) => empresa.id));
    }
  }

  async function importarPlanilha(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = async (evento) => {
      try {
        const livro = XLSX.read(evento.target.result, { type: "binary" });
        const nomeAba = livro.SheetNames[0];
        const linhas = XLSX.utils.sheet_to_json(livro.Sheets[nomeAba]);
        const formatadas = linhas.map(empresaDaLinhaPlanilha).filter((empresa) => empresa.nome && empresa.whatsapp);

        const novas = formatadas.filter((empresa) => {
          return !empresas.some((existente) => {
            const mesmoWhats = existente.whatsapp && empresa.whatsapp && existente.whatsapp === empresa.whatsapp;
            const mesmoNome = existente.nome && empresa.nome && existente.nome.toLowerCase() === empresa.nome.toLowerCase();
            return mesmoWhats || mesmoNome;
          });
        });

        if (!novas.length) {
          alert("Nenhuma empresa nova encontrada na planilha.");
          return;
        }

        if (!filtroLista) {
          alert("Selecione ou crie uma campanha antes de importar planilha. Assim os leads nao ficam soltos.");
          return;
        }
        const campanhaAtual = listas.find((lista) => lista.id === filtroLista);
        const resultado = await importarEmpresasEmLoteComLista(novas, {
          id: filtroLista,
          nome: campanhaAtual?.nome || "Campanha selecionada",
          nicho: campanhaAtual?.nicho || "",
          cidade: campanhaAtual?.cidade || "Uberlandia",
          origem: "planilha",
          status: "ativa",
        });
        alert(`${resultado.novas || resultado.total || 0} empresa(s) importada(s) na campanha.`);
        await carregarEmpresas();
      } catch (erro) {
        alert("Erro ao importar planilha: " + erro.message);
      }
    };

    leitor.readAsBinaryString(arquivo);
    e.target.value = null;
  }

  function exportarExcel() {
    const dados = empresasFiltradas.map((empresa) => ({
      Nome: empresa.nome || "",
      Nicho: empresa.nicho || empresa.categoria || "",
      WhatsApp: empresa.whatsapp || "",
      Status: empresa.status || "",
      Bairro: empresa.bairro || "",
      Endereco: empresa.endereco || "",
      Nota_Google: empresa.avaliacao_google || "",
      Origem: empresa.origem || "",
      Observacoes: empresa.observacoes || "",
      Mensagem_WhatsApp: empresa.mensagem_sugerida || "",
    }));

    const planilha = XLSX.utils.json_to_sheet(dados);
    const arquivo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(arquivo, planilha, "Empresas");
    XLSX.writeFile(arquivo, "crm_zap_empresas.xlsx");
  }

  async function buscarNoMaps(e) {
    e.preventDefault();
    if (!termoBuscaMaps.trim()) return;
    setBuscandoMaps(true);
    setResultadosMaps([]);
    setSelecionadosMaps([]);
    setResumoImportacao(null);

    try {
      const response = await fetch(`/api/integracoes/busca_mapa?query=${encodeURIComponent(termoBuscaMaps)}`);
      const data = await response.json();
      if (data.status !== "success") {
        throw new Error(data.message || "Falha ao buscar no Maps.");
      }

      setResultadosMaps(
        (data.results || []).map((local) => ({
          ...local,
          nicho: termoBuscaMaps,
          categoria: termoBuscaMaps,
          termo_busca: termoBuscaMaps,
          origem: "Google Maps",
          status: "Novo lead",
          whatsapp: normalizarTelefone(local.whatsapp || local.telefone),
          avaliacao_google: local.avaliacao || 0,
          mensagem_sugerida: criarMensagemPadrao({ nome: local.nome, nicho: termoBuscaMaps }),
        }))
      );
    } catch (erro) {
      alert("Erro na busca: " + erro.message);
    } finally {
      setBuscandoMaps(false);
    }
  }

  function alternarSelecaoMaps(index) {
    setSelecionadosMaps((atuais) =>
      atuais.includes(index) ? atuais.filter((item) => item !== index) : [...atuais, index]
    );
  }

  async function importarSelecionadosMaps() {
    const escolhidas = selecionadosMaps.map((index) => resultadosMaps[index]).filter(Boolean);
    if (!escolhidas.length) return;
    setImportandoMaps(true);

    try {
      const listaProspecao = {
        id: listaExistenteBusca || "",
        nome: listaExistenteBusca
          ? listas.find((lista) => lista.id === listaExistenteBusca)?.nome
          : (nomeListaBusca || `${termoBuscaMaps} - ${cidadeListaBusca}`),
        nicho: nichoListaBusca || termoBuscaMaps,
        cidade: cidadeListaBusca || "Uberlandia",
        estado: "MG",
        termo_busca: termoBuscaMaps,
        origem: "google_maps",
        status: "ativa",
      };

      const resultado = await importarEmpresasEmLoteComLista(escolhidas, listaProspecao);
      setResumoImportacao(resultado);
      alert(`Pesquisa concluida\nResultados: ${escolhidas.length}\nNovas empresas: ${resultado.novas || 0}\nJa cadastradas: ${resultado.existentes || 0}\nSem WhatsApp: ${resultado.semWhatsapp || 0}`);
      setModalBuscaAberto(false);
      setTermoBuscaMaps("");
      setResultadosMaps([]);
      setSelecionadosMaps([]);
      setListas(await listarListasProspecao().catch(() => []));
      if (resultado.lista?.id) {
        await aplicarFiltroLista(resultado.lista.id);
      } else {
        await carregarEmpresas();
      }
    } catch (erro) {
      alert("Erro ao importar do Maps: " + erro.message);
    } finally {
      setImportandoMaps(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ color: "var(--text-primary)", fontSize: "26px", fontWeight: 800, marginBottom: "6px" }}>CRM ZAP - Empresas</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Campanha atual: {filtroLista ? listas.find((lista) => lista.id === filtroLista)?.nome || "Campanha selecionada" : "Todas as campanhas"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, auto))", gap: "10px", alignItems: "center" }}>
          {selecionados.length > 0 && (
            <>
              <Botao onClick={criarFilaAbordagem}>Criar abordagem ({selecionados.length})</Botao>
              {filtroLista && <Botao tipo="outline" onClick={adicionarSelecionadosNaCampanhaAtual}>Adicionar na campanha</Botao>}
              <Botao tipo="danger" onClick={removerSelecionados}>Excluir ({selecionados.length})</Botao>
            </>
          )}
          <Botao tipo="outline" onClick={exportarExcel}>Exportar Excel</Botao>
          <Botao onClick={() => setModalBuscaAberto(true)} style={{ backgroundColor: "#2563eb" }}>Buscar no Maps</Botao>
          <Botao tipo="outline" onClick={() => window.location.href = "/painel/campanhas"}>Campanhas</Botao>
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--panel-border)", color: "var(--text-primary)", background: "#fff", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
            Importar
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importarPlanilha} style={{ display: "none" }} />
          </label>
          <Botao onClick={abrirCadastro}>Adicionar Empresa</Botao>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: "12px" }}>
        {[
          ["Total", resumo.total],
          ["Com WhatsApp", resumo.comWhatsApp],
          ["Ja movimentados", resumo.contatados],
        ].map(([label, valor]) => (
          <div key={label} className="glass-panel" style={{ padding: "16px" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
            <div style={{ color: "var(--text-primary)", fontSize: "28px", fontWeight: 800 }}>{valor}</div>
          </div>
        ))}
      </div>

      {resumoImportacao && (
        <div className="glass-panel" style={{ padding: "14px", color: "var(--primary)", fontWeight: 700 }}>
          Pesquisa concluida: {resumoImportacao.novas || 0} novas, {resumoImportacao.existentes || 0} ja cadastradas, {resumoImportacao.semWhatsapp || 0} sem WhatsApp.
        </div>
      )}

      <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "1.3fr 1.1fr 1fr auto", gap: "12px", padding: "16px", alignItems: "end" }}>
        <Input
          type="select"
          label="Campanha"
          value={filtroLista}
          onChange={(e) => aplicarFiltroLista(e.target.value)}
          options={[{ value: "", label: "Todas as campanhas" }, ...listas.map((lista) => ({ value: lista.id, label: lista.nome }))]}
        />
        <Input placeholder="Buscar por nome, nicho, bairro ou numero do WhatsApp" value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} />
        <Input
          type="select"
          label="Etapa"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          options={[{ value: "", label: "Todos os status" }, ...STATUS_LEAD.map((status) => ({ value: status, label: status }))]}
        />
        <Botao tipo="outline" onClick={() => { setBuscaTexto(""); setFiltroStatus(""); aplicarFiltroLista(""); }}>Limpar filtros</Botao>
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Exibindo {empresasFiltradas.length} de {empresas.length} empresas carregadas.</p>

      {carregando ? (
        <div className="glass-panel" style={{ padding: "32px", color: "var(--text-secondary)", textAlign: "center" }}>Carregando empresas...</div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="glass-panel" style={{ padding: "32px", color: "var(--text-secondary)", textAlign: "center" }}>
          Nenhuma empresa encontrada{buscaTexto ? ` para "${buscaTexto}"` : ""}. Limpe filtros de campanha/etapa ou cadastre a empresa.
        </div>
      ) : (
        <Tabela cabecalhos={[
          <input key="check" type="checkbox" checked={selecionados.length === empresasFiltradas.length && empresasFiltradas.length > 0} onChange={alternarTodos} />,
          "Empresa",
          "Nicho",
          "WhatsApp",
          "Status",
          "Observacao",
          "Acoes",
        ]}>
          {empresasFiltradas.map((empresa) => (
            <tr key={empresa.id} style={{ borderBottom: "1px solid var(--panel-border)" }}>
              <td style={{ padding: "14px 16px" }}>
                <input type="checkbox" checked={selecionados.includes(empresa.id)} onChange={() => alternarSelecao(empresa.id)} />
              </td>
              <td style={{ padding: "14px 16px", minWidth: "220px" }}>
                <button
                  type="button"
                  onClick={() => abrirCard(empresa)}
                  style={{ color: "var(--text-primary)", fontWeight: 800, border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  {empresa.nome}
                </button>
                <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{empresa.bairro || empresa.endereco || "Sem endereco"}</div>
              </td>
              <td style={{ padding: "14px 16px" }}>{empresa.nicho || empresa.categoria || "Geral"}</td>
              <td style={{ padding: "14px 16px", color: "#22c55e", fontWeight: 700 }}>{empresa.whatsapp || "-"}</td>
              <td style={{ padding: "14px 16px", minWidth: "170px" }}>
                <select
                  value={empresa.status || "Novo lead"}
                  onChange={(e) => alterarStatus(empresa, e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#ffffff", color: "var(--text-primary)", border: "1px solid var(--panel-border)" }}
                >
                  {STATUS_LEAD.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </td>
              <td style={{ padding: "14px 16px", minWidth: "220px" }}>
                <input
                  defaultValue={empresa.observacoes || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (empresa.observacoes || "")) {
                      salvarObservacaoRapida(empresa, e.target.value);
                    }
                  }}
                  placeholder="Anote algo rapido"
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#ffffff", color: "var(--text-primary)", border: "1px solid var(--panel-border)" }}
                />
              </td>
              <td style={{ padding: "14px 16px", minWidth: 190 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "stretch" }}>
                  <Botao onClick={() => registrarContatoManual(empresa)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap" }}>WhatsApp</Botao>
                  <Botao tipo="outline" onClick={() => confirmarContatoManual(empresa)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap" }}>Enviado</Botao>
                  <Botao tipo="outline" onClick={() => marcarComoRespondeu(empresa)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap" }}>Respondeu</Botao>
                  <Botao tipo="outline" onClick={() => abrirCard(empresa)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap" }}>Abrir</Botao>
                  <Botao tipo="outline" onClick={() => abrirEdicao(empresa)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap" }}>Editar</Botao>
                  <Botao tipo="danger" onClick={() => removerEmpresa(empresa.id)} style={{ padding: "7px", fontSize: "11px", whiteSpace: "nowrap", gridColumn: "1 / -1" }}>Excluir</Botao>
                </div>
              </td>
            </tr>
          ))}
        </Tabela>
      )}

      <Modal aberto={modalAberto} titulo={empresaEditando ? "Editar Empresa" : "Cadastrar Empresa"} aoFechar={() => setModalAberto(false)}>
        <form onSubmit={salvarEmpresa} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <Input label="Nicho" required value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="WhatsApp" required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <Input label="Endereco" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            <Input label="Site / Link" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
          </div>
          <Input
            label="Status"
            type="select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={STATUS_LEAD.map((status) => ({ value: status, label: status }))}
          />
          <Input label="Mensagem para WhatsApp" value={form.mensagem_sugerida} onChange={(e) => setForm({ ...form, mensagem_sugerida: e.target.value })} />
          <Input label="Observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--panel-border)" }}>
            <Botao tipo="outline" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit">Salvar</Botao>
          </div>
        </form>
      </Modal>

      <Modal aberto={Boolean(cardAberto)} titulo={cardAberto?.nome || "Card da empresa"} aoFechar={() => setCardAberto(null)}>
        {cardAberto && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <strong>Status no funil</strong>
                <select
                  value={detalhesCard.status}
                  onChange={(e) => setDetalhesCard({ ...detalhesCard, status: e.target.value })}
                  style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}
                >
                  {STATUS_LEAD.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <strong>Proximo follow-up</strong>
                <input
                  type="date"
                  value={detalhesCard.proximo_followup}
                  onChange={(e) => setDetalhesCard({ ...detalhesCard, proximo_followup: e.target.value })}
                  style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", color: "var(--text-secondary)", fontSize: 13 }}>
              <div><strong style={{ color: "var(--text-primary)" }}>WhatsApp:</strong> {cardAberto.whatsapp || cardAberto.telefone || "sem numero"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Nicho:</strong> {cardAberto.nicho || cardAberto.categoria || "Geral"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Cidade:</strong> {cardAberto.cidade || "Uberlandia"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Origem:</strong> {cardAberto.origem || "-"}</div>
              <div style={{ gridColumn: "1 / -1" }}><strong style={{ color: "var(--text-primary)" }}>Endereco:</strong> {cardAberto.endereco || cardAberto.bairro || "-"}</div>
            </div>

            <div>
              <strong>Mensagem que abre no WhatsApp</strong>
              <textarea
                value={detalhesCard.mensagem_sugerida}
                onChange={(e) => setDetalhesCard({ ...detalhesCard, mensagem_sugerida: e.target.value })}
                style={{ width: "100%", minHeight: 72, marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }}
              />
            </div>

            <div>
              <strong>Observacoes do CRM</strong>
              <textarea
                value={detalhesCard.observacoes}
                onChange={(e) => setDetalhesCard({ ...detalhesCard, observacoes: e.target.value })}
                style={{ width: "100%", minHeight: 90, marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }}
              />
            </div>

            <div>
              <strong>Observacao do follow-up</strong>
              <input
                value={detalhesCard.followup_observacao}
                onChange={(e) => setDetalhesCard({ ...detalhesCard, followup_observacao: e.target.value })}
                placeholder="Ex: retornar com proposta na segunda"
                style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              <Botao onClick={salvarDetalhesCard}>Salvar card</Botao>
              <Botao tipo="outline" onClick={() => registrarContatoManual(cardAberto)}>WhatsApp</Botao>
              <Botao tipo="outline" onClick={() => confirmarContatoManual(cardAberto)}>Marcar enviado</Botao>
              <Botao tipo="outline" onClick={() => marcarComoRespondeu(cardAberto)}>Respondeu</Botao>
            </div>

            <section style={{ borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Historico do card</h4>
              {!(cardAberto.historico_atividades || []).length ? (
                <p style={{ color: "var(--text-secondary)" }}>Nenhuma acao registrada ainda.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                  {(cardAberto.historico_atividades || []).map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10, background: "#fff" }}>
                      <strong>{item.titulo}</strong>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 3 }}>{item.detalhe}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 3 }}>
                        {item.criado_em ? new Date(item.criado_em).toLocaleString("pt-BR") : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </Modal>

      <Modal aberto={modalBuscaAberto} titulo="Buscar Empresas no Google Maps" aoFechar={() => setModalBuscaAberto(false)}>
        <form onSubmit={buscarNoMaps} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Input label="Termo de busca" placeholder="Ex: Lash Designer Uberlandia" value={termoBuscaMaps} onChange={(e) => {
            setTermoBuscaMaps(e.target.value);
            if (!nomeListaBusca) setNomeListaBusca(`${e.target.value} - ${cidadeListaBusca}`);
            if (!nichoListaBusca) setNichoListaBusca(e.target.value);
          }} required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Nome da campanha" value={nomeListaBusca} onChange={(e) => setNomeListaBusca(e.target.value)} placeholder="Lash Designers Uberlandia - Busca 01" />
            <Input label="Nicho" value={nichoListaBusca} onChange={(e) => setNichoListaBusca(e.target.value)} placeholder="Lash Designer" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Cidade" value={cidadeListaBusca} onChange={(e) => setCidadeListaBusca(e.target.value)} />
            <Input
              label="Adicionar a campanha existente"
              type="select"
              value={listaExistenteBusca}
              onChange={(e) => setListaExistenteBusca(e.target.value)}
              options={[{ value: "", label: "Criar nova campanha" }, ...listas.map((lista) => ({ value: lista.id, label: lista.nome }))]}
            />
          </div>
          <Botao type="submit" disabled={buscandoMaps}>{buscandoMaps ? "Buscando..." : "Pesquisar"}</Botao>
        </form>

        {resultadosMaps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "13px" }}>
              <span>{resultadosMaps.length} resultado(s)</span>
              <label style={{ display: "flex", gap: "8px", color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  checked={selecionadosMaps.length === resultadosMaps.length}
                  onChange={() => setSelecionadosMaps(selecionadosMaps.length === resultadosMaps.length ? [] : resultadosMaps.map((_, index) => index))}
                />
                Selecionar todos
              </label>
            </div>

            {resultadosMaps.map((local, index) => (
              <div key={`${local.nome}-${index}`} style={{ display: "flex", gap: "12px", padding: "12px", border: "1px solid var(--panel-border)", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
                <input type="checkbox" checked={selecionadosMaps.includes(index)} onChange={() => alternarSelecaoMaps(index)} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{local.nome}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{local.endereco}</div>
                  <div style={{ color: local.whatsapp ? "#22c55e" : "#ef4444", fontSize: "12px", fontWeight: 700 }}>
                    {local.whatsapp ? local.whatsapp : "Sem telefone no resultado"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {resultadosMaps.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--panel-border)" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{selecionadosMaps.length} selecionado(s)</span>
            <Botao disabled={!selecionadosMaps.length || importandoMaps} onClick={importarSelecionadosMaps}>
              {importandoMaps ? "Importando..." : "Importar selecionados"}
            </Botao>
          </div>
        )}
      </Modal>
    </div>
  );
}
