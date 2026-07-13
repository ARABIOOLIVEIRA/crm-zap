"use client";

import React, { useEffect, useMemo, useState } from "react";
import { STATUS_LEAD, atualizarCamposEmpresa, criarLinkWhatsApp, criarListaProspecao, listarEmpresas, listarListasProspecao } from "../../../banco_de_dados/empresas_db";
import Botao from "../../../componentes/Botao";
import Modal from "../../../componentes/Modal";
import { obterCampanhaAtiva, salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";

function proximoFollowupLabel(data) {
  if (!data) return "Sem follow-up";
  const hoje = new Date().toISOString().slice(0, 10);
  if (data < hoje) return `Atrasado: ${data}`;
  if (data === hoje) return "Follow-up hoje";
  return `Follow-up: ${data}`;
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

export default function PaginaFunil() {
  const [empresas, setEmpresas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [arrastandoId, setArrastandoId] = useState(null);
  const [undo, setUndo] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [listas, setListas] = useState([]);
  const [filtroLista, setFiltroLista] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [ocultarFechados, setOcultarFechados] = useState(true);
  const [limites, setLimites] = useState({});
  const [criandoLista, setCriandoLista] = useState(false);
  const [novaLista, setNovaLista] = useState({ nome: "", nicho: "", cidade: "Uberlandia" });
  const [cardAberto, setCardAberto] = useState(null);
  const [detalhesCard, setDetalhesCard] = useState({ observacoes: "", proximo_followup: "", followup_observacao: "", status: "Novo lead" });

  function registrarMensagem(texto, titulo = "Funil") {
    setMensagem(texto);
    window.crmZapNotificar?.(texto, titulo);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const ativa = filtroLista || obterCampanhaAtiva();
      if (ativa && !filtroLista) setFiltroLista(ativa);
      setEmpresas(await listarEmpresas(ativa ? { lista_id: ativa } : {}));
      setListas(await listarListasProspecao().catch(() => []));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [filtroLista]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 15000);
    return () => clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!cardAberto) return;
    setDetalhesCard({
      observacoes: cardAberto.observacoes || "",
      proximo_followup: cardAberto.proximo_followup || "",
      followup_observacao: cardAberto.followup_observacao || "",
      status: cardAberto.etapa_funil || cardAberto.status || "Novo lead",
    });
  }, [cardAberto]);

  const porStatus = useMemo(() => {
    const texto = buscaTexto.toLowerCase().trim();
    const base = empresas.filter((empresa) => {
      const etapa = empresa.etapa_funil || empresa.status || "Novo lead";
      if (ocultarFechados && ["Fechado", "Perdido"].includes(etapa)) return false;
      if (!texto) return true;

      const textoEmpresa = [empresa.nome, empresa.nicho, empresa.cidade, empresa.whatsapp, empresa.telefone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return textoEmpresa.includes(texto) || telefoneCombina(texto, [empresa.whatsapp, empresa.telefone, empresa.whatsapp_normalizado, empresa.telefone_normalizado]);
    });

    return STATUS_LEAD.reduce((acc, status) => {
      acc[status] = base.filter((empresa) => (empresa.etapa_funil || empresa.status || "Novo lead") === status);
      return acc;
    }, {});
  }, [empresas, buscaTexto, ocultarFechados]);

  function historicoAtualizado(empresa, titulo, detalhe) {
    const item = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      titulo,
      detalhe,
      criado_em: new Date().toISOString(),
    };
    return [item, ...(empresa.historico_atividades || [])].slice(0, 40);
  }

  async function atualizarEmpresaComHistorico(empresa, campos, titulo, detalhe) {
    const historico_atividades = historicoAtualizado(empresa, titulo, detalhe);
    await atualizarCamposEmpresa(empresa.id, { ...campos, historico_atividades });
    setEmpresas((lista) =>
      lista.map((item) => (item.id === empresa.id ? { ...item, ...campos, historico_atividades } : item))
    );
    setCardAberto((atual) => atual?.id === empresa.id ? { ...atual, ...campos, historico_atividades } : atual);
  }

  async function moverEmpresa(empresa, novaEtapa) {
    const etapaAnterior = empresa.etapa_funil || empresa.status || "Novo lead";
    if (!empresa?.id || etapaAnterior === novaEtapa) return;

    try {
      const agora = new Date().toISOString();
      const campos = {
        etapa_funil: novaEtapa,
        status: novaEtapa,
        etapa_anterior: etapaAnterior,
        ultimo_contato: ["Contatado", "Respondeu"].includes(novaEtapa) ? agora : empresa.ultimo_contato || null,
        ultima_alteracao_funil_em: agora,
      };

      await atualizarEmpresaComHistorico(empresa, campos, "Etapa alterada", `${etapaAnterior} -> ${novaEtapa}`);
      setUndo({ empresaId: empresa.id, nome: empresa.nome, etapaAnterior, etapaNova: novaEtapa });
      registrarMensagem(`${empresa.nome || "Lead"} movido para ${novaEtapa}.`, "Etapa alterada");
    } catch (erro) {
      alert("Erro ao mover empresa: " + erro.message);
    }
  }

  async function desfazer() {
    if (!undo) return;
    const empresa = empresas.find((item) => item.id === undo.empresaId);
    if (!empresa) return;
    await moverEmpresa(empresa, undo.etapaAnterior);
    setUndo(null);
    registrarMensagem("Alteracao desfeita.", "Acao desfeita");
  }

  function abrirWhatsApp(empresa) {
    const link = criarLinkWhatsApp(empresa);
    if (!link) {
      alert("Esta empresa ainda nao tem WhatsApp valido.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function marcarComoRespondeu(empresa) {
    moverEmpresa(empresa, "Respondeu");
  }

  async function salvarNovaLista() {
    if (!novaLista.nome.trim()) {
      alert("Informe o nome da campanha.");
      return;
    }
    try {
      const lista = await criarListaProspecao({
        ...novaLista,
        termo_busca: novaLista.nicho,
        origem: "manual",
        status: "ativa",
      });
      setListas((atuais) => [lista, ...atuais.filter((item) => item.id !== lista.id)]);
      setFiltroLista(lista.id);
      salvarCampanhaAtiva(lista.id);
      setNovaLista({ nome: "", nicho: "", cidade: "Uberlandia" });
      setCriandoLista(false);
      registrarMensagem("Campanha criada. Agora use Empresas > Buscar no Maps para adicionar leads nela.", "Campanha criada");
    } catch (erro) {
      alert("Erro ao criar campanha: " + erro.message);
    }
  }

  async function salvarDetalhesCard() {
    if (!cardAberto) return;
    const campos = {
      observacoes: detalhesCard.observacoes,
      proximo_followup: detalhesCard.proximo_followup || "",
      followup_status: detalhesCard.proximo_followup ? "pendente" : cardAberto.followup_status || "",
      followup_observacao: detalhesCard.followup_observacao,
      etapa_funil: detalhesCard.status,
      status: detalhesCard.status,
    };
    await atualizarEmpresaComHistorico(cardAberto, campos, "Card atualizado", "Observacoes, etapa ou follow-up alterados.");
    registrarMensagem("Card atualizado.", "Card atualizado");
  }

  if (carregando) {
    return <div className="glass-panel" style={{ padding: 24 }}>Carregando funil...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: "calc(100vh - 120px)" }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Funil comercial</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Quadro horizontal no estilo Trello. Arraste o card ou mude a etapa pelo seletor.</p>
      </div>

      <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.3fr) minmax(220px, 1fr) auto auto auto", gap: 12, padding: 14, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Campanha</label>
          <select value={filtroLista} onChange={(e) => { setFiltroLista(e.target.value); salvarCampanhaAtiva(e.target.value); }} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}>
            <option value="">Todas as campanhas</option>
            {listas.map((lista) => <option key={lista.id} value={lista.id}>{lista.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Buscar no Kanban</label>
          <input value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} placeholder="Nome, nicho, cidade ou WhatsApp" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
          <input type="checkbox" checked={ocultarFechados} onChange={(e) => setOcultarFechados(e.target.checked)} />
          Ocultar fechados/perdidos
        </label>
        <Botao tipo="outline" onClick={() => setCriandoLista((valor) => !valor)}>Nova campanha</Botao>
        <Botao tipo="outline" onClick={() => { setFiltroLista(""); salvarCampanhaAtiva(""); setBuscaTexto(""); setOcultarFechados(true); }}>Limpar filtro</Botao>
      </div>

      {criandoLista && (
        <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 12, padding: 14, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nome da campanha</label>
            <input value={novaLista.nome} onChange={(e) => setNovaLista({ ...novaLista, nome: e.target.value })} placeholder="Ex: Lash Uberlandia - Julho" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nicho</label>
            <input value={novaLista.nicho} onChange={(e) => setNovaLista({ ...novaLista, nicho: e.target.value })} placeholder="Lash designer" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cidade</label>
            <input value={novaLista.cidade} onChange={(e) => setNovaLista({ ...novaLista, cidade: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
          </div>
          <Botao onClick={salvarNovaLista}>Criar campanha</Botao>
        </div>
      )}

      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        Campanha atual: {filtroLista ? listas.find((lista) => lista.id === filtroLista)?.nome || "Campanha selecionada" : "Todas as campanhas"} - {Object.values(porStatus).flat().length} empresas
      </p>

      {(undo || mensagem) && (
        <div className="glass-panel" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderColor: "#bbf7d0" }}>
          <span style={{ color: "var(--primary)", fontWeight: 700 }}>{mensagem || "Acao concluida."}</span>
          {undo && <Botao tipo="outline" onClick={desfazer} style={{ padding: "7px 12px" }}>Desfazer</Botao>}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", overflowX: "auto", overflowY: "hidden", paddingBottom: 12, minHeight: "calc(100vh - 330px)" }}>
        {STATUS_LEAD.map((status) => (
          <section
            key={status}
            className="glass-panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const empresa = empresas.find((item) => item.id === arrastandoId);
              if (empresa) moverEmpresa(empresa, status);
              setArrastandoId(null);
            }}
            style={{ flex: "0 0 286px", width: 286, padding: 10, minHeight: 160, maxHeight: "calc(100vh - 330px)", display: "flex", flexDirection: "column", background: "#f8fafc" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, minHeight: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status}</h3>
              <span style={{ background: "var(--success-soft)", color: "var(--primary)", borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>
                {porStatus[status]?.length || 0}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 2, flex: 1 }}>
              {(porStatus[status] || []).slice(0, limites[status] || 12).map((empresa) => (
                <article
                  key={empresa.id}
                  draggable
                  onClick={() => setCardAberto(empresa)}
                  onDragStart={() => setArrastandoId(empresa.id)}
                  onDragEnd={() => setArrastandoId(null)}
                  style={{
                    border: arrastandoId === empresa.id ? "1px solid var(--primary)" : "1px solid var(--panel-border)",
                    borderRadius: 8,
                    padding: 10,
                    background: "#fff",
                    cursor: "grab",
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <strong style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 13, lineHeight: 1.25 }}>
                    {empresa.nome}
                  </strong>
                  <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 5, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {empresa.nicho || "Geral"} - {empresa.cidade || "Uberlandia"}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>{empresa.whatsapp || "sem WhatsApp"}</div>
                  <div style={{ color: empresa.proximo_followup && empresa.proximo_followup < new Date().toISOString().slice(0, 10) ? "#dc2626" : "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
                    {proximoFollowupLabel(empresa.proximo_followup)}
                  </div>

                  <select
                    value={empresa.etapa_funil || empresa.status || "Novo lead"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => moverEmpresa(empresa, e.target.value)}
                    style={{ width: "100%", marginTop: 8, padding: 7, borderRadius: 7, border: "1px solid var(--panel-border)", background: "#fff", fontSize: 12 }}
                  >
                    {STATUS_LEAD.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    <Botao tipo="outline" onClick={(e) => { e.stopPropagation(); abrirWhatsApp(empresa); }} style={{ padding: "6px", fontSize: 11 }}>WhatsApp</Botao>
                    <Botao tipo="outline" onClick={(e) => { e.stopPropagation(); marcarComoRespondeu(empresa); }} style={{ padding: "6px", fontSize: 11 }}>Respondeu</Botao>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Botao tipo="outline" onClick={(e) => { e.stopPropagation(); setCardAberto(empresa); }} style={{ padding: "6px", fontSize: 11 }}>Abrir card</Botao>
                  </div>
                </article>
              ))}
              {(porStatus[status] || []).length > (limites[status] || 12) && (
                <Botao tipo="outline" onClick={() => setLimites((l) => ({ ...l, [status]: (l[status] || 12) + 12 }))} style={{ padding: "7px", fontSize: 12 }}>
                  Mostrar mais 12
                </Botao>
              )}
            </div>
          </section>
        ))}
      </div>

      <Modal aberto={Boolean(cardAberto)} titulo={cardAberto?.nome || "Card do CRM"} aoFechar={() => setCardAberto(null)}>
        {cardAberto && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <strong>Status</strong>
                <select value={detalhesCard.status} onChange={(e) => setDetalhesCard({ ...detalhesCard, status: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}>
                  {STATUS_LEAD.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <strong>Proximo follow-up</strong>
                <input type="date" value={detalhesCard.proximo_followup} onChange={(e) => setDetalhesCard({ ...detalhesCard, proximo_followup: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, color: "var(--text-secondary)", fontSize: 13 }}>
              <div><strong style={{ color: "var(--text-primary)" }}>WhatsApp:</strong> {cardAberto.whatsapp || "sem WhatsApp"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Nicho:</strong> {cardAberto.nicho || cardAberto.categoria || "Geral"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Cidade:</strong> {cardAberto.cidade || "Uberlandia"}</div>
              <div><strong style={{ color: "var(--text-primary)" }}>Ultimo contato:</strong> {cardAberto.ultimo_contato ? new Date(cardAberto.ultimo_contato).toLocaleDateString("pt-BR") : "-"}</div>
            </div>

            <div>
              <strong>Observacoes do CRM</strong>
              <textarea value={detalhesCard.observacoes} onChange={(e) => setDetalhesCard({ ...detalhesCard, observacoes: e.target.value })} style={{ width: "100%", minHeight: 90, marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
            </div>

            <div>
              <strong>Observacao do follow-up</strong>
              <input value={detalhesCard.followup_observacao} onChange={(e) => setDetalhesCard({ ...detalhesCard, followup_observacao: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              <Botao onClick={salvarDetalhesCard}>Salvar card</Botao>
              <Botao tipo="outline" onClick={() => abrirWhatsApp(cardAberto)}>WhatsApp</Botao>
              <Botao tipo="outline" onClick={() => moverEmpresa(cardAberto, "Respondeu")}>Marcar respondeu</Botao>
            </div>

            <section style={{ borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Historico do card</h4>
              {!(cardAberto.historico_atividades || []).length ? (
                <p style={{ color: "var(--text-secondary)" }}>Nenhuma acao registrada ainda.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(cardAberto.historico_atividades || []).map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10 }}>
                      <strong>{item.titulo}</strong>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 3 }}>{item.detalhe}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 3 }}>{item.criado_em ? new Date(item.criado_em).toLocaleString("pt-BR") : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </Modal>
    </div>
  );
}
