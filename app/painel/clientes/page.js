"use client";

import { useEffect, useMemo, useState } from "react";
import Botao from "@/componentes/Botao";
import Input from "@/componentes/Input";

const clienteInicial = {
  nome: "",
  empresa: "",
  whatsapp: "",
  email: "",
  cidade: "Uberlandia",
  origem: "Manual",
  responsavel: "",
  status: "Ativo",
  observacoes: "",
};

const historicoInicial = {
  area: "administracao",
  tipo_evento: "observacao",
  titulo: "",
  descricao: "",
};

function formatarData(data) {
  if (!data) return "-";
  return new Date(data).toLocaleString("pt-BR");
}

async function chamarApi(url, opcoes = {}) {
  const res = await fetch(url, opcoes);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Falha na operacao.");
  return data;
}

export default function PaginaClientes() {
  const [clientes, setClientes] = useState([]);
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [form, setForm] = useState(clienteInicial);
  const [registro, setRegistro] = useState(historicoInicial);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function carregarClientes(termo = busca) {
    setCarregando(true);
    try {
      const params = termo ? `?busca=${encodeURIComponent(termo)}` : "";
      const data = await chamarApi(`/api/admin/clientes${params}`);
      setClientes(data.clientes || []);
    } finally {
      setCarregando(false);
    }
  }

  async function abrirCliente(cliente) {
    const data = await chamarApi(`/api/admin/clientes?id=${encodeURIComponent(cliente.id)}`);
    setClienteAtivo(data.cliente);
    setHistorico(data.historico || []);
    setForm({ ...clienteInicial, ...data.cliente });
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  const metricas = useMemo(() => {
    const ativos = clientes.filter((cliente) => cliente.status !== "Inativo").length;
    const comWhatsapp = clientes.filter((cliente) => cliente.whatsapp).length;
    return { total: clientes.length, ativos, comWhatsapp };
  }, [clientes]);

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarCliente(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload = clienteAtivo?.id
        ? { acao: "editar", id: clienteAtivo.id, cliente: form, area: "administracao" }
        : { acao: "cadastrar", cliente: form, area: "administracao" };
      const data = await chamarApi("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.crmZapNotificar?.("Cliente salvo e historico registrado.", "Clientes");
      await carregarClientes();
      await abrirCliente(data.cliente);
    } catch (error) {
      window.crmZapAviso?.(error.message, "Erro ao salvar cliente");
    } finally {
      setSalvando(false);
    }
  }

  async function registrarHistorico(e) {
    e.preventDefault();
    if (!clienteAtivo?.id) return;
    try {
      const data = await chamarApi("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "historico", id: clienteAtivo.id, ...registro }),
      });
      setHistorico((lista) => [data.historico, ...lista]);
      setRegistro(historicoInicial);
      window.crmZapNotificar?.("Registro adicionado ao historico do cliente.", "Historico");
    } catch (error) {
      window.crmZapAviso?.(error.message, "Erro no historico");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Clientes</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Cadastro unico da Lumio. Tudo que acontecer com o cliente deve ficar registrado aqui.
        </p>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {[
          ["Clientes", metricas.total],
          ["Ativos", metricas.ativos],
          ["Com WhatsApp", metricas.comWhatsapp],
        ].map(([titulo, valor]) => (
          <div key={titulo} className="glass-panel" style={{ padding: 16 }}>
            <strong style={{ color: "var(--text-secondary)", fontSize: 12, textTransform: "uppercase" }}>{titulo}</strong>
            <p style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{valor}</p>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.85fr) minmax(420px, 1.15fr)", gap: 16, alignItems: "start" }}>
        <div className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <Input value={busca} placeholder="Buscar por nome, empresa, WhatsApp ou cidade" onChange={(e) => setBusca(e.target.value)} />
            <Botao tipo="outline" onClick={() => carregarClientes(busca)} disabled={carregando}>Buscar</Botao>
          </div>
          <Botao onClick={() => { setClienteAtivo(null); setHistorico([]); setForm(clienteInicial); }}>
            Novo cliente
          </Botao>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 560, overflowY: "auto" }}>
            {clientes.map((cliente) => (
              <button
                key={cliente.id}
                onClick={() => abrirCliente(cliente)}
                style={{
                  textAlign: "left",
                  border: clienteAtivo?.id === cliente.id ? "1px solid #86efac" : "1px solid var(--panel-border)",
                  background: clienteAtivo?.id === cliente.id ? "#f0fdf4" : "#fff",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                }}
              >
                <strong>{cliente.nome}</strong>
                <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
                  {cliente.empresa || "Sem empresa"} - {cliente.whatsapp || "sem WhatsApp"}
                </p>
              </button>
            ))}
            {!clientes.length && <p style={{ color: "var(--text-secondary)" }}>{carregando ? "Carregando..." : "Nenhum cliente encontrado."}</p>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="glass-panel" onSubmit={salvarCliente} style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Nome" value={form.nome} required onChange={(e) => atualizarCampo("nome", e.target.value)} />
            <Input label="Empresa" value={form.empresa} onChange={(e) => atualizarCampo("empresa", e.target.value)} />
            <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => atualizarCampo("whatsapp", e.target.value)} />
            <Input label="E-mail" value={form.email} onChange={(e) => atualizarCampo("email", e.target.value)} />
            <Input label="Cidade" value={form.cidade} onChange={(e) => atualizarCampo("cidade", e.target.value)} />
            <Input label="Responsavel" value={form.responsavel} onChange={(e) => atualizarCampo("responsavel", e.target.value)} />
            <Input
              label="Status"
              type="select"
              value={form.status}
              onChange={(e) => atualizarCampo("status", e.target.value)}
              options={["Ativo", "Prospect", "Cliente", "Pendente", "Inativo"].map((item) => ({ value: item, label: item }))}
            />
            <Input label="Origem" value={form.origem} onChange={(e) => atualizarCampo("origem", e.target.value)} />
            <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>
              Observacoes
              <textarea value={form.observacoes} onChange={(e) => atualizarCampo("observacoes", e.target.value)} rows={4} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10 }} />
            </label>
            <Botao type="submit" disabled={salvando} style={{ gridColumn: "1 / -1" }}>{salvando ? "Salvando..." : "Salvar cliente"}</Botao>
          </form>

          {clienteAtivo && (
            <div className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Historico de {clienteAtivo.nome}</h3>
              <form onSubmit={registrarHistorico} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input
                  label="Area"
                  type="select"
                  value={registro.area}
                  onChange={(e) => setRegistro((atual) => ({ ...atual, area: e.target.value }))}
                  options={["administracao", "producao", "financeiro", "comercial", "marketing"].map((item) => ({ value: item, label: item }))}
                />
                <Input label="Titulo" value={registro.titulo} onChange={(e) => setRegistro((atual) => ({ ...atual, titulo: e.target.value }))} />
                <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>
                  O que aconteceu?
                  <textarea value={registro.descricao} onChange={(e) => setRegistro((atual) => ({ ...atual, descricao: e.target.value }))} rows={3} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10 }} />
                </label>
                <Botao type="submit" style={{ gridColumn: "1 / -1" }}>Registrar no historico</Botao>
              </form>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {historico.map((item) => (
                  <article key={item.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 12 }}>
                    <strong>{item.titulo}</strong>
                    <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>{item.area} - {formatarData(item.data_evento)}</p>
                    {item.descricao && <p style={{ marginTop: 8, lineHeight: 1.45 }}>{item.descricao}</p>}
                  </article>
                ))}
                {!historico.length && <p style={{ color: "var(--text-secondary)" }}>Nenhum historico ainda.</p>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
