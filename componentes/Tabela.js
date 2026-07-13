import React from "react";

/**
 * Componente de Tabela estruturada com estilo premium para exibição de dados.
 * 
 * @param {Array} cabecalhos - Lista com os nomes das colunas da tabela (ex: ["Nome", "Bairro"])
 * @param {Array} children - Elementos `<tr>` que contêm as linhas de dados `<td>`
 */
export default function Tabela({ cabecalhos = [], children }) {
  return (
    <div 
      style={{
        width: "100%",
        overflowX: "auto",
        border: "1px solid var(--panel-border)",
        borderRadius: "10px",
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)"
      }}
    >
      <table 
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          fontSize: "14px",
          fontFamily: "var(--font-sans)"
        }}
      >
        <thead>
          <tr 
            style={{
              borderBottom: "2px solid var(--panel-border)",
              background: "#f8fafc"
            }}
          >
            {cabecalhos.map((cab, idx) => (
              <th 
                key={idx} 
                style={{
                  padding: "16px 20px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  fontSize: "12px",
                  letterSpacing: "0.5px"
                }}
              >
                {cab}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ color: "var(--text-primary)" }}>
          {children}
        </tbody>
      </table>
    </div>
  );
}
