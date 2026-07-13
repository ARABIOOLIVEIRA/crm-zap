window.CrmZapApiClient = {
  async request(path, payload) {
    const { crmUrl, token } = await window.CrmZapStorage.getConfig();
    if (!crmUrl || !token) throw new Error("Informe URL do CRM e token.");
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crm-zap-token": token
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Erro de API.");
    return data;
  },
  validateImport(payload) {
    return this.request("/api/extensao/validar-importacao", payload);
  },
  importConversation(payload) {
    return this.request("/api/extensao/importar-conversa", payload);
  }
};
