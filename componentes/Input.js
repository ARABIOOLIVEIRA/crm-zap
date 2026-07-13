import React from "react";

/**
 * Componente de campo de entrada (input) e seleção (select) reutilizável e elegante.
 * 
 * @param {string} label - Rótulo explicativo do campo
 * @param {string} type - Tipo do input (text, number, file, select)
 * @param {string} value - Valor atual do campo
 * @param {string} placeholder - Texto interno de auxílio
 * @param {Array} options - Opções (apenas se type for "select", ex: [{value: '', label: ''}])
 * @param {boolean} required - Se o preenchimento é obrigatório
 * @param {Function} onChange - Callback executado na alteração do valor
 */
export default function Input({
  label,
  type = "text",
  value,
  placeholder,
  options = [],
  required = false,
  onChange,
  style = {}
}) {
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    width: "100%",
    fontFamily: "var(--font-sans)",
    ...style
  };

  const labelStyle = {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  };

  const inputStyle = {
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    border: "1px solid var(--panel-border)",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    width: "100%"
  };

  // Efeitos de foco interativos injetados dinamicamente
  const handleFocus = (e) => {
    e.target.style.borderColor = "var(--primary)";
    e.target.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.15)";
  };

  const handleBlur = (e) => {
    e.target.style.borderColor = "var(--panel-border)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label} {required && <span style={{ color: "var(--danger)" }}>*</span>}</label>}
      
      {type === "select" ? (
        <select
          value={value}
          required={required}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={inputStyle}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={inputStyle}
        />
      )}
    </div>
  );
}
