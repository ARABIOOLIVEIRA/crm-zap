"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/servicos/firebase_config";

const gruposMenu = [
  {
    titulo: "Administracao",
    itens: [
      { nome: "Usuarios", rota: "/painel/usuarios" },
      { nome: "Configuracoes", rota: "/painel/configuracoes" },
    ],
  },
  {
    titulo: "Producao",
    itens: [
      { nome: "Clientes", rota: "/painel/clientes" },
      { nome: "Tarefas", rota: "/painel/tarefas" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { nome: "Clientes", rota: "/painel/clientes" },
      { nome: "Tarefas", rota: "/painel/tarefas" },
    ],
  },
  {
    titulo: "Comercial",
    itens: [
      { nome: "Clientes", rota: "/painel/clientes" },
      { nome: "Campanhas", rota: "/painel/campanhas" },
      { nome: "Empresas / Leads", rota: "/painel/empresas" },
      { nome: "Abordagens", rota: "/painel/abordagens" },
      { nome: "Follow-ups", rota: "/painel/followups" },
      { nome: "Funil", rota: "/painel/funil" },
      { nome: "Dashboard", rota: "/painel/dashboard" },
    ],
  },
  {
    titulo: "Marketing",
    itens: [
      { nome: "Campanhas", rota: "/painel/campanhas" },
      { nome: "Clientes", rota: "/painel/clientes" },
    ],
  },
];

export default function LayoutPainel({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deslogando, setDeslogando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [notificacoes, setNotificacoes] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const salvas = JSON.parse(window.localStorage.getItem("crm_zap_notificacoes") || "[]");
      return Array.isArray(salvas) ? salvas : [];
    } catch {
      window.localStorage.setItem("crm_zap_notificacoes", "[]");
      return [];
    }
  });
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [sinoAnimado, setSinoAnimado] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const alertaOriginal = window.alert;
    const salvar = (lista) => {
      const limitada = lista.slice(0, 80);
      window.localStorage.setItem("crm_zap_notificacoes", JSON.stringify(limitada));
      return limitada;
    };
    const registrar = (mensagem, titulo = "Aviso do CRM", abrirModal = false) => {
      const item = {
        id: `not_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        titulo,
        mensagem: String(mensagem || ""),
        criado_em: new Date().toISOString(),
        lida: false,
      };
      setNotificacoes((atuais) => salvar([item, ...atuais]));
      setSinoAnimado(true);
      window.setTimeout(() => setSinoAnimado(false), 900);
      if (abrirModal) setAviso({ titulo, mensagem: item.mensagem });
      return item;
    };

    window.alert = (mensagem) => {
      registrar(mensagem, "Aviso do CRM", true);
    };
    window.crmZapAviso = (mensagem, titulo = "Aviso do CRM") => {
      registrar(mensagem, titulo, true);
    };
    window.crmZapNotificar = (mensagem, titulo = "Notificacao do CRM") => {
      registrar(mensagem, titulo, false);
    };
    const ouvirNotificacao = (evento) => {
      registrar(evento.detail?.mensagem || "", evento.detail?.titulo || "Notificacao do CRM", Boolean(evento.detail?.abrirModal));
    };
    window.addEventListener("crm-zap:notificar", ouvirNotificacao);
    return () => {
      window.alert = alertaOriginal;
      delete window.crmZapAviso;
      delete window.crmZapNotificar;
      window.removeEventListener("crm-zap:notificar", ouvirNotificacao);
    };
  }, []);

  function salvarNotificacoes(lista) {
    const limitada = lista.slice(0, 80);
    setNotificacoes(limitada);
    window.localStorage.setItem("crm_zap_notificacoes", JSON.stringify(limitada));
  }

  function marcarTodasLidas() {
    salvarNotificacoes(notificacoes.map((item) => ({ ...item, lida: true })));
  }

  function limparNotificacoes() {
    salvarNotificacoes([]);
    setNotificacoesAbertas(false);
  }

  function lerNotificacao(id) {
    const item = notificacoes.find((notificacao) => notificacao.id === id);
    if (!item) return;
    salvarNotificacoes(notificacoes.map((notificacao) => (
      notificacao.id === id ? { ...notificacao, lida: true } : notificacao
    )));
    setAviso({ titulo: item.titulo, mensagem: item.mensagem });
  }

  async function handleLogout() {
    if (deslogando) return;
    setDeslogando(true);
    try {
      await auth?.signOut();
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const sidebarWidth = "248px";
  const naoLidas = notificacoes.filter((item) => !item.lida).length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 90 }}
        />
      )}

      <aside
        style={{
          width: sidebarWidth,
          background: "#ffffff",
          borderRight: "1px solid var(--panel-border)",
          padding: "22px",
          position: "fixed",
          left: isMobile ? (mobileOpen ? 0 : "-248px") : 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          transition: "left 0.2s ease",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        <div>
          <h1 style={{ color: "var(--primary)", fontSize: "24px", fontWeight: 800, letterSpacing: 0 }}>LUMIO</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>Sistema operacional Lumio</p>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, overflowY: "auto", paddingRight: 2 }}>
          {gruposMenu.map((grupo) => (
            <div key={grupo.titulo} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                {grupo.titulo}
              </span>
              {grupo.itens.map((item) => {
                const ativo = pathname === item.rota || pathname.startsWith(`${item.rota}/`);
                return (
                  <Link
                    key={`${grupo.titulo}-${item.rota}-${item.nome}`}
                    href={item.rota}
                    onClick={() => isMobile && setMobileOpen(false)}
                    style={{
                      textDecoration: "none",
                      color: ativo ? "var(--primary)" : "var(--text-primary)",
                      background: ativo ? "var(--success-soft)" : "transparent",
                      border: ativo ? "1px solid #bbf7d0" : "1px solid transparent",
                      borderRadius: "8px",
                      padding: "9px 10px",
                      fontSize: "13px",
                      fontWeight: ativo ? 800 : 600,
                    }}
                  >
                    {item.nome}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          disabled={deslogando}
          style={{
            border: "1px solid #fecaca",
            background: "#fff",
            color: "var(--danger)",
            borderRadius: "8px",
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Sair
        </button>
      </aside>

      <div style={{ marginLeft: isMobile ? 0 : sidebarWidth, width: "100%" }}>
        <header
          style={{
            height: "64px",
            background: "#ffffff",
            borderBottom: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 80,
          }}
        >
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(true)}
              style={{ border: "1px solid var(--panel-border)", background: "#fff", borderRadius: "8px", padding: "8px 10px" }}
            >
              Menu
            </button>
          ) : <div />}

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <button
              type="button"
              aria-label="Abrir notificacoes"
              onClick={() => setNotificacoesAbertas((aberto) => !aberto)}
              className={sinoAnimado ? "notification-bell notification-bell--ring" : "notification-bell"}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 17H9m9-1.8c-.9-.9-1.4-2.1-1.4-3.4V9.5a4.6 4.6 0 0 0-9.2 0v2.3c0 1.3-.5 2.5-1.4 3.4L5 16.2V18h14v-1.8l-1-1ZM13.5 20a1.7 1.7 0 0 1-3 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {naoLidas > 0 && <span className="notification-badge">{naoLidas > 99 ? "99+" : naoLidas}</span>}
            </button>

            {notificacoesAbertas && (
              <div className="notification-panel">
                <div className="notification-panel__header">
                  <div>
                    <strong>Notificacoes</strong>
                    <p>{naoLidas} nao lida(s)</p>
                  </div>
                  <button type="button" onClick={() => setNotificacoesAbertas(false)}>Fechar</button>
                </div>
                <div className="notification-panel__actions">
                  <button type="button" onClick={marcarTodasLidas} disabled={!notificacoes.length}>Marcar todas lidas</button>
                  <button type="button" onClick={limparNotificacoes} disabled={!notificacoes.length}>Limpar</button>
                </div>
                <div className="notification-panel__list">
                  {!notificacoes.length ? (
                    <p className="notification-empty">Nada novo por aqui.</p>
                  ) : notificacoes.map((item) => (
                    <article key={item.id} className={item.lida ? "notification-item" : "notification-item notification-item--unread"}>
                      <div>
                        <strong>{item.titulo}</strong>
                        <p>{item.mensagem}</p>
                        <span>{item.criado_em ? new Date(item.criado_em).toLocaleString("pt-BR") : ""}</span>
                      </div>
                      <button type="button" onClick={() => lerNotificacao(item.id)}>Ler</button>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <span style={{ color: "var(--primary)", background: "var(--success-soft)", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "7px 12px", fontSize: "12px", fontWeight: 800 }}>
              Firebase seguro
            </span>
          </div>
        </header>

        <main style={{ padding: "26px", maxWidth: "1280px", margin: "0 auto" }}>
          {children}
        </main>
      </div>

      {aviso && (
        <div
          onClick={() => setAviso(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(460px, 100%)", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>{aviso.titulo}</h3>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{aviso.mensagem}</p>
            <button
              onClick={() => setAviso(null)}
              style={{
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
