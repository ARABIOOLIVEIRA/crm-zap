import React from "react";
import Botao from "./Botao";

/**
 * Componente de Janela Flutuante (Modal) reutilizável para formulários e confirmações.
 * 
 * @param {boolean} aberto - Estado de exibição do modal
 * @param {string} titulo - Título no cabeçalho do modal
 * @param {Function} aoFechar - Callback para fechar o modal
 * @param {React.ReactNode} children - Elementos internos do corpo do modal
 */
export default function Modal({ aberto, titulo, aoFechar, children }) {
  if (!aberto) return null;

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "fadeIn 0.25s ease"
      }}
      onClick={aoFechar}
    >
      <div 
        className="glass-panel"
        style={{
          width: "90%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
          position: "relative",
          animation: "fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }}
        onClick={(e) => e.stopPropagation()} // Evita fechar ao clicar dentro do formulário
      >
        {/* Cabeçalho */}
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            borderBottom: "1px solid var(--panel-border)",
            paddingBottom: "12px"
          }}
        >
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>{titulo}</h3>
          <Botao tipo="outline" onClick={aoFechar} style={{ padding: "6px 10px", minWidth: "auto", fontSize: "12px" }}>
            ✕
          </Botao>
        </div>

        {/* Corpo do Modal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
