"use client";

import { useEffect, useMemo, useState } from "react";
import Botao from "@/componentes/Botao";
import Input from "@/componentes/Input";

const tarefaInicial = {
  titulo: "",
  descricao: "",
  cliente_id: "",
  cliente_nome: "",
  area: "producao",
  responsavel: "",
  data_prevista: new Date().toISOString().slice(0, 10),
  prioridade: "normal",
  status: "pendente",
};

async function chamarApi(url, opcoes = {}) {
  const res = await fetch(url, opcoes);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Falha na operacao.");
  return data;
}

function BlocoTarefas({ titulo, tarefas, atualizar }) {
  return (
    <section className="glass-panel" style={{ padding: 14, minHeight: 280 }}>
      <h3 style={{ fontSize: 17, fontWeight: 800 }}>{titulo} ({tarefas.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {tarefas.map((tarefa) => (
          <article key={tarefa.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 12, background: "#fff" }}>
            <strong>{tarefa.titulo}</strong>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
              {tarefa.cliente_nome || "Sem cliente"} - {tarefa.area} - {tarefa.data_prevista || "sem data"}
            </p>
            {tarefa.descricao && <p style={{ marginTop: 8, fontSize: 13 }}>{tarefa.descricao}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <Botao tipo="outline" onClick={() => atualizar(tarefa, { status: "concluida" })} style={{ padding: "7px", fontSize: 12 }}>Concluir</Botao>
              <Botao tipo="outline" onClick={() => atualizar(tarefa, { status: "pendente" })} style={{ padding: "7px", fontSize: 12 }}>Reabrir</Botao>
            </div>
          </article>
        ))}
        {!tarefas.length && <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>Nada aqui.</p>}
      </div>
    </section>
  );
}

export default function PaginaTarefas() {
  const [tarefas, setTarefas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(tarefaInicial);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [tarefasData, clientesData] = await Promise.all([
      chamarApi("/api/admin/tarefas"),
      chamarApi("/api/admin/clientes"),
    ]);
    setTarefas(tarefasData.tarefas || []);
    setClientes(clientesData.clientes || []);
  }

  useEffect(() => {
    carregar().catch((error) => window.crmZapAviso?.(error.message, "Erro ao carregar tarefas"));
  }, []);

  const grupos = useMemo(() => ({
    atrasadas: tarefas.filter((tarefa) => tarefa.rotina_status === "atrasada"),
    hoje: tarefas.filter((tarefa) => tarefa.rotina_status === "hoje"),
    proximas: tarefas.filter((tarefa) => tarefa.rotina_status === "proxima" || tarefa.rotina_status === "sem_data"),
    concluidas: tarefas.filter((tarefa) => tarefa.rotina_status === "concluida"),
  }), [tarefas]);

  function atualizarCampo(campo, valor) {
    setForm((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === "cliente_id") {
        const cliente = clientes.find((item) => item.id === valor);
        novo.cliente_nome = cliente?.nome || "";
      }
      return novo;
    });
  }

  async function criarTarefa(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await chamarApi("/api/admin/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "criar", tarefa: form }),
      });
      setForm(tarefaInicial);
      await carregar();
      window.crmZapNotificar?.("Tarefa criada e registrada no historico do cliente.", "Tarefas");
    } catch (error) {
      window.crmZapAviso?.(error.message, "Erro ao criar tarefa");
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarTarefa(tarefa, campos) {
    try {
      await chamarApi("/api/admin/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "atualizar", id: tarefa.id, tarefa: { ...tarefa, ...campos } }),
      });
      await carregar();
      window.crmZapNotificar?.("Tarefa atualizada.", "Tarefas");
    } catch (error) {
      window.crmZapAviso?.(error.message, "Erro ao atualizar tarefa");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Tarefas e lembretes</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Rotina simples para nada depender de memoria: criar, acompanhar e concluir.
        </p>
      </div>

      <form className="glass-panel" onSubmit={criarTarefa} style={{ padding: 16, display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <Input label="Tarefa" value={form.titulo} required onChange={(e) => atualizarCampo("titulo", e.target.value)} />
        <Input
          label="Cliente"
          type="select"
          value={form.cliente_id}
          onChange={(e) => atualizarCampo("cliente_id", e.target.value)}
          options={[{ value: "", label: "Sem cliente" }, ...clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome }))]}
        />
        <Input
          label="Area"
          type="select"
          value={form.area}
          onChange={(e) => atualizarCampo("area", e.target.value)}
          options={["administracao", "producao", "financeiro", "comercial", "marketing"].map((item) => ({ value: item, label: item }))}
        />
        <Input label="Data" type="date" value={form.data_prevista} onChange={(e) => atualizarCampo("data_prevista", e.target.value)} />
        <Botao type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar"}</Botao>
        <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>
          Observacao
          <textarea value={form.descricao} onChange={(e) => atualizarCampo("descricao", e.target.value)} rows={2} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10 }} />
        </label>
      </form>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(260px, 1fr))", gap: 12, alignItems: "start", overflowX: "auto" }}>
        <BlocoTarefas titulo="Atrasadas" tarefas={grupos.atrasadas} atualizar={atualizarTarefa} />
        <BlocoTarefas titulo="Hoje" tarefas={grupos.hoje} atualizar={atualizarTarefa} />
        <BlocoTarefas titulo="Proximas" tarefas={grupos.proximas} atualizar={atualizarTarefa} />
        <BlocoTarefas titulo="Concluidas" tarefas={grupos.concluidas} atualizar={atualizarTarefa} />
      </section>
    </div>
  );
}
