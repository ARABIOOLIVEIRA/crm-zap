import React from "react";

/**
 * Componente de botão estilizado com suporte a diferentes variantes visuais.
 * 
 * @param {string} tipo - Variante visual: "primary" | "secondary" | "danger" | "outline"
 * @param {string} type - Tipo nativo do HTML (button, submit)
 * @param {boolean} disabled - Se o botão está desativado
 * @param {Function} onClick - Função executada no clique
 * @param {React.ReactNode} children - Conteúdo interno (texto ou ícone)
 */
export default function Botao({ 
  tipo = "primary", 
  type = "button", 
  disabled = false, 
  onClick, 
  children,
  style = {}
}) {
  const obterEstilos = () => {
    const base = {
      padding: "10px 20px",
      borderRadius: "8px",
      border: "none",
      fontSize: "14px",
      fontWeight: "600",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.2s ease",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      opacity: disabled ? 0.6 : 1,
      fontFamily: "var(--font-sans)",
      ...style
    };

    switch (tipo) {
      case "secondary":
        return {
          ...base,
          backgroundColor: "var(--secondary)",
          color: "white",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)"
        };
      case "danger":
        return {
          ...base,
          backgroundColor: "var(--danger)",
          color: "white",
          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
        };
      case "outline":
        return {
          ...base,
          backgroundColor: "transparent",
          border: "1px solid var(--panel-border)",
          color: "var(--text-primary)"
        };
      default: // primary
        return {
          ...base,
          backgroundColor: "var(--primary)",
          color: "white",
          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
        };
    }
  };

  // Efeitos de hover injetados dinamicamente para evitar a necessidade de Tailwind ou CSS externo complexo
  const handleMouseEnter = (e) => {
    if (disabled) return;
    e.currentTarget.style.transform = "scale(1.03)";
    if (tipo === "primary") e.currentTarget.style.backgroundColor = "var(--primary-hover)";
    else if (tipo === "secondary") e.currentTarget.style.backgroundColor = "var(--secondary-hover)";
    else if (tipo === "danger") e.currentTarget.style.backgroundColor = "var(--danger-hover)";
    else if (tipo === "outline") {
      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
    }
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = "scale(1)";
    if (tipo === "primary") e.currentTarget.style.backgroundColor = "var(--primary)";
    else if (tipo === "secondary") e.currentTarget.style.backgroundColor = "var(--secondary)";
    else if (tipo === "danger") e.currentTarget.style.backgroundColor = "var(--danger)";
    else if (tipo === "outline") {
      e.currentTarget.style.backgroundColor = "transparent";
      e.currentTarget.style.borderColor = "var(--panel-border)";
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={obterEstilos()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}
