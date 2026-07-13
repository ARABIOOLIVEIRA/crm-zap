"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Botao from "../../../componentes/Botao";
import { listarListasProspecao } from "../../../banco_de_dados/empresas_db";
import { obterCampanhaAtiva, salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";

const METRICAS_PRINCIPAIS = [
  ["Total de leads", "total"],
  ["Contatados", "contatados"],
  ["Responderam", "responderam"],
  ["Aguardando retorno", "aguardandoRetorno"],
  ["Follow-ups hoje", "followupsHoje"],
  ["Fechados", "fechados"],
];

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

const METRICAS_ACOMPANHAMENTO = [
  ["Com WhatsApp", "comWhatsApp"],
  ["WhatsApps abertos", "whatsAppsAbertos"],
  ["Sem primeira abordagem", "aguardandoAbordagem"],
  ["Follow-ups atrasados", "followupsAtrasados"],
  ["Campanhas", "listasProspecao"],
  ["Taxa de resposta", "taxaResposta", "%"],
  ["Taxa de fechamento", "taxaFechamento", "%"],
];

function CardMetrica({ label, valor }) {
  return (
    <div className="glass-panel" style={{ padding: 18 }}>
      <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: "var(--text-primary)", fontSize: 30, fontWeight: 800, marginTop: 8 }}>
        {valor ?? 0}
      </div>
    </div>
  );
}

export default function PaginaDashboard() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [campanhas, setCampanhas] = useState([]);
  const [campanhaId, setCampanhaId] = useState("");

  const carregarDashboard = useCallback(async function carregarDashboard(id = campanhaId) {
    setCarregando(true);
    setErro("");
    try {
      const params = id ? `?lista_id=${encodeURIComponent(id)}` : "";
      const res = await fetch(`/api/admin/dashboard${params}`, { method: "GET", cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Falha ao carregar dashboard.");
      }
      setDados(json);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [campanhaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ativa = obterCampanhaAtiva();
      setCampanhaId(ativa);
      listarListasProspecao().then(setCampanhas).catch(() => []);
      carregarDashboard(ativa);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [carregarDashboard]);

  function trocarCampanha(id) {
    setCampanhaId(id);
    salvarCampanhaAtiva(id);
    carregarDashboard(id);
  }

  const metricas = useMemo(() => dados?.metricas || {}, [dados]);
  const principais = useMemo(() => {
    return METRICAS_PRINCIPAIS.map(([label, chave]) => [label, metricas[chave] || 0]);
  }, [metricas]);
  const acompanhamento = useMemo(() => {
    return METRICAS_ACOMPANHAMENTO.map(([label, chave, sufixo]) => [
      label,
      `${metricas[chave] || 0}${sufixo || ""}`,
    ]);
  }, [metricas]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>Dashboard</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Visao comercial alinhada com as etapas do funil e com a campanha selecionada.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={campanhaId} onChange={(e) => trocarCampanha(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff", minWidth: 240 }}>
            <option value="">Todas as campanhas</option>
            {campanhas.map((campanha) => <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>)}
          </select>
          <Botao tipo="outline" onClick={() => carregarDashboard()} disabled={carregando}>
            {carregando ? "Atualizando..." : "Atualizar"}
          </Botao>
        </div>
      </div>

      {erro && (
        <div className="glass-panel" style={{ padding: 14, color: "#dc2626", fontWeight: 700 }}>
          {erro}
        </div>
      )}

      {carregando && !dados ? (
        <div className="glass-panel" style={{ padding: 32, color: "var(--text-secondary)", textAlign: "center" }}>
          Carregando dashboard...
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {principais.map(([label, valor]) => (
              <CardMetrica key={label} label={label} valor={valor} />
            ))}
          </div>

          <section className="glass-panel" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Etapas do funil</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              {ETAPAS_FUNIL.map((etapa) => (
                <CardMetrica key={etapa} label={etapa} valor={metricas.etapas?.[etapa] || 0} />
              ))}
            </div>
          </section>

          <section className="glass-panel" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Acompanhamento</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {acompanhamento.map(([label, valor]) => (
                <CardMetrica key={label} label={label} valor={valor} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
