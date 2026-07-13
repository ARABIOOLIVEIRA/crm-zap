"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { atualizarCamposEmpresa, criarLinkWhatsApp, criarListaProspecao, listarEmpresas, listarListasProspecao } from "../../../banco_de_dados/empresas_db";
import Botao from "../../../componentes/Botao";
import { obterCampanhaAtiva, salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function estaAtiva(empresa) {
  return !["Fechado", "Perdido"].includes(empresa.etapa_funil || empresa.status);
}

function etapaComercial(empresa) {
  return empresa?.etapa_funil || empresa?.status || "Novo lead";
}

function FollowupCard({ empresa, hoje, atualizarFollowup, abrirWhatsApp }) {
  const [data, setData] = useState(empresa.proximo_followup || hoje);
  const [obs, setObs] = useState(empresa.followup_observacao || "");

  return (
    <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#fff" }}>
      <strong>{empresa.nome}</strong>
      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{etapaComercial(empresa)} - {empresa.whatsapp || "sem WhatsApp"}</div>
      {empresa.followup_status === "concluido" && (
        <div style={{ color: "var(--primary)", fontSize: 12, fontWeight: 800 }}>
          Concluido {empresa.followup_concluido_em ? new Date(empresa.followup_concluido_em).toLocaleDateString("pt-BR") : ""}
        </div>
      )}
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observacao do follow-up" style={{ padding: 8, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Botao tipo="outline" onClick={() => atualizarFollowup(empresa, { proximo_followup: data, followup_status: "pendente", followup_observacao: obs, followup_concluido_em: "" }, "Follow-up salvo.")} style={{ padding: "7px", fontSize: 12 }}>Salvar data</Botao>
        <Botao tipo="outline" onClick={() => abrirWhatsApp(empresa)} style={{ padding: "7px", fontSize: 12 }}>WhatsApp</Botao>
        <Botao tipo="outline" onClick={() => atualizarFollowup(empresa, { proximo_followup: "", followup_status: "concluido", followup_concluido_em: new Date().toISOString(), followup_observacao: obs }, "Follow-up concluido.")} style={{ padding: "7px", fontSize: 12 }}>Concluir</Botao>
        <Botao tipo="outline" onClick={() => atualizarFollowup(empresa, { proximo_followup: "", followup_status: "cancelado", followup_observacao: obs, followup_concluido_em: "" }, "Follow-up removido da rotina.")} style={{ padding: "7px", fontSize: 12 }}>Remover</Botao>
      </div>
    </div>
  );
}

function FollowupBloco({ titulo, dados, hoje, atualizarFollowup, abrirWhatsApp }) {
  return (
    <section className="glass-panel" style={{ padding: 16, minHeight: 420, maxHeight: "calc(100vh - 330px)", overflowY: "auto" }}>
      <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{titulo} ({dados.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dados.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>Nada aqui.</p> : dados.map((empresa) => (
          <FollowupCard
            key={`${empresa.id}-${empresa.proximo_followup || ""}-${empresa.followup_status || ""}-${empresa.followup_observacao || ""}`}
            empresa={empresa}
            hoje={hoje}
            atualizarFollowup={atualizarFollowup}
            abrirWhatsApp={abrirWhatsApp}
          />
        ))}
      </div>
    </section>
  );
}

export default function PaginaFollowups() {
  const [empresas, setEmpresas] = useState([]);
  const [listasProspecao, setListasProspecao] = useState([]);
  const [filtroLista, setFiltroLista] = useState("");
  const [undo, setUndo] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [dataLote, setDataLote] = useState(hojeIso());
  const [alvoLote, setAlvoLote] = useState("semAcao");
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [criandoLista, setCriandoLista] = useState(false);
  const [novaLista, setNovaLista] = useState({ nome: "", nicho: "", cidade: "Uberlandia" });

  function registrarMensagem(texto, titulo = "Follow-ups") {
    setMensagem(texto);
    window.crmZapNotificar?.(texto, titulo);
  }

  const carregar = useCallback(async function carregar(listaId = filtroLista) {
    const ativa = listaId || obterCampanhaAtiva();
    if (ativa && !filtroLista) setFiltroLista(ativa);
    const [dados, listas] = await Promise.all([
      listarEmpresas(ativa ? { lista_id: ativa } : {}),
      listarListasProspecao().catch(() => []),
    ]);
    setEmpresas(dados);
    setListasProspecao(listas);
  }, [filtroLista]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      carregar(filtroLista);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar, filtroLista]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 15000);
    return () => clearTimeout(timer);
  }, [undo]);

  const hoje = hojeIso();
  const listas = useMemo(() => {
    const ativas = empresas.filter(estaAtiva);
    const pendentes = ativas.filter((e) => e.proximo_followup && e.followup_status !== "cancelado" && e.followup_status !== "concluido");
    const concluidos = ativas.filter((e) => e.followup_status === "concluido");
    return {
      hoje: pendentes.filter((e) => e.proximo_followup === hoje),
      atrasados: pendentes.filter((e) => e.proximo_followup < hoje),
      proximos: pendentes.filter((e) => e.proximo_followup > hoje),
      semAcao: ativas.filter((e) =>
        !e.proximo_followup &&
        e.followup_status !== "cancelado" &&
        e.followup_status !== "concluido"
      ),
      concluidos,
      ativos: ativas,
    };
  }, [empresas, hoje]);

  const alvos = useMemo(() => {
    if (alvoLote === "contatadosSemAcao") {
      return listas.semAcao.filter((e) => ["Contatado", "Respondeu", "Aguardando retorno"].includes(etapaComercial(e)));
    }
    if (alvoLote === "todosAtivos") return listas.ativos;
    return listas.semAcao;
  }, [alvoLote, listas]);

  function historicoAtualizado(empresa, titulo, detalhe) {
    const item = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      titulo,
      detalhe,
      criado_em: new Date().toISOString(),
    };
    return [item, ...(empresa.historico_atividades || [])].slice(0, 40);
  }

  async function atualizarFollowup(empresa, campos, titulo) {
    const anteriores = {
      proximo_followup: empresa.proximo_followup || "",
      followup_status: empresa.followup_status || "",
      followup_observacao: empresa.followup_observacao || "",
      followup_concluido_em: empresa.followup_concluido_em || "",
      historico_atividades: empresa.historico_atividades || [],
    };
    const historico_atividades = historicoAtualizado(empresa, titulo, campos.proximo_followup ? `Data: ${campos.proximo_followup}` : campos.followup_status || "Follow-up atualizado");
    await atualizarCamposEmpresa(empresa.id, { ...campos, historico_atividades });
    setEmpresas((lista) => lista.map((item) => (item.id === empresa.id ? { ...item, ...campos, historico_atividades } : item)));
    setUndo({ tipo: "unico", empresaId: empresa.id, anteriores });
    registrarMensagem(titulo, "Follow-up atualizado");
  }

  async function aplicarDataEmLote() {
    if (!dataLote || !alvos.length) return;
    if (!confirm(`Aplicar follow-up em ${dataLote} para ${alvos.length} lead(s)?`)) return;

    setSalvandoLote(true);
    const anteriores = alvos.map((empresa) => ({
      id: empresa.id,
      proximo_followup: empresa.proximo_followup || "",
      followup_status: empresa.followup_status || "",
      followup_observacao: empresa.followup_observacao || "",
      followup_concluido_em: empresa.followup_concluido_em || "",
      historico_atividades: empresa.historico_atividades || [],
    }));
    const campos = {
      proximo_followup: dataLote,
      followup_status: "pendente",
      followup_concluido_em: "",
    };

    try {
      for (const empresa of alvos) {
        await atualizarCamposEmpresa(empresa.id, {
          ...campos,
          historico_atividades: historicoAtualizado(empresa, "Follow-up em lote", `Data aplicada: ${dataLote}`),
        });
      }
      setEmpresas((lista) => lista.map((item) => {
        const alvo = alvos.find((e) => e.id === item.id);
        return alvo ? { ...item, ...campos, historico_atividades: historicoAtualizado(item, "Follow-up em lote", `Data aplicada: ${dataLote}`) } : item;
      }));
      setUndo({ tipo: "lote", anteriores });
      await carregar(filtroLista);
      const dataFormatada = dataLote.split("-").reverse().join("/");
      registrarMensagem(`Parabens! ${alvos.length} lead(s) atualizados. Acao tomada: follow-up criado para ${dataFormatada}.`, "Follow-up em lote");
    } catch (erro) {
      alert("Erro ao aplicar data em lote: " + erro.message);
      await carregar();
    } finally {
      setSalvandoLote(false);
    }
  }

  async function desfazer() {
    if (!undo) return;

    if (undo.tipo === "lote") {
      for (const item of undo.anteriores) {
        await atualizarCamposEmpresa(item.id, {
          proximo_followup: item.proximo_followup,
          followup_status: item.followup_status,
          followup_observacao: item.followup_observacao,
          followup_concluido_em: item.followup_concluido_em,
          historico_atividades: item.historico_atividades,
        });
      }
      setEmpresas((lista) => lista.map((empresa) => {
        const anterior = undo.anteriores.find((item) => item.id === empresa.id);
        return anterior ? { ...empresa, ...anterior } : empresa;
      }));
      setUndo(null);
      registrarMensagem("Lote desfeito.", "Acao desfeita");
      return;
    }

    const empresa = empresas.find((item) => item.id === undo.empresaId);
    if (!empresa) return;
    await atualizarCamposEmpresa(empresa.id, undo.anteriores);
    setEmpresas((lista) => lista.map((item) => (item.id === undo.empresaId ? { ...item, ...undo.anteriores } : item)));
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
      setListasProspecao((atuais) => [lista, ...atuais.filter((item) => item.id !== lista.id)]);
      setFiltroLista(lista.id);
      salvarCampanhaAtiva(lista.id);
      setNovaLista({ nome: "", nicho: "", cidade: "Uberlandia" });
      setCriandoLista(false);
      registrarMensagem("Campanha criada. Adicione leads nela pela aba Empresas > Buscar no Maps.", "Campanha criada");
    } catch (erro) {
      alert("Erro ao criar campanha: " + erro.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Follow-ups</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Organize as proximas datas por lead ou aplique a mesma data em lote depois de um disparo.</p>
      </div>

      <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto auto", gap: 12, padding: 14, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Campanha</label>
          <select value={filtroLista} onChange={(e) => { setFiltroLista(e.target.value); salvarCampanhaAtiva(e.target.value); }} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}>
            <option value="">Todas as campanhas</option>
            {listasProspecao.map((lista) => <option key={lista.id} value={lista.id}>{lista.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Data em lote</label>
          <input type="date" value={dataLote} onChange={(e) => setDataLote(e.target.value)} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Aplicar em</label>
          <select value={alvoLote} onChange={(e) => setAlvoLote(e.target.value)} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}>
            <option value="semAcao">Sem proxima acao</option>
            <option value="contatadosSemAcao">Contatados sem acao</option>
            <option value="todosAtivos">Todos ativos filtrados</option>
          </select>
        </div>
        <Botao onClick={aplicarDataEmLote} disabled={salvandoLote || !alvos.length}>
          {salvandoLote ? "Aplicando..." : `Aplicar (${alvos.length})`}
        </Botao>
        <Botao tipo="outline" onClick={() => setCriandoLista((valor) => !valor)}>Nova campanha</Botao>
      </div>

      {criandoLista && (
        <div className="glass-panel" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 12, padding: 14, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nome da campanha</label>
            <input value={novaLista.nome} onChange={(e) => setNovaLista({ ...novaLista, nome: e.target.value })} placeholder="Ex: Leads Lash - Julho" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)" }} />
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

      {(undo || mensagem) && (
        <div className="glass-panel" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderColor: "#bbf7d0" }}>
          <span style={{ color: "var(--primary)", fontWeight: 700 }}>{mensagem || "Acao concluida."}</span>
          {undo && <Botao tipo="outline" onClick={desfazer} style={{ padding: "7px 12px" }}>Desfazer</Botao>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14, alignItems: "start" }}>
        <FollowupBloco titulo="Hoje" dados={listas.hoje} hoje={hoje} atualizarFollowup={atualizarFollowup} abrirWhatsApp={abrirWhatsApp} />
        <FollowupBloco titulo="Atrasados" dados={listas.atrasados} hoje={hoje} atualizarFollowup={atualizarFollowup} abrirWhatsApp={abrirWhatsApp} />
        <FollowupBloco titulo="Proximos" dados={listas.proximos} hoje={hoje} atualizarFollowup={atualizarFollowup} abrirWhatsApp={abrirWhatsApp} />
        <FollowupBloco titulo="Sem proxima acao" dados={listas.semAcao} hoje={hoje} atualizarFollowup={atualizarFollowup} abrirWhatsApp={abrirWhatsApp} />
        <FollowupBloco titulo="Concluidos" dados={listas.concluidos} hoje={hoje} atualizarFollowup={atualizarFollowup} abrirWhatsApp={abrirWhatsApp} />
      </div>
    </div>
  );
}
