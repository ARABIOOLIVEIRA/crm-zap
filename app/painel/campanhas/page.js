"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Botao from "../../../componentes/Botao";
import Modal from "../../../componentes/Modal";
import { adicionarEmpresasNaCampanha, criarListaProspecao, excluirCampanha, listarEmpresas, listarListasProspecao } from "../../../banco_de_dados/empresas_db";
import { salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";

const FORM_INICIAL = { nome: "", nicho: "", cidade: "Uberlandia", descricao: "" };

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function etapaComercial(empresa) {
  return empresa?.etapa_funil || empresa?.status || "Novo lead";
}

function chaveFilaCampanha(campanhaId) {
  return campanhaId ? `crm_zap_fila_abordagem_ids_${campanhaId}` : "crm_zap_fila_abordagem_ids";
}

export default function PaginaCampanhas() {
  const [campanhas, setCampanhas] = useState([]);
  const [todasEmpresas, setTodasEmpresas] = useState([]);
  const [empresasPorCampanha, setEmpresasPorCampanha] = useState({});
  const [form, setForm] = useState(FORM_INICIAL);
  const [mensagem, setMensagem] = useState("");
  const [campanhaAberta, setCampanhaAberta] = useState(null);
  const [selecionadas, setSelecionadas] = useState([]);
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState(null);
  const [buscaCampanha, setBuscaCampanha] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");

  function registrarMensagem(texto, titulo = "Campanhas") {
    setMensagem(texto);
    window.crmZapNotificar?.(texto, titulo);
  }

  const carregar = useCallback(async function carregar() {
    const [listas, empresas] = await Promise.all([
      listarListasProspecao(),
      listarEmpresas().catch(() => []),
    ]);
    setCampanhas(listas);
    setTodasEmpresas(empresas);
    const agrupadas = {};
    listas.forEach((campanha) => {
      agrupadas[campanha.id] = [];
    });
    empresas.forEach((empresa) => {
      (empresa.lista_ids || []).forEach((listaId) => {
        if (agrupadas[listaId]) agrupadas[listaId].push(empresa);
      });
    });
    setEmpresasPorCampanha(agrupadas);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      carregar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const resumoGeral = useMemo(() => {
    const totalEmpresas = Object.values(empresasPorCampanha).reduce((acc, lista) => acc + lista.length, 0);
    const hoje = hojeIso();
    const empresasUnicas = Array.from(new Map(todasEmpresas.map((empresa) => [empresa.id, empresa])).values());
    const empresasEmCampanhas = Object.values(empresasPorCampanha).flat();
    const followupsHoje = empresasUnicas.filter((empresa) =>
      empresa.proximo_followup === hoje && empresa.followup_status !== "concluido" && empresa.followup_status !== "cancelado"
    ).length;
    const semAbordagem = empresasUnicas.filter((empresa) =>
      etapaComercial(empresa) === "Novo lead" && empresa.abordagem_status !== "envio_confirmado"
    ).length;
    const responderamSemProximaAcao = empresasUnicas.filter((empresa) =>
      etapaComercial(empresa) === "Respondeu" && !empresa.proximo_followup
    ).length;
    const pendentesAbordagem = empresasEmCampanhas.filter((empresa) =>
      etapaComercial(empresa) === "Novo lead" &&
      empresa.abordagem_status !== "envio_confirmado" &&
      (empresa.whatsapp || empresa.telefone)
    ).length;
    const enviados = empresasEmCampanhas.filter((empresa) => empresa.abordagem_status === "envio_confirmado").length;
    const respostas = empresasEmCampanhas.filter((empresa) =>
      ["Respondeu", "Aguardando retorno", "Reuniao marcada", "Proposta enviada", "Fechado"].includes(etapaComercial(empresa))
    ).length;
    return { campanhas: campanhas.length, totalEmpresas, empresasUnicas: empresasUnicas.length, followupsHoje, semAbordagem, responderamSemProximaAcao, pendentesAbordagem, enviados, respostas };
  }, [campanhas, empresasPorCampanha, todasEmpresas]);

  function metricasOperacionais(empresas = []) {
    const hoje = hojeIso();
    const pendentesAbordagem = empresas.filter((empresa) =>
      etapaComercial(empresa) === "Novo lead" &&
      empresa.abordagem_status !== "envio_confirmado" &&
      (empresa.whatsapp || empresa.telefone)
    ).length;
    const enviados = empresas.filter((empresa) => empresa.abordagem_status === "envio_confirmado").length;
    const respostas = empresas.filter((empresa) =>
      ["Respondeu", "Aguardando retorno", "Reuniao marcada", "Proposta enviada", "Fechado"].includes(etapaComercial(empresa))
    ).length;
    const followupsHoje = empresas.filter((empresa) =>
      empresa.proximo_followup === hoje &&
      empresa.followup_status !== "concluido" &&
      empresa.followup_status !== "cancelado"
    ).length;
    return { pendentesAbordagem, enviados, respostas, followupsHoje };
  }

  function situacaoCampanha(metricasCampanha) {
    if (metricasCampanha.followupsHoje > 0) return "Follow-up hoje";
    if (metricasCampanha.respostas > 0) return "Com respostas";
    if (metricasCampanha.pendentesAbordagem > 0) return "Precisa abordar";
    if (metricasCampanha.enviados > 0) return "Em acompanhamento";
    return "Sem leads";
  }

  const campanhasComMetricas = useMemo(() => {
    const texto = buscaCampanha.toLowerCase().trim();
    return campanhas
      .map((campanha) => {
        const empresas = empresasPorCampanha[campanha.id] || [];
        const op = metricasOperacionais(empresas);
        const situacao = situacaoCampanha(op);
        const prioridade = op.followupsHoje * 4 + op.respostas * 3 + op.pendentesAbordagem * 2 + op.enviados;
        return { campanha, empresas, op, situacao, prioridade };
      })
      .filter(({ campanha, situacao }) => {
        const bateTexto = !texto || [campanha.nome, campanha.nicho, campanha.cidade].filter(Boolean).join(" ").toLowerCase().includes(texto);
        const bateSituacao = !filtroSituacao || situacao === filtroSituacao;
        return bateTexto && bateSituacao;
      })
      .sort((a, b) => b.prioridade - a.prioridade || String(b.campanha.atualizado_em || "").localeCompare(String(a.campanha.atualizado_em || "")));
  }, [campanhas, empresasPorCampanha, buscaCampanha, filtroSituacao]);

  async function criarCampanha(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const campanha = await criarListaProspecao({
      ...form,
      termo_busca: form.nicho,
      origem: "manual",
      status: "ativa",
    });
    registrarMensagem("Campanha criada. Agora você pode buscar leads no Maps e importar para ela.", "Campanha criada");
    setForm(FORM_INICIAL);
    salvarCampanhaAtiva(campanha.id);
    await carregar();
  }

  function abrirCampanha(campanha, rota) {
    salvarCampanhaAtiva(campanha.id);
    window.location.assign(rota);
  }

  function buscarLeads(campanha) {
    salvarCampanhaAtiva(campanha.id);
    window.location.assign("/painel/empresas?abrirBusca=1");
  }

  function criarAbordagem(campanha) {
    salvarCampanhaAtiva(campanha.id);
    const ids = (empresasPorCampanha[campanha.id] || [])
      .filter((empresa) => empresa.whatsapp || empresa.telefone)
      .map((empresa) => empresa.id);
    window.localStorage.setItem(chaveFilaCampanha(campanha.id), JSON.stringify(ids));
    window.localStorage.setItem("crm_zap_fila_abordagem_ids", JSON.stringify(ids));
    window.location.assign("/painel/abordagens");
  }

  function metricas(campanhaId) {
    const empresas = empresasPorCampanha[campanhaId] || [];
    return {
      total: empresas.length,
      whatsapp: empresas.filter((e) => e.whatsapp || e.telefone).length,
      contatados: empresas.filter((e) => etapaComercial(e) !== "Novo lead").length,
      responderam: empresas.filter((e) => ["Respondeu", "Aguardando retorno", "Reuniao marcada", "Proposta enviada", "Fechado"].includes(etapaComercial(e))).length,
      followups: empresas.filter((e) => e.proximo_followup && e.followup_status !== "concluido" && e.followup_status !== "cancelado").length,
      followupsHoje: empresas.filter((e) => e.proximo_followup === hojeIso() && e.followup_status !== "concluido" && e.followup_status !== "cancelado").length,
      fechados: empresas.filter((e) => etapaComercial(e) === "Fechado").length,
    };
  }

  function abrirAdicionar(campanha) {
    setCampanhaAberta(campanha);
    setSelecionadas([]);
    setBuscaEmpresa("");
  }

  function alternarEmpresa(id) {
    setSelecionadas((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
  }

  const empresasDisponiveis = useMemo(() => {
    if (!campanhaAberta) return [];
    const texto = buscaEmpresa.toLowerCase().trim();
    return todasEmpresas
      .filter((empresa) => !(empresa.lista_ids || []).includes(campanhaAberta.id))
      .filter((empresa) => {
        if (!texto) return true;
        return [empresa.nome, empresa.nicho, empresa.cidade, empresa.whatsapp].filter(Boolean).join(" ").toLowerCase().includes(texto);
      });
  }, [todasEmpresas, campanhaAberta, buscaEmpresa]);

  async function salvarVinculos() {
    if (!campanhaAberta || !selecionadas.length) return;
    await adicionarEmpresasNaCampanha(campanhaAberta.id, selecionadas);
    registrarMensagem(`${selecionadas.length} empresa(s) adicionada(s) na campanha.`, "Empresas adicionadas");
    setCampanhaAberta(null);
    setSelecionadas([]);
    await carregar();
  }

  async function removerCampanha(campanha) {
    setConfirmacaoExclusao(null);
    await excluirCampanha(campanha.id);
    registrarMensagem("Campanha excluida. As empresas continuam cadastradas.", "Campanha excluida");
    salvarCampanhaAtiva("");
    await carregar();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Campanhas</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Organize leads por nicho, cidade ou disparo. Ex: Lash Julho, Pizzarias Centro, Agro Triângulo.
        </p>
      </div>

      {mensagem && <div className="glass-panel" style={{ padding: 12, color: "var(--primary)", fontWeight: 700 }}>{mensagem}</div>}

      <section className="glass-panel" style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "stretch" }}>
        {[
          ["Campanhas ativas", resumoGeral.campanhas],
          ["Leads em campanhas", resumoGeral.totalEmpresas],
          ["Pendentes de abordagem", resumoGeral.pendentesAbordagem],
          ["Leads enviados", resumoGeral.enviados],
          ["Respostas", resumoGeral.respostas],
          ["Follow-ups hoje", resumoGeral.followupsHoje],
        ].map(([label, valor]) => (
          <div key={label} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 14, background: "#fff" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{valor}</div>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          ["Empresas únicas", resumoGeral.empresasUnicas],
          ["Sem abordagem", resumoGeral.semAbordagem],
          ["Responderam sem ação", resumoGeral.responderamSemProximaAcao],
        ].map(([label, valor]) => (
          <div key={label} className="glass-panel" style={{ padding: 16 }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{valor}</div>
          </div>
        ))}
      </div>

      <form onSubmit={criarCampanha} className="glass-panel" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 12, padding: 14, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nome da campanha</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Pizzarias Uberlandia - Julho" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nicho</label>
          <input value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} placeholder="Pizzaria" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cidade</label>
          <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        </div>
        <Botao type="submit">Criar campanha</Botao>
      </form>

      <section className="glass-panel" style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 260px) auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Buscar campanha</label>
          <input
            value={buscaCampanha}
            onChange={(e) => setBuscaCampanha(e.target.value)}
            placeholder="Nome, nicho ou cidade"
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Situação</label>
          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value)}
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}
          >
            <option value="">Todas</option>
            <option value="Follow-up hoje">Follow-up hoje</option>
            <option value="Com respostas">Com respostas</option>
            <option value="Precisa abordar">Precisa abordar</option>
            <option value="Em acompanhamento">Em acompanhamento</option>
            <option value="Sem leads">Sem leads</option>
          </select>
        </div>
        <Botao tipo="outline" onClick={() => { setBuscaCampanha(""); setFiltroSituacao(""); }}>Limpar</Botao>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {campanhasComMetricas.length === 0 && (
          <div className="glass-panel" style={{ padding: 24, color: "var(--text-secondary)", textAlign: "center", gridColumn: "1 / -1" }}>
            Nenhuma campanha encontrada com os filtros atuais.
          </div>
        )}
        {campanhasComMetricas.map(({ campanha, situacao, op }) => {
          const m = metricas(campanha.id);
          return (
            <section key={campanha.id} className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{campanha.nome}</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>{campanha.nicho || "Geral"} - {campanha.cidade || "Uberlandia"}</p>
                </div>
                <span style={{ flex: "0 0 auto", background: op.followupsHoje || op.respostas || op.pendentesAbordagem ? "var(--success-soft)" : "#f8fafc", color: op.followupsHoje || op.respostas || op.pendentesAbordagem ? "var(--primary)" : "var(--text-secondary)", border: "1px solid var(--panel-border)", borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 800 }}>
                  {situacao}
                </span>
              </div>
              <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10, background: "#fff" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Próxima melhor ação</div>
                <strong style={{ fontSize: 14 }}>
                  {op.followupsHoje > 0
                    ? `Fazer ${op.followupsHoje} follow-up(s) hoje`
                    : op.respostas > 0
                      ? `Tratar ${op.respostas} resposta(s)`
                      : op.pendentesAbordagem > 0
                        ? `Abordar ${op.pendentesAbordagem} lead(s)`
                        : m.total > 0
                          ? "Acompanhar campanha"
                          : "Buscar leads para começar"}
                </strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, textAlign: "center" }}>
                {[["Leads", m.total], ["Whats", m.whatsapp], ["Contato", m.contatados], ["Resp.", m.responderam], ["Hoje", m.followupsHoje], ["Fech.", m.fechados]].map(([label, valor]) => (
                  <div key={label} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 8, background: "#fff" }}>
                    <strong>{valor}</strong>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Botao onClick={() => buscarLeads(campanha)} style={{ padding: "8px", fontSize: 12 }}>Buscar leads</Botao>
                <Botao onClick={() => criarAbordagem(campanha)} style={{ padding: "8px", fontSize: 12 }}>Criar abordagem</Botao>
                <Botao tipo="outline" onClick={() => abrirCampanha(campanha, "/painel/empresas")} style={{ padding: "8px", fontSize: 12 }}>Empresas</Botao>
                <Botao tipo="outline" onClick={() => abrirCampanha(campanha, "/painel/funil")} style={{ padding: "8px", fontSize: 12 }}>Funil</Botao>
                <Botao tipo="outline" onClick={() => abrirCampanha(campanha, "/painel/followups")} style={{ padding: "8px", fontSize: 12 }}>Follow-ups</Botao>
                <Botao tipo="outline" onClick={() => abrirCampanha(campanha, "/painel/dashboard")} style={{ padding: "8px", fontSize: 12 }}>Dashboard</Botao>
                <Botao tipo="outline" onClick={() => abrirAdicionar(campanha)} style={{ padding: "8px", fontSize: 12 }}>Adicionar empresas</Botao>
                <Botao tipo="danger" onClick={() => setConfirmacaoExclusao(campanha)} style={{ padding: "8px", fontSize: 12 }}>Excluir campanha</Botao>
              </div>
            </section>
          );
        })}
      </div>

      <Modal aberto={Boolean(campanhaAberta)} titulo={`Adicionar empresas - ${campanhaAberta?.nome || ""}`} aoFechar={() => setCampanhaAberta(null)}>
        <input value={buscaEmpresa} onChange={(e) => setBuscaEmpresa(e.target.value)} placeholder="Buscar empresa por nome, nicho, cidade ou WhatsApp" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{selecionadas.length} selecionada(s)</span>
          <Botao onClick={salvarVinculos} disabled={!selecionadas.length}>Adicionar selecionadas</Botao>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {empresasDisponiveis.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>Nenhuma empresa disponível para adicionar.</p>
          ) : empresasDisponiveis.map((empresa) => (
            <label key={empresa.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={selecionadas.includes(empresa.id)} onChange={() => alternarEmpresa(empresa.id)} />
              <span>
                <strong>{empresa.nome}</strong>
                <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{empresa.nicho || empresa.categoria || "Geral"} - {empresa.whatsapp || "sem WhatsApp"}</div>
              </span>
            </label>
          ))}
        </div>
      </Modal>

      <Modal aberto={Boolean(confirmacaoExclusao)} titulo="Excluir campanha" aoFechar={() => setConfirmacaoExclusao(null)}>
        {confirmacaoExclusao && (
          <>
            <p style={{ color: "var(--text-secondary)" }}>
              A campanha &quot;{confirmacaoExclusao.nome}&quot; será excluída. As empresas continuam cadastradas no CRM.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Botao tipo="outline" onClick={() => setConfirmacaoExclusao(null)}>Cancelar</Botao>
              <Botao tipo="danger" onClick={() => removerCampanha(confirmacaoExclusao)}>Excluir campanha</Botao>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
