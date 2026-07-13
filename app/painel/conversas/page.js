"use client";

import Botao from "../../../componentes/Botao";

export default function PaginaConversas() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Conversas arquivadas</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          A importacao de conversas pela extensao foi guardada como backup. O fluxo principal agora e por campanhas, empresas, abordagens e follow-ups.
        </p>
      </div>

      <section className="glass-panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800 }}>Recurso fora da operacao diaria</h3>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Os dados antigos continuam preservados no banco, mas esta tela nao carrega mais conversas para evitar confusao com o CRM de prospeccao atual.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Botao onClick={() => window.location.href = "/painel/campanhas"}>Ir para Campanhas</Botao>
          <Botao tipo="outline" onClick={() => window.location.href = "/painel/empresas"}>Ir para Empresas</Botao>
        </div>
      </section>
    </div>
  );
}
