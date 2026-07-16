"use client";

import { useEffect, useState } from "react";
import Botao from "@/componentes/Botao";
import Input from "@/componentes/Input";

const areas = ["administracao", "producao", "financeiro", "comercial", "marketing"];

async function chamarApi(url, opcoes = {}) {
  const res = await fetch(url, opcoes);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Falha na operacao.");
  return data;
}

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome: "", email: "", perfil: "operacao", areas: ["comercial"] });
  const [senhaCriada, setSenhaCriada] = useState("");

  async function carregar() {
    const data = await chamarApi("/api/admin/usuarios");
    setUsuarios(data.usuarios || []);
  }

  useEffect(() => {
    carregar().catch((error) => window.crmZapAviso?.(error.message, "Erro ao carregar usuarios"));
  }, []);

  function alternarArea(area) {
    setForm((atual) => {
      const set = new Set(atual.areas);
      if (set.has(area)) set.delete(area);
      else set.add(area);
      return { ...atual, areas: Array.from(set) };
    });
  }

  async function salvarUsuario(e) {
    e.preventDefault();
    try {
      const data = await chamarApi("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSenhaCriada(data.senha_temporaria || "");
      setForm({ nome: "", email: "", perfil: "operacao", areas: ["comercial"] });
      await carregar();
      window.crmZapNotificar?.("Usuario salvo. Permissoes registradas.", "Usuarios");
    } catch (error) {
      window.crmZapAviso?.(error.message, "Erro ao salvar usuario");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Usuarios e acessos</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Primeira versao das permissoes por area. O bloqueio fino de tela entra na proxima etapa.
        </p>
      </div>

      <form className="glass-panel" onSubmit={salvarUsuario} style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Input label="Nome" value={form.nome} onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))} />
        <Input label="E-mail" value={form.email} required onChange={(e) => setForm((atual) => ({ ...atual, email: e.target.value }))} />
        <Input
          label="Perfil"
          type="select"
          value={form.perfil}
          onChange={(e) => setForm((atual) => ({ ...atual, perfil: e.target.value }))}
          options={[
            { value: "ceo", label: "CEO / acesso geral" },
            { value: "gestor", label: "Gestor" },
            { value: "operacao", label: "Operacao" },
            { value: "recepcao", label: "Recepcao" },
          ]}
        />
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {areas.map((area) => (
            <label key={area} style={{ border: "1px solid var(--panel-border)", borderRadius: 999, padding: "8px 10px", display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={form.areas.includes(area)} onChange={() => alternarArea(area)} />
              {area}
            </label>
          ))}
        </div>
        <Botao type="submit" style={{ gridColumn: "1 / -1" }}>Salvar usuario</Botao>
      </form>

      {senhaCriada && (
        <div className="glass-panel" style={{ padding: 14, borderColor: "#86efac", background: "#f0fdf4" }}>
          <strong>Senha temporaria criada:</strong>
          <p style={{ marginTop: 6, fontFamily: "monospace" }}>{senhaCriada}</p>
        </div>
      )}

      <section className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Usuarios cadastrados</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {usuarios.map((usuario) => (
            <article key={usuario.uid} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 12, display: "grid", gridTemplateColumns: "1fr 160px 1fr", gap: 10 }}>
              <strong>{usuario.email}</strong>
              <span>{usuario.perfil}</span>
              <span style={{ color: "var(--text-secondary)" }}>{(usuario.areas || []).join(", ") || "sem areas"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
