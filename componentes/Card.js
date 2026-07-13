import React from "react";

/**
 * Componente de Card informativo para exibir métricas no Dashboard.
 * 
 * @param {string} titulo - Título do card (ex: "Total de Usuários")
 * @param {string|number} valor - Valor a ser exibido em destaque
 * @param {string} emoji - Emoji representativo
 * @param {string} corDestaque - Cor de destaque adicional (ex: "primary", "secondary", "accent")
 */
export default function Card({ titulo, valor, emoji, corDestaque = "primary" }) {
  const obterCorBorda = () => {
    switch (corDestaque) {
      case "secondary": return "rgba(99, 102, 241, 0.4)";
      case "accent": return "rgba(245, 158, 11, 0.4)";
      case "danger": return "rgba(239, 68, 68, 0.4)";
      default: return "rgba(16, 185, 129, 0.4)"; // primary - verde
    }
  };

  return (
    <div 
      className="glass-panel hover-grow animate-fade-in"
      style={{
        padding: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderLeft: `4px solid ${obterCorBorda()}`,
        flex: "1 1 200px"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {titulo}
        </span>
        <span style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-primary)" }}>
          {valor}
        </span>
      </div>
      <div 
        style={{
          fontSize: "36px",
          background: "rgba(255, 255, 255, 0.05)",
          width: "60px",
          height: "60px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 10px rgba(255, 255, 255, 0.05)"
        }}
      >
        {emoji}
      </div>
    </div>
  );
}
