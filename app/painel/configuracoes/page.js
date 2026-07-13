"use client";

import Botao from "../../../componentes/Botao";

export default function PaginaConfiguracoes() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Extensao arquivada</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          A extensao Chrome ficou como backup tecnico. O sistema principal nao depende mais dela.
        </p>
      </div>

      <section className="glass-panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800 }}>Fluxo recomendado</h3>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Use Campanhas para organizar leads, Empresas para buscar/importar, Abordagens para abrir WhatsApp e Follow-ups para controlar retorno.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Botao onClick={() => window.location.href = "/painel/campanhas"}>Abrir Campanhas</Botao>
          <Botao tipo="outline" onClick={() => window.location.href = "/painel/abordagens"}>Abrir Abordagens</Botao>
        </div>
      </section>
    </div>
  );
}
